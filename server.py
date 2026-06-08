import os
from flask import Flask, jsonify, request, render_template, send_from_directory
from bot import bot_instance

app = Flask(__name__, template_folder="templates", static_folder="static")

# Asegurar que existan las carpetas de templates y static
os.makedirs("templates", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

@app.route("/")
def index():
    """Sirve la página del dashboard."""
    return render_template("index.html")

@app.route("/api/status", methods=["GET"])
def get_status():
    """Retorna el estado de ejecución y configuración del bot."""
    return jsonify({
        "is_running": bot_instance.is_running,
        "env": bot_instance.client.env,
        "strategy": bot_instance.strategy,
        "interval": bot_instance.interval,
        "symbols": bot_instance.symbols,
        "amount_per_trade": bot_instance.amount_per_trade,
        "leverage": bot_instance.leverage,
        "candle_interval": bot_instance.candle_interval
    })

@app.route("/api/status/update", methods=["POST"])
def update_status():
    """Actualiza la configuración del bot en caliente."""
    data = request.json or {}
    
    if "symbols" in data:
        # Convertir a lista limpia de símbolos en mayúscula
        bot_instance.symbols = [s.strip().upper() for s in data["symbols"] if s.strip()]
    if "strategy" in data:
        bot_instance.strategy = data["strategy"]
    if "interval" in data:
        bot_instance.interval = int(data["interval"])
    if "amount_per_trade" in data:
        bot_instance.amount_per_trade = float(data["amount_per_trade"])
    if "leverage" in data:
        bot_instance.leverage = int(data["leverage"])
    if "candle_interval" in data:
        bot_instance.candle_interval = data["candle_interval"]

    bot_instance.log("Configuración del Bot actualizada vía Dashboard.")
    return jsonify({"success": True, "message": "Configuración actualizada correctamente."})

@app.route("/api/bot/start", methods=["POST"])
def start_bot():
    """Inicia el bot."""
    bot_instance.start()
    return jsonify({"success": True, "is_running": True})

@app.route("/api/bot/stop", methods=["POST"])
def stop_bot():
    """Detiene el bot."""
    bot_instance.stop()
    return jsonify({"success": True, "is_running": False})

@app.route("/api/portfolio", methods=["GET"])
def get_portfolio():
    """
    Obtiene el portafolio actual de eToro enriquecido con metadata
    (símbolos) y tasas actuales del mercado (PnL en vivo).
    """
    portfolio = bot_instance.client.get_portfolio()
    if not portfolio:
        return jsonify({"error": "No se pudo recuperar el portafolio de eToro"}), 500

    client_port = portfolio.get("clientPortfolio", {})
    raw_positions = client_port.get("positions", [])
    credit = client_port.get("credit", 0.0)

    # Si no hay posiciones abiertas, retornamos vacío de inmediato
    if not raw_positions:
        return jsonify({
            "credit": credit,
            "positions": []
        })

    # Extraer IDs de instrumentos para consultar metadata y precios de una sola vez
    inst_ids = list(set(pos.get("instrumentID") for pos in raw_positions))
    
    # Consultar metadata (símbolos)
    metadata_list = bot_instance.client.get_instruments_metadata(inst_ids)
    metadata_map = {item.get("instrumentID"): item for item in metadata_list}
    
    # Consultar tasas del mercado actuales
    rates_list = bot_instance.client.get_rates(inst_ids)
    rates_map = {item.get("instrumentID"): item for item in rates_list}

    enriched_positions = []
    total_equity = credit

    for pos in raw_positions:
        inst_id = pos.get("instrumentID")
        pos_id = pos.get("positionID")
        units = pos.get("units", 0.0)
        open_rate = pos.get("openRate", 0.0)
        initial_invest = pos.get("initialAmountInDollars", pos.get("amount", 0.0))
        is_buy = pos.get("isBuy", True)

        # Resolver metadata
        meta = metadata_map.get(inst_id, {})
        symbol = meta.get("symbolFull", f"ID {inst_id}")
        display_name = meta.get("instrumentDisplayName", "Asset")

        # Resolver precio actual
        rate_info = rates_map.get(inst_id, {})
        current_rate = rate_info.get("bid" if is_buy else "ask", open_rate)
        if current_rate is None or current_rate == 0:
            current_rate = open_rate

        # Calcular valores en vivo
        # Si es compra (Long), ganamos si sube. Si es venta (Short), ganamos si baja.
        if is_buy:
            pnl_per_unit = current_rate - open_rate
        else:
            pnl_per_unit = open_rate - current_rate

        # El PnL real debe escalarse por apalancamiento y tipo de cambio
        # eToro usualmente maneja las posiciones en dólares.
        # Una estimación directa del PnL en dólares:
        pnl = units * pnl_per_unit * pos.get("leverage", 1.0)
        current_value = initial_invest + pnl
        total_equity += current_value

        enriched_positions.append({
            "positionID": pos_id,
            "instrumentID": inst_id,
            "symbol": symbol,
            "displayName": display_name,
            "isBuy": is_buy,
            "leverage": pos.get("leverage", 1.0),
            "openDateTime": pos.get("openDateTime"),
            "openRate": open_rate,
            "currentRate": current_rate,
            "amount": initial_invest,
            "units": units,
            "currentValue": current_value,
            "pnl": pnl,
            "pnlPercent": (pnl / initial_invest * 100) if initial_invest > 0 else 0
        })

    return jsonify({
        "credit": credit,
        "equity": total_equity,
        "positions": enriched_positions
    })

@app.route("/api/trade", methods=["POST"])
def execute_trade():
    """Ejecuta una orden de trading manual."""
    data = request.json or {}
    symbol = data.get("symbol")
    amount = data.get("amount")
    transaction = data.get("transaction", "buy")
    leverage = data.get("leverage", 1)

    if not symbol or not amount:
        return jsonify({"error": "Símbolo y monto son requeridos"}), 400

    try:
        res = bot_instance.client.create_order(
            symbol=symbol,
            amount=float(amount),
            transaction=transaction,
            leverage=int(leverage)
        )
        bot_instance.log(f"Orden manual colocada: {transaction.upper()} {symbol} por ${amount} USD.")
        return jsonify({"success": True, "result": res})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/close", methods=["POST"])
def close_trade():
    """Cierra una posición abierta."""
    data = request.json or {}
    position_id = data.get("positionID")
    instrument_id = data.get("instrumentID")

    if not position_id or not instrument_id:
        return jsonify({"error": "positionID e instrumentID son requeridos"}), 400

    try:
        res = bot_instance.client.close_position(
            position_id=position_id,
            instrument_id=int(instrument_id)
        )
        bot_instance.log(f"Posición ID {position_id} cerrada manualmente desde el dashboard.")
        return jsonify({"success": True, "result": res})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/logs", methods=["GET"])
def get_logs():
    """Retorna las últimas 100 líneas del archivo log."""
    log_file = "bot_activity.log"
    if not os.path.exists(log_file):
        return jsonify({"logs": "Aún no hay registros de actividad creados."})

    try:
        with open(log_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        last_lines = lines[-100:]
        return jsonify({"logs": "".join(last_lines)})
    except Exception as e:
        return jsonify({"error": f"No se pudieron leer los logs: {e}"}), 500

@app.route("/api/search", methods=["GET"])
def search_symbol():
    """Permite buscar un símbolo para ver si existe y su ID."""
    symbol = request.args.get("symbol", "").strip()
    if not symbol:
        return jsonify({"error": "Símbolo requerido"}), 400

    try:
        inst_id = bot_instance.client.resolve_symbol(symbol)
        return jsonify({"symbol": symbol, "instrumentId": inst_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 404

if __name__ == "__main__":
    # Inicializar archivo de logs vacío para limpiar ejecuciones anteriores
    with open("bot_activity.log", "w", encoding="utf-8") as f:
        f.write("[INFO] Servidor y Bot inicializados localmente.\n")
        
    print("Iniciando servidor Flask de control local en http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=True)
