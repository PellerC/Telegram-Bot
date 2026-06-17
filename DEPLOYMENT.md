# VPS Deployment

This bot is a long-running Telegram polling process. The simplest production setup is:

- Ubuntu VPS
- Node.js 22+
- PM2 process manager
- `.env` file on the server

## 1. Prepare The VPS

```bash
ssh root@YOUR_VPS_IP
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2
node -v
npm -v
pm2 -v
```

## 2. Clone The Repository

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/PellerC/Telegram-Bot.git
cd Telegram-Bot
npm install
```

## 3. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Required:

```env
TELEGRAM_BOT_TOKEN=your_botfather_token
DATA_FILE=.data/bot-store.json
```

Optional:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
```

## 4. Test Before Running In Background

```bash
npm run build
npm start
```

Open Telegram and send `/start` to the bot. If it works, stop the process with `CTRL + C`.

## 5. Run With PM2

```bash
pm2 start npm --name airdrop-bot -- start
pm2 save
pm2 startup
```

After `pm2 startup`, PM2 prints a command. Copy and run that command.

Useful commands:

```bash
pm2 status
pm2 logs airdrop-bot
pm2 restart airdrop-bot
pm2 stop airdrop-bot
```

## 6. Update The Bot Later

```bash
cd /var/www/Telegram-Bot
git pull
npm install
npm run build
pm2 restart airdrop-bot
```

## Security Notes

- Never commit `.env`.
- Use a burner wallet model only for the MVP.
- Keep the VPS updated.
- Move from local JSON storage to PostgreSQL before handling many users.
- Do not store real user funds on wallets controlled by this bot.
