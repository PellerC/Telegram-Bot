import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  telegramBotToken: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  openAiApiKey: z.string().optional(),
  openAiModel: z.string().default("gpt-4.1-mini"),
  dataFile: z.string().default(".data/bot-store.json")
});

export const config = configSchema.parse({
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  openAiApiKey: process.env.OPENAI_API_KEY || undefined,
  openAiModel: process.env.OPENAI_MODEL,
  dataFile: process.env.DATA_FILE
});
