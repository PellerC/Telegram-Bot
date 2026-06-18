import OpenAI from "openai";
import { z } from "zod";
import { config } from "./config.js";
import type { AgentReply, UserRecord } from "./types.js";

const agentReplySchema = z.object({
  reply: z.string().min(1),
  shouldCreateTask: z.boolean().default(false)
});

const openai = config.openAiApiKey
  ? new OpenAI({
      apiKey: config.openAiApiKey
    })
  : undefined;

export async function getAgentReply(user: UserRecord, message: string): Promise<AgentReply> {
  if (config.agentWebhookUrl) {
    const reply = await callAgentWebhook(user, message);
    if (reply) return reply;
  }

  if (openai) {
    const reply = await callOpenAiAgent(user, message);
    if (reply) return reply;
  }

  return fallbackAgentReply(message);
}

async function callAgentWebhook(user: UserRecord, message: string): Promise<AgentReply | undefined> {
  const response = await fetch(config.agentWebhookUrl!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.agentWebhookSecret ? { authorization: `Bearer ${config.agentWebhookSecret}` } : {})
    },
    body: JSON.stringify({
      user: {
        telegramId: user.telegramId,
        username: user.username,
        walletAddress: user.walletAddress,
        riskMode: user.riskMode,
        autoSignEnabled: user.autoSignEnabled ?? false
      },
      message
    })
  });

  if (!response.ok) {
    return undefined;
  }

  const json = await response.json();
  const parsed = agentReplySchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

async function callOpenAiAgent(user: UserRecord, message: string): Promise<AgentReply | undefined> {
  const response = await openai!.chat.completions.create({
    model: config.openAiModel,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are AirdropTasker, a friendly Telegram AI agent for crypto airdrop farming. Reply naturally and helpfully. If the user is asking you to do an actionable airdrop task, set shouldCreateTask true. If they are asking a question, asking for explanation, or chatting, set shouldCreateTask false. Return JSON only: {\"reply\":\"...\",\"shouldCreateTask\":true|false}. Never promise that a task is completed unless a worker result is provided."
      },
      {
        role: "user",
        content: [
          `Wallet: ${user.walletAddress}`,
          `Risk mode: ${user.riskMode}`,
          `Auto-sign: ${user.autoSignEnabled ? "on" : "off"}`,
          "",
          message
        ].join("\n")
      }
    ]
  });

  const content = response.choices[0]?.message.content;
  if (!content) return undefined;

  const parsed = agentReplySchema.safeParse(JSON.parse(content));
  return parsed.success ? parsed.data : undefined;
}

function fallbackAgentReply(message: string): AgentReply {
  const normalized = message.toLowerCase();
  const shouldCreateTask = [
    "claim",
    "farm",
    "do ",
    "complete",
    "run",
    "check in",
    "daily",
    "faucet",
    "quest"
  ].some((keyword) => normalized.includes(keyword));

  if (shouldCreateTask) {
    return {
      shouldCreateTask: true,
      reply:
        "Got it. I can prepare that as an airdrop task, show you what access I need, and wait for your approval before running it."
    };
  }

  return {
    shouldCreateTask: false,
    reply:
      "I can help you find airdrops, explain campaigns, create farming tasks, manage your burner wallet, and track what has been done. Tell me what you want to farm or ask me about any campaign."
  };
}
