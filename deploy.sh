#!/bin/bash
# Script de despliegue automático para el Bot de eToro en el VPS

HOST="2.25.183.239"
USER="root"
DEST_DIR="/root/etoro-bot"

echo "===================================================="
echo "Iniciando despliegue de eToro Bot a VPS Hostinger..."
echo "IP: $HOST"
echo "Usuario: $USER"
echo "===================================================="
echo "Nota: Se te solicitará la contraseña de tu VPS para realizar la transferencia y configuración."
echo "Contraseña del VPS: h;jhU;yb0y.RDXo?"
echo "===================================================="

# 1. Crear directorio en el VPS
echo "[1/4] Creando directorio de destino en el VPS..."
ssh -o StrictHostKeyChecking=no $USER@$HOST "mkdir -p $DEST_DIR"

# 2. Copiar archivos excluyendo carpetas locales innecesarias
echo "[2/4] Transfiriendo archivos del bot..."
scp -o StrictHostKeyChecking=no -r .env requirements.txt etoro_client.py trading_strategy.py bot.py server.py templates static $USER@$HOST:$DEST_DIR/

# 3. Configurar entorno y dependencias en el VPS
echo "[3/4] Instalando dependencias y configurando servicio en el VPS..."
ssh -o StrictHostKeyChecking=no $USER@$HOST << 'EOF'
    # Actualizar e instalar dependencias del sistema
    apt-get update
    apt-get install -y python3 python3-pip python3-venv

    # Crear entorno virtual de python
    python3 -m venv /root/etoro-bot/venv
    /root/etoro-bot/venv/bin/pip install --upgrade pip
    /root/etoro-bot/venv/bin/pip install -r /root/etoro-bot/requirements.txt

    # Crear archivo de servicio Systemd para ejecución 24/7
    cat << 'SERVICE' > /etc/systemd/system/etoro-bot.service
[Unit]
Description=eToro AlgoTrader Bot Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/etoro-bot
ExecStart=/root/etoro-bot/venv/bin/python server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

    # Recargar daemon y habilitar servicio
    systemctl daemon-reload
    systemctl enable etoro-bot.service
    systemctl restart etoro-bot.service
EOF

echo "===================================================="
echo "[4/4] ¡Despliegue completado con éxito!"
echo "El bot ahora está corriendo 24/7 en tu VPS."
echo "Puedes acceder al panel en: http://\$HOST:5001"
echo "===================================================="
