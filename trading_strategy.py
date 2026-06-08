def calculate_sma(prices, period):
    """Calcula la Media Móvil Simple para un periodo dado."""
    if len(prices) < period:
        return None
    return sum(prices[-period:]) / period

def calculate_rsi(prices, period=14):
    """Calcula el Relative Strength Index (RSI) para una lista de precios."""
    if len(prices) < period + 1:
        return None

    deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
    
    # Ganancias y pérdidas iniciales
    gains = [d if d > 0 else 0 for d in deltas[:period]]
    losses = [-d if d < 0 else 0 for d in deltas[:period]]
    
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    
    # Wilder's smoothing para el resto de la serie
    for d in deltas[period:]:
        gain = d if d > 0 else 0
        loss = -d if d < 0 else 0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        
    if avg_loss == 0:
        return 100
        
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def analyze_market(candles, strategy_type="rsi", symbol="ASSET"):
    """
    Analiza la lista de velas históricas y determina una señal de trading: BUY, SELL o HOLD.
    Retorna un diccionario con la señal y los valores calculados de los indicadores.
    """
    if not candles or len(candles) < 25:
        return {
            "signal": "HOLD",
            "reason": "Insuficientes datos históricos de velas (mínimo 25)",
            "indicators": {}
        }
    
    # Extraemos los precios de cierre (close) ordenados de más antiguo a más reciente
    close_prices = [float(c["close"]) for c in candles]
    current_price = close_prices[-1]
    
    indicators = {"current_price": current_price}

    if strategy_type == "rsi":
        rsi = calculate_rsi(close_prices, period=14)
        indicators["rsi"] = rsi
        
        if rsi is None:
            return {"signal": "HOLD", "reason": "No se pudo calcular el RSI", "indicators": indicators}
            
        # Lógica de sobreventa/sobrecompra
        if rsi < 30:
            signal = "BUY"
            reason = f"RSI de {rsi:.2f} está en zona de sobreventa (< 30)"
        elif rsi > 70:
            signal = "SELL"
            reason = f"RSI de {rsi:.2f} está en zona de sobrecompra (> 70)"
        else:
            signal = "HOLD"
            reason = f"RSI de {rsi:.2f} está en rango neutral (30-70)"
            
    elif strategy_type == "sma_cross":
        # Cruce de Medias Móviles: Corta (9) y Larga (21)
        sma_short_curr = calculate_sma(close_prices, 9)
        sma_long_curr = calculate_sma(close_prices, 21)
        
        # Valores anteriores para detectar el cruce
        sma_short_prev = calculate_sma(close_prices[:-1], 9)
        sma_long_prev = calculate_sma(close_prices[:-1], 21)
        
        indicators["sma_9"] = sma_short_curr
        indicators["sma_21"] = sma_long_curr
        
        if None in (sma_short_curr, sma_long_curr, sma_short_prev, sma_long_prev):
            return {"signal": "HOLD", "reason": "No se pudieron calcular las medias móviles", "indicators": indicators}
            
        # Detección del cruce alcista (Golden Cross): Corta cruza arriba de Larga
        if sma_short_prev <= sma_long_prev and sma_short_curr > sma_long_curr:
            signal = "BUY"
            reason = f"Cruce alcista: SMA 9 ({sma_short_curr:.2f}) cruzó sobre SMA 21 ({sma_long_curr:.2f})"
        # Detección del cruce bajista (Death Cross): Corta cruza abajo de Larga
        elif sma_short_prev >= sma_long_prev and sma_short_curr < sma_long_curr:
            signal = "SELL"
            reason = f"Cruce bajista: SMA 9 ({sma_short_curr:.2f}) cruzó debajo de SMA 21 ({sma_long_curr:.2f})"
        else:
            signal = "HOLD"
            reason = f"Sin cruce detectado. SMA 9: {sma_short_curr:.2f}, SMA 21: {sma_long_curr:.2f}"
            
    else:
        signal = "HOLD"
        reason = f"Estrategia '{strategy_type}' no reconocida."

    return {
        "signal": signal,
        "reason": reason,
        "indicators": indicators
    }
