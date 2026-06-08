import time
import threading
import datetime
import traceback
from etoro_client import EToroClient
from trading_strategy import analyze_market

class TradingBot:
    def __init__(self):
        self.client = EToroClient()
        self.symbols = ["BTC", "AAPL", "ETH", "TSLA"]
        self.strategy = "rsi"  # "rsi" o "sma_cross"
        self.interval = 300    # segundos (ej. 5 minutos)
        self.amount_per_trade = 100  # USD
        self.leverage = 1
        self.candle_interval = "OneHour"
        
        self.is_running = False
        self._thread = None
        self._stop_event = threading.Event()

    def log(self, message):
        """Escribe un log con marca de tiempo tanto en consola como en bot_activity.log."""
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{timestamp}] {message}"
        print(line)
        try:
            with open("bot_activity.log", "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except Exception as e:
            print(f"Error escribiendo en log: {e}")

    def start(self):
        """Inicia el bot de trading en un hilo secundario."""
        if self.is_running:
            self.log("El bot ya está en ejecución.")
            return
            
        self.is_running = True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        self.log("Bot de Trading Automatizado INICIADO.")

    def stop(self):
        """Detiene el hilo de ejecución del bot."""
        if not self.is_running:
            self.log("El bot ya está detenido.")
            return
            
        self.is_running = False
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2)
        self.log("Bot de Trading Automatizado DETENIDO.")

    def _loop(self):
        """Bucle principal ejecutado en segundo plano."""
        # Al iniciar, borramos o inicializamos el archivo de logs
        self.log("Iniciando bucle de análisis...")
        
        while not self._stop_event.is_set():
            try:
                self.run_iteration()
            except Exception as e:
                self.log(f"ERROR CRÍTICO en la iteración del bot: {e}")
                self.log(traceback.format_exc())
                
            # Espera inteligente con stop_event
            self._stop_event.wait(self.interval)

    def run_iteration(self):
        """Ejecuta una iteración de análisis y decisiones de trading."""
        self.log(f"--- Iniciando iteración de análisis ({self.strategy.upper()}) ---")
        
        # 1. Obtener portafolio actual para ver balance y posiciones
        portfolio = self.client.get_portfolio()
        if not portfolio:
            self.log("No se pudo recuperar el portafolio de eToro. Omitiendo esta iteración.")
            return

        client_port = portfolio.get("clientPortfolio", {})
        credit = client_port.get("credit", 0.0)
        positions = client_port.get("positions", [])
        
        self.log(f"Balance Disponible (Credit): ${credit:.2f} USD")
        self.log(f"Posiciones Abiertas Totales: {len(positions)}")

        # Mapeamos posiciones abiertas por instrumentID para saber qué activos ya poseemos
        open_positions_by_inst = {}
        for pos in positions:
            inst_id = pos.get("instrumentID")
            if inst_id not in open_positions_by_inst:
                open_positions_by_inst[inst_id] = []
            open_positions_by_inst[inst_id].append(pos)

        # 2. Analizar cada símbolo configurado
        for symbol in self.symbols:
            if self._stop_event.is_set():
                break

            self.log(f"Analizando {symbol}...")
            try:
                # Resolver ID
                inst_id = self.client.resolve_symbol(symbol)
                
                # Obtener velas
                candles = self.client.get_historical_candles(inst_id, interval=self.candle_interval, count=50)
                if not candles:
                    self.log(f"No se pudieron recuperar velas históricas para {symbol}. Omitiendo.")
                    continue
                
                # Ejecutar estrategia
                analysis = analyze_market(candles, strategy_type=self.strategy, symbol=symbol)
                signal = analysis["signal"]
                reason = analysis["reason"]
                curr_price = analysis["indicators"].get("current_price", 0.0)
                
                self.log(f"Precio actual {symbol}: ${curr_price:.2f} | Señal: {signal} | Motivo: {reason}")
                
                # 3. Tomar decisiones
                if signal == "BUY":
                    # Evitar comprar si ya tenemos una posición abierta para este activo
                    if inst_id in open_positions_by_inst:
                        self.log(f"Señal de COMPRA para {symbol} ignorada: Ya existe una posición abierta.")
                    else:
                        if credit < self.amount_per_trade:
                            self.log(f"Señal de COMPRA para {symbol} fallida: Balance insuficiente (${credit:.2f} < ${self.amount_per_trade:.2f})")
                        else:
                            self.log(f"EJECUTANDO COMPRA de ${self.amount_per_trade} USD en {symbol}...")
                            order_res = self.client.create_order(
                                symbol=symbol,
                                amount=self.amount_per_trade,
                                transaction="buy",
                                leverage=self.leverage
                            )
                            self.log(f"Respuesta de orden COMPRA {symbol}: {order_res}")
                            # Actualizar balance local aproximado temporal
                            credit -= self.amount_per_trade
                            
                elif signal == "SELL":
                    # Cerrar todas las posiciones abiertas de este activo
                    if inst_id in open_positions_by_inst:
                        self.log(f"Señal de VENTA para {symbol}: Cerrando posiciones abiertas...")
                        for pos in open_positions_by_inst[inst_id]:
                            pos_id = pos.get("positionID")
                            self.log(f"Cerrando posición ID {pos_id} de {symbol}...")
                            close_res = self.client.close_position(
                                position_id=pos_id,
                                instrument_id=inst_id
                            )
                            self.log(f"Respuesta de cierre para {symbol} (Posición {pos_id}): {close_res}")
                    else:
                        self.log(f"Señal de VENTA para {symbol} ignorada: No hay posiciones abiertas para este activo.")
                        
                else:
                    # HOLD
                    pass
                    
            except Exception as e:
                self.log(f"Error procesando símbolo {symbol}: {e}")

        self.log("--- Iteración de análisis finalizada ---")

# Instancia global del bot para ser importada por el servidor Flask
bot_instance = TradingBot()
