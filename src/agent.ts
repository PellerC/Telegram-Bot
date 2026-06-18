import OpenAI from "openai";
import { z } from "zod";
import { config } from "./config.js";
import type { AgentReply, TaskRecord, UserRecord } from "./types.js";

const agentReplySchema = z.object({
  reply: z.string().min(1),
  action: z
    .enum(["answer", "create_task", "show_history", "show_wallet", "pause_tasks", "show_settings", "remember"])
    .default("answer"),
  memoryPatch: z.string().optional()
});

const openai = config.openAiApiKey
  ? new OpenAI({
      apiKey: config.openAiApiKey
    })
  : undefined;

export async function getAgentReply(user: UserRecord, recentTasks: TaskRecord[], message: string): Promise<AgentReply> {
  if (config.agentWebhookUrl) {
    const reply = await callAgentWebhook(user, recentTasks, message);
    if (reply) return reply;
  }

  if (openai) {
    const reply = await callOpenAiAgent(user, recentTasks, message);
    if (reply) return reply;
  }

  return fallbackAgentReply(message);
}

async function callAgentWebhook(user: UserRecord, recentTasks: TaskRecord[], message: string): Promise<AgentReply | undefined> {
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
        autoSignEnabled: user.autoSignEnabled ?? false,
        memoryMarkdown: user.memoryMarkdown
      },
      recentTasks,
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

async function callOpenAiAgent(user: UserRecord, recentTasks: TaskRecord[], message: string): Promise<AgentReply | undefined> {
  const response = await openai!.chat.completions.create({
    model: config.openAiModel,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          [
            "You are AirdropTasker, a friendly Telegram AI mini-agent for crypto airdrop farming.",
            "Each Telegram user has their own memory profile, burner wallet, task history, and safety settings.",
            "Reply naturally, like a helpful agent, not like a form.",
            "Choose exactly one action:",
            "- answer: answer, explain, ask a follow-up, or guide the user.",
            "- create_task: the user is asking you to perform/farm/claim/check/complete an airdrop task.",
            "- show_history: user asks what you did, progress, logs, or history.",
            "- show_wallet: user asks for wallet/address.",
            "- pause_tasks: user asks to pause/stop tasks.",
            "- show_settings: user asks about safety, auto-sign, limits, or settings.",
            "- remember: user gives a preference to remember.",
            "For remember, include a concise markdown bullet in memoryPatch.",
            "Never claim a real-world task is completed unless a worker result says so.",
            "Return JSON only: {\"reply\":\"...\",\"action\":\"answer|create_task|show_history|show_wallet|pause_tasks|show_settings|remember\",\"memoryPatch\":\"optional\"}."
          ].join("\n")
      },
      {
        role: "user",
        content: [
          `Wallet: ${user.walletAddress}`,
          `Risk mode: ${user.riskMode}`,
          `Auto-sign: ${user.autoSignEnabled ? "on" : "off"}`,
          "",
          "User memory:",
          user.memoryMarkdown || "No saved memory yet.",
          "",
          "Recent tasks:",
          recentTasks.length
            ? recentTasks.map((task) => `- ${task.parsed.title}: ${task.status}`).join("\n")
            : "- No recent tasks.",
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

  if (normalized.includes("wallet") || normalized.includes("address")) {
    return {
      action: "show_wallet",
      reply: "Here is your burner wallet."
    };
  }

  if (normalized.includes("history") || normalized.includes("progress") || normalized.includes("what did you do")) {
    return {
      action: "show_history",
      reply: "Here is your recent task history."
    };
  }

  if (normalized.includes("pause") || normalized.includes("stop all")) {
    return {
      action: "pause_tasks",
      reply: "I will pause your active and pending tasks."
    };
  }

  if (normalized.includes("remember") || normalized.includes("prefer") || normalized.includes("avoid")) {
    return {
      action: "remember",
      reply: "Got it. I will remember that for your future airdrop tasks.",
      memoryPatch: `- ${message}`
    };
  }

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
      action: "create_task",
      reply:
        "Got it. I can prepare that as an airdrop task, show you what access I need, and wait for your approval before running it."
    };
  }

  return {
    action: "answer",
    reply:
      "I can help you find airdrops, explain campaigns, create farming tasks, manage your burner wallet, and track what has been done. Tell me what you want to farm or ask me about any campaign."
  };
}
