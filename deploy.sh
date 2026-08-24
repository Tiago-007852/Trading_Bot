#!/usr/bin/env bash
# ==============================================================================
# TRADE AO — 24/7 Production Deployment Script
# Supports Ubuntu 22.04 LTS, 24.04 LTS, Debian 11/12
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "🚀 TRADE AO — 24/7 PRODUCTION SERVER DEPLOYMENT"
echo "=========================================================="

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

# 1. Create required runtime directories
echo "📁 [1/6] Criando diretórios de runtime..."
mkdir -p storage logs
chmod 750 storage logs

# 2. Python Virtual Environment Setup (DO NOT VERSION VENV)
echo "🐍 [2/6] Configurando ambiente virtual Python (venv)..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ venv criado com sucesso."
fi

echo "📦 [3/6] Instalando dependências Python (requirements.txt)..."
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# 3. Node.js Build
echo "⚡ [4/6] Compilando aplicação Node / Vite / Express..."
if command -v npm &> /dev/null; then
    npm install
    npm run build
else
    echo "⚠️ npm não encontrado no PATH. Certifique-se de que o Node.js 18+ está instalado."
fi

# 4. Systemd Service Installation (if running as root or with sudo)
if [ "$(id -u)" -eq 0 ]; then
    echo "⚙️ [5/6] Instalando serviços Systemd em /etc/systemd/system/..."
    
    # Adjust paths in service files dynamically for current directory
    sed "s|/opt/tradeao|$APP_DIR|g" services/tradeao-bot.service > /etc/systemd/system/tradeao-bot.service
    sed "s|/opt/tradeao|$APP_DIR|g" services/tradeao-engine.service > /etc/systemd/system/tradeao-engine.service
    cp services/tradeao.target /etc/systemd/system/tradeao.target
    
    if [ -f "services/logrotate-tradeao.conf" ]; then
        sed "s|/opt/tradeao|$APP_DIR|g" services/logrotate-tradeao.conf > /etc/logrotate.d/tradeao
    fi

    systemctl daemon-reload
    systemctl enable tradeao-engine.service tradeao-bot.service
    echo "✅ Serviços Systemd registrados e habilitados para boot automático."

    echo "🔄 [6/6] Reiniciando serviços 24/7..."
    systemctl restart tradeao-engine.service
    systemctl restart tradeao-bot.service
    
    echo "=========================================================="
    echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO!"
    echo "=========================================================="
    echo "Status do Servidor Node: systemctl status tradeao-engine"
    echo "Status do Bot Telegram: systemctl status tradeao-bot"
    echo "Logs ao vivo: journalctl -u tradeao-bot -f"
else
    echo "ℹ️ [5/6] Executado sem privilégios root. Para instalar serviços systemd:"
    echo "   sudo ./deploy.sh"
    echo "=========================================================="
    echo "✅ Build local concluído. Inicialização manual:"
    echo "   Node Server: npm run start"
    echo "   Python Bot:  ./venv/bin/python bot.py"
    echo "=========================================================="
fi
