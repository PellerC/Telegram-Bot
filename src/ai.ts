import OpenAI from "openai";
import { z } from "zod";
import { config } from "./config.js";
import type { ParsedTask } from "./types.js";

const parsedTaskSchema = z.object({
  intent: z.enum([
    "find_airdrops",
    "create_daily_task",
    "explain_campaign",
    "show_progress",
    "explain_crypto_term",
    "unknown"
  ]),
  title: z.string().min(3),
  targets: z.array(z.string()).default([]),
  frequency: z.enum(["once", "daily", "weekly"]),
  summary: z.string().min(10),
  permissions: z.array(z.string()).default([]),
  riskNotes: z.array(z.string()).default([])
});

const openai = config.openAiApiKey
  ? new OpenAI({
      apiKey: config.openAiApiKey
    })
  : undefined;

export async function parseTaskRequest(request: string): Promise<ParsedTask> {
  if (!openai) {
    return fallbackParse(request);
  }

  const response = await openai.chat.completions.create({
    model: config.openAiModel,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You turn Telegram messages into safe crypto airdrop automation plans. Return only JSON with: intent, title, targets, frequency, summary, permissions, riskNotes. Safe Mode is mandatory: no gas spending, no token approvals, no contract transactions without separate explicit approval."
      },
      {
        role: "user",
        content: request
      }
    ]
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    return fallbackParse(request);
  }

  const parsed = parsedTaskSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    return fallbackParse(request);
  }

  return parsed.data;
}

function fallbackParse(request: string): ParsedTask {
  const normalized = request.toLowerCase();
  const targets = extractTargets(normalized);
  const frequency = normalized.includes("weekly") ? "weekly" : normalized.includes("daily") || normalized.includes("every day") ? "daily" : "once";

  let intent: ParsedTask["intent"] = "unknown";
  if (normalized.includes("find") || normalized.includes("recommend")) {
    intent = "find_airdrops";
  } else if (normalized.includes("what is") || normalized.includes("explain")) {
    intent = "explain_crypto_term";
  } else if (normalized.includes("progress") || normalized.includes("history")) {
    intent = "show_progress";
  } else {
    intent = "create_daily_task";
  }

  return {
    intent,
    title: targets.length > 0 ? `${frequency} ${targets.join(", ")} task` : "Airdrop automation task",
    targets,
    frequency,
    summary:
      "I will prepare this as a Safe Mode airdrop task. I will not spend gas, approve tokens, or sign transactions without a separate confirmation.",
    permissions: [
      "Use the burner wallet address for eligibility checks",
      "Open public campaign or faucet pages",
      "Report back with completion status"
    ],
    riskNotes: [
      "Safe Mode blocks paid actions and token approvals",
      "Any wallet signature or transaction must be approved separately in a later version"
    ]
  };
}

function extractTargets(text: string) {
  const knownTargets = ["sui", "galxe", "layer3", "base", "optimism", "arbitrum", "zora", "linea", "scroll"];
  return knownTargets.filter((target) => text.includes(target));
}
