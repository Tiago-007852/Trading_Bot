# Guia de Deployment 24/7 — Trade AO & Telegram Bot

Este documento descreve os passos para instalar, executar e manter a plataforma **Trade AO** em execução contínua 24/7 em um servidor VPS ou nuvem (Ubuntu 22.04 / 24.04 LTS, Debian 11/12).

---

## 1. Arquitetura de Execução 24/7

O Trade AO opera com uma arquitetura híbrida de alta resiliência:

1. **`tradeao-engine.service` (Node.js 18+ / Express / Vite)**
   - API de Trading, Signal Center, Risk Manager e Web UI.
   - Banco de Dados Relacional SQLite com transações ACID (`storage/tradeao.sqlite`).
   - Monitoramento de Ordens e Posições persistidas em tempo real.
   - Proteção de instância única por PID lockfile (`storage/tradeao_server.pid`).

2. **`tradeao-bot.service` (Python 3.10+ / Telegram Bot)**
   - Interface conversacional do Telegram.
   - Ambiente isolado via Python Virtualenv (`venv/`).
   - Proteção anti-duplicação de processos por PID lockfile (`storage/tradeao_bot.pid`).
   - Rotação automática de logs (10MB c/ 5 arquivos de backup).

3. **Garantia de Zero Perda de Memória (Crash Recovery)**
   - Os jobs de resolução de trades **NÃO** dependem exclusivamente da memória RAM do processo.
   - Toda ordem executada é imediatamente gravada na tabela `active_monitored_jobs` do SQLite.
   - Ao reiniciar o servidor (ou após uma queda de energia), a rotina `reconstituteJobsFromPersistence` recupera automaticamente todas as posições em aberto, consulta o preço de mercado, reconcilia Take Profit / Stop Loss e restaura o monitoramento ativo.

---

## 2. Requisitos do Servidor

- **Sistema Operacional:** Linux Ubuntu 22.04 LTS / 24.04 LTS ou Debian 11/12
- **Hardware Recomendado:** 1 vCPU, 1 GB de RAM, 10 GB SSD
- **Dependências de Sistema:**
  ```bash
  sudo apt update && sudo apt install -y python3 python3-venv python3-pip nodejs npm git curl
  ```

---

## 3. Instalação e Preparação do Ambiente

### 3.1 Clonar o Repositório
```bash
cd /opt
sudo git clone <URL_DO_REPOSITORIO> tradeao
cd /opt/tradeao
```

### 3.2 Configurar o Ambiente Python (Virtualenv)
> ⚠️ **IMPORTANTE:** O diretório `venv/` **NÃO É VERSIONADO** no git (está no `.gitignore`). O servidor cria seu próprio ambiente:

```bash
# 1. Criar o ambiente virtual
python3 -m venv venv

# 2. Ativar o ambiente virtual
source venv/bin/activate

# 3. Instalar as dependências do requirements.txt
pip install --upgrade pip
pip install -r requirements.txt
```

### 3.3 Configurar o Node.js e Build do Frontend
```bash
npm install
npm run build
```

### 3.4 Configurar Variáveis de Ambiente (`.env`)
Copie o arquivo de exemplo e configure suas chaves:
```bash
cp .env.example .env
nano .env
```
Variáveis principais:
```env
TELEGRAM_BOT_TOKEN=seu_token_aqui
BINANCE_API_KEY=sua_api_key
BINANCE_API_SECRET=seu_api_secret
PORT=3000
NODE_ENV=production
```

---

## 4. Configuração do Process Manager (Systemd)

O repositório já inclui os arquivos de serviço prontos em `services/`.

### 4.1 Copiar os arquivos de serviço
```bash
sudo cp services/tradeao-engine.service /etc/systemd/system/
sudo cp services/tradeao-bot.service /etc/systemd/system/
sudo cp services/tradeao.target /etc/systemd/system/
sudo cp services/logrotate-tradeao.conf /etc/logrotate.d/tradeao
```

### 4.2 Habilitar e Iniciar os Serviços
```bash
sudo systemctl daemon-reload
sudo systemctl enable tradeao-engine tradeao-bot
sudo systemctl start tradeao-engine tradeao-bot
```

### 4.3 Comandos de Gerenciamento Úteis
| Ação | Comando |
| :--- | :--- |
| **Verificar status do Node Server** | `sudo systemctl status tradeao-engine` |
| **Verificar status do Bot Python** | `sudo systemctl status tradeao-bot` |
| **Reiniciar ambos os serviços** | `sudo systemctl restart tradeao-engine tradeao-bot` |
| **Ver logs em tempo real do Bot** | `sudo journalctl -u tradeao-bot -f -n 50` |
| **Ver logs em tempo real do Server** | `sudo journalctl -u tradeao-engine -f -n 50` |
| **Ver arquivo de log do servidor** | `tail -f logs/tradeao_server.log` |
| **Ver arquivo de log do bot** | `tail -f logs/tradeao_bot.log` |

---

## 5. Script de Deploy Automático (1-Click)

Você também pode usar o script `deploy.sh`:
```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

---

## 6. Alternativa com PM2

Caso prefira utilizar o **PM2** ao invés do systemd:
```bash
npm install -g pm2
pm2 start services/ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 7. Teste de Resiliência e Recuperação Pós-Crash

Para testar a recuperação de ordens sem dependência de memória:
1. Abra um trade ou ative o autotrading.
2. No painel web, clique no botão **"24/7 Daemon"** na barra superior e selecione **"Simular Queda de Servidor (Crash Test)"** ou execute:
   ```bash
   sudo systemctl restart tradeao-engine
   ```
3. O sistema recarregará as posições diretamente do SQLite e emitirá a mensagem de reconciliação no feed de auditoria e no Telegram.
