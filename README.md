# eToro AlgoTrader Bot

Este repositorio contiene un Bot de Trading Automatizado de eToro acompañado de una interfaz gráfica (Dashboard) local para el monitoreo y control en tiempo real de tu algoritmo.

## Características principales

* **Motor en Python:** Conectividad a la API oficial de eToro, soporte para entornos Demo y Real, resolución inteligente de símbolos a IDs con caché interna.
* **Estrategias Técnicas:** Señales automáticas basadas en indicadores RSI y Cruce de Medias Móviles (SMA 9/21).
* **Control en Vivo:** Servidor Flask que expone APIs locales y actúa como proxy contra la API de eToro evitando problemas de CORS en el navegador.
* **UI de Alta Calidad:** Panel de control con diseño premium de tipo cristal (glassmorphism), visualización de balance, capital neto (equity), PnL abierto, grilla de posiciones en tiempo real con opción de cierre y consola de registros (logs) en vivo.

## Instalación y Requisitos

1. Clonar el repositorio.
2. Instalar las dependencias de Python:
   ```bash
   pip install -r requirements.txt
   ```
3. Configura tus credenciales de eToro en un archivo `.env` en la raíz del proyecto (ver plantilla `.env.template`):
   ```env
   ETORO_PUBLIC_KEY=tu_clave_publica
   ETORO_USER_KEY=tu_clave_user_privada
   ETORO_ENV=demo
   ```

## Cómo Correr

Para iniciar el servidor y el bot, ejecuta:
```bash
python3 server.py
```
Luego, entra desde tu navegador en:
👉 **[http://localhost:5000](http://localhost:5000)**
