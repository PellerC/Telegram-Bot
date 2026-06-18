# VPS Deployment

This bot is a long-running Telegram polling process. The simplest production setup is:

- Ubuntu VPS
- Node.js 22+
- PostgreSQL for public users
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

## 2. Install PostgreSQL

Use PostgreSQL for the public bot. This keeps each user's wallet, task history, approvals, and settings separate.

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Create a database and user:

```bash
sudo -u postgres psql
```

Inside the PostgreSQL prompt, run:

```sql
create database airdrop_bot;
create user airdrop_bot with encrypted password 'CHANGE_THIS_PASSWORD';
grant all privileges on database airdrop_bot to airdrop_bot;
\c airdrop_bot
grant all on schema public to airdrop_bot;
\q
```

## 3. Clone The Repository

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/PellerC/Telegram-Bot.git
cd Telegram-Bot
npm install
```

## 4. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Required:

```env
TELEGRAM_BOT_TOKEN=your_botfather_token
WALLET_ENCRYPTION_KEY=generate_with_openssl_rand_hex_32
DATABASE_URL=postgresql://airdrop_bot:CHANGE_THIS_PASSWORD@localhost:5432/airdrop_bot
```

Optional:

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

Generate `WALLET_ENCRYPTION_KEY` with:

```bash
openssl rand -hex 32
```

## 5. Test Before Running In Background

```bash
npm run build
npm start
```

Open Telegram and send `/start` to the bot. If it works, stop the process with `CTRL + C`.

## 6. Run With PM2

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

## 7. Update The Bot Later

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
