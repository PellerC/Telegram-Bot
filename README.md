# Telegram AI Airdrop Bot

Telegram-first MVP for an AI airdrop assistant. The bot supports onboarding, safe-mode burner wallet creation, natural-language task intake, approval, pause, and history.

## Setup

1. Create a Telegram bot with BotFather and copy the token.
2. Copy `.env.example` to `.env`.
3. Fill `TELEGRAM_BOT_TOKEN`.
4. Optionally fill `OPENAI_API_KEY` for AI parsing.
5. Install dependencies and run:

```bash
npm install
npm run dev
```

## Commands

- `/start` - onboard and create a Safe Mode burner wallet
- `/wallet` - show wallet address
- `/task <request>` - describe an airdrop task in normal language
- `/approve <task_id>` - approve a pending task for automation
- `/history` - show recent task activity
- `/pause` - pause active and pending tasks
- `/settings` - show safety rules
- `/help` - show command list

## Safety Model For MVP

This first version is Safe Mode only:

- no gas spending
- no token approvals
- no contract interactions without explicit future confirmation
- burner wallet only
- tasks are planned and approved before execution

The current worker simulates execution. Real campaign automation should be added target-by-target with strict policy checks.
