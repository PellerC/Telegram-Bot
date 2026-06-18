import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  telegramBotToken: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  openAiApiKey: z.string().optional(),
  openAiModel: z.string().default("gpt-4.1-mini"),
  agentWebhookUrl: z.string().url().optional(),
  agentWebhookSecret: z.string().optional(),
  walletEncryptionKey: z.string().min(24).optional(),
  dataFile: z.string().default(".data/bot-store.json"),
  databaseUrl: z.string().optional()
});

export const config = configSchema.parse({
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  openAiApiKey: process.env.OPENAI_API_KEY || undefined,
  openAiModel: process.env.OPENAI_MODEL,
  agentWebhookUrl: process.env.AGENT_WEBHOOK_URL || undefined,
  agentWebhookSecret: process.env.AGENT_WEBHOOK_SECRET || undefined,
  walletEncryptionKey: process.env.WALLET_ENCRYPTION_KEY || undefined,
  dataFile: process.env.DATA_FILE,
  databaseUrl: process.env.DATABASE_URL || undefined
});
