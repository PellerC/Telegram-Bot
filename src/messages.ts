import type { ParsedTask, TaskRecord, UserRecord } from "./types.js";

export function helpMessage() {
  return [
    "Telegram AI Airdrop Bot",
    "",
    "Commands:",
    "/start - set up your Safe Mode burner wallet",
    "/wallet - show your wallet address",
    "/task <request> - ask for an airdrop task",
    "/approve <task_id> - approve a pending task",
    "/history - show recent tasks",
    "/pause - pause active tasks",
    "/settings - show safety rules"
  ].join("\n");
}

export function onboardingMessage(user: UserRecord, mnemonic: string) {
  return [
    "You are set up in Safe Mode.",
    "",
    `Wallet: ${user.walletAddress}`,
    "",
    "Write this seed phrase down now. This MVP will not show it again:",
    mnemonic,
    "",
    "Safety rules:",
    "- burner wallet only",
    "- no gas spending",
    "- no token approvals",
    "- no contract transactions without a separate approval",
    "",
    "Try: /task do my daily Sui and Galxe airdrop tasks"
  ].join("\n");
}

export function existingUserMessage(user: UserRecord) {
  return [
    "You are already onboarded.",
    "",
    `Wallet: ${user.walletAddress}`,
    `Mode: ${user.riskMode.toUpperCase()}`,
    "",
    "Try: /task find low-risk airdrops for me"
  ].join("\n");
}

export function taskPlanMessage(task: TaskRecord) {
  return [
    `Task plan: ${task.parsed.title}`,
    "",
    task.parsed.summary,
    "",
    `Frequency: ${task.parsed.frequency}`,
    `Targets: ${task.parsed.targets.length ? task.parsed.targets.join(", ") : "not specified"}`,
    "",
    "Permissions needed:",
    ...task.parsed.permissions.map((permission) => `- ${permission}`),
    "",
    "Risk notes:",
    ...task.parsed.riskNotes.map((note) => `- ${note}`),
    "",
    `Approve with: /approve ${task.id}`
  ].join("\n");
}

export function taskApprovedMessage(task: TaskRecord) {
  return [
    `Approved: ${task.parsed.title}`,
    "",
    "I queued this in Safe Mode. For this MVP, execution is simulated so we can validate the chat, approval, and reporting flow first.",
    "",
    `Task ID: ${task.id}`
  ].join("\n");
}

export function historyMessage(tasks: TaskRecord[]) {
  if (tasks.length === 0) {
    return "No tasks yet. Try: /task find low-risk airdrops for me";
  }

  return [
    "Recent tasks:",
    "",
    ...tasks.map((task) => {
      return [`${task.id} - ${task.status}`, task.parsed.title, `Updated: ${task.updatedAt}`].join("\n");
    })
  ].join("\n\n");
}

export function settingsMessage() {
  return [
    "Current mode: SAFE",
    "",
    "Safe Mode rules:",
    "- no gas spending",
    "- no token approvals",
    "- no paid tasks",
    "- no unknown contract interactions",
    "- explain before action, approve before execution"
  ].join("\n");
}

export function formatParsedAnswer(parsed: ParsedTask) {
  return [parsed.title, "", parsed.summary, "", ...parsed.riskNotes.map((note) => `- ${note}`)].join("\n");
}
