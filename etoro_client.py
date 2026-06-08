import os
import uuid
import requests
from dotenv import load_dotenv

load_dotenv()

class EToroClient:
    """
    Cliente para interactuar con la API oficial de eToro.
    Maneja la autenticación y ruteo dinámico para Demo y Real.
    """
    BASE_URL = "https://public-api.etoro.com"

    def __init__(self):
        self.public_key = os.getenv("ETORO_PUBLIC_KEY")
        self.user_key = os.getenv("ETORO_USER_KEY")
        self.env = os.getenv("ETORO_ENV", "demo").lower()
        
        if not self.public_key or not self.user_key:
            raise ValueError("Las credenciales ETORO_PUBLIC_KEY y/O ETORO_USER_KEY no están definidas en el archivo .env")
            
        # Cache local para evitar sobrepasar los límites de peticiones (rate limiting) de búsqueda de símbolos
        self.symbol_cache = {}

    def _get_headers(self):
        """Genera los encabezados de autenticación obligatorios."""
        return {
            "x-api-key": self.public_key,
            "x-user-key": self.user_key,
            "x-request-id": str(uuid.uuid4()),
            "Content-Type": "application/json"
        }

    def resolve_symbol(self, symbol):
        """
        Resuelve un símbolo de ticker (ej. BTC, AAPL) a su instrumentId numérico oficial de eToro.
        Utiliza caché local para optimizar las llamadas.
        """
        symbol = symbol.upper()
        if symbol in self.symbol_cache:
            return self.symbol_cache[symbol]

        url = f"{self.BASE_URL}/api/v1/market-data/search"
        headers = self._get_headers()
        params = {"internalSymbolFull": symbol}

        try:
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                
                # Buscamos la coincidencia exacta
                instrument = next((item for item in items if item.get("internalSymbolFull") == symbol), None)
                if instrument:
                    inst_id = instrument.get("instrumentId")
                    self.symbol_cache[symbol] = inst_id
                    return inst_id
            
            # Si no se encuentra de forma exacta o falla, levantamos excepción
            raise Exception(f"No se pudo resolver el símbolo {symbol}. Status: {response.status_code}, Res: {response.text}")
        except Exception as e:
            print(f"Error al resolver símbolo {symbol}: {e}")
            raise e

    def get_rates(self, instrument_ids):
        """
        Obtiene las tasas (ask, bid, last execution) actuales de una lista de IDs de instrumentos.
        """
        if not instrument_ids:
            return []
            
        url = f"{self.BASE_URL}/api/v1/market-data/instruments/rates"
        headers = self._get_headers()
        params = {"instrumentIds": ",".join(map(str, instrument_ids))}

        try:
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                return response.json().get("rates", [])
            else:
                print(f"Error al obtener tasas. Status: {response.status_code}, Res: {response.text}")
                return []
        except Exception as e:
            print(f"Excepción al obtener tasas: {e}")
            return []

    def get_instruments_metadata(self, instrument_ids):
        """
        Obtiene la metadata (nombre de visualización, símbolo, etc.) de una lista de IDs de instrumentos.
        """
        if not instrument_ids:
            return []
            
        url = f"{self.BASE_URL}/api/v1/market-data/instruments"
        headers = self._get_headers()
        params = {"instrumentIds": ",".join(map(str, instrument_ids))}

        try:
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                return response.json().get("instrumentDisplayDatas", [])
            else:
                print(f"Error al obtener metadata. Status: {response.status_code}, Res: {response.text}")
                return []
        except Exception as e:
            print(f"Excepción al obtener metadata: {e}")
            return []

    def get_portfolio(self):
        """
        Obtiene el portafolio (balance, posiciones abiertas, órdenes) de la cuenta.
        Se adapta automáticamente según el entorno (Demo o Real).
        """
        if self.env == "demo":
            url = f"{self.BASE_URL}/api/v1/trading/info/demo/portfolio"
        else:
            url = f"{self.BASE_URL}/api/v1/trading/info/portfolio"

        headers = self._get_headers()
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Error al obtener portafolio. Status: {response.status_code}, Res: {response.text}")
                return None
        except Exception as e:
            print(f"Excepción al obtener portafolio: {e}")
            return None

    def get_historical_candles(self, instrument_id, interval="OneHour", count=100):
        """
        Retorna velas históricas para análisis técnico (dirección ascendente por defecto).
        """
        url = f"{self.BASE_URL}/api/v1/market-data/instruments/{instrument_id}/history/candles/asc/{interval}/{count}"
        headers = self._get_headers()

        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                # Retorna la lista de velas del primer objeto en la respuesta
                candles_data = response.json().get("candles", [])
                if candles_data:
                    return candles_data[0].get("candles", [])
                return []
            else:
                print(f"Error al obtener velas. Status: {response.status_code}, Res: {response.text}")
                return []
        except Exception as e:
            print(f"Excepción al obtener velas: {e}")
            return []

    def create_order(self, symbol, amount=None, units=None, transaction="buy", leverage=1, stop_loss_rate=None, take_profit_rate=None):
        """
        Crea una orden de mercado para abrir una posición.
        Se adapta a los endpoints y requisitos específicos de Demo o Real.
        """
        inst_id = self.resolve_symbol(symbol)
        
        headers = self._get_headers()
        payload = {
            "action": "open",
            "transaction": transaction,
            "instrumentId": inst_id,
            "orderType": "mkt",
            "leverage": leverage,
            "orderCurrency": "usd"
        }

        # Especificar cantidad en USD o unidades de volumen (uno de los dos obligatoriamente)
        if amount is not None:
            payload["amount"] = amount
        elif units is not None:
            payload["units"] = units
        else:
            raise ValueError("Se debe especificar 'amount' o 'units' para colocar la orden.")

        # Parámetros avanzados opcionales
        if stop_loss_rate is not None:
            payload["stopLossRate"] = stop_loss_rate
            payload["stopLossType"] = "fixed"
        if take_profit_rate is not None:
            payload["takeProfitRate"] = take_profit_rate

        # Adaptación de ruta y parámetros según entorno
        if self.env == "demo":
            url = f"{self.BASE_URL}/api/v2/trading/execution/demo/orders"
            payload["settlementType"] = "cfd" # Requerido para Demo
        else:
            url = f"{self.BASE_URL}/api/v2/trading/execution/orders"

        try:
            response = requests.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Fallo al crear orden. Status: {response.status_code}, Res: {response.text}")
        except Exception as e:
            print(f"Excepción al crear orden: {e}")
            raise e

    def close_position(self, position_id, instrument_id, units_to_deduct=None):
        """
        Cierra una posición abierta existente usando el ID de la posición y el ID del instrumento.
        Se adapta dinámicamente según sea Demo o Real.
        """
        if self.env == "demo":
            url = f"{self.BASE_URL}/api/v1/trading/execution/demo/market-close-orders/positions/{position_id}"
        else:
            url = f"{self.BASE_URL}/api/v1/trading/execution/market-close-orders/positions/{position_id}"

        headers = self._get_headers()
        payload = {
            "InstrumentId": instrument_id,
            "UnitsToDeduct": units_to_deduct # None / Null para cierre completo
        }

        try:
            response = requests.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Fallo al cerrar posición. Status: {response.status_code}, Res: {response.text}")
        except Exception as e:
            print(f"Excepción al cerrar posición: {e}")
            raise e
