import type { ParsedTask, TaskRecord, UserRecord } from "./types.js";

export function helpMessage() {
  return [
    "Telegram AI Airdrop Bot",
    "",
    "Commands:",
    "/start - set up your Safe Mode burner wallet",
    "/wallet - show your wallet address",
    "/profile - show what your mini-agent remembers",
    "/remember <preference> - add a preference to your mini-agent profile",
    "/task <request> - ask for an airdrop task",
    "/approve <task_id> - approve a pending task",
    "/autosign_on - allow burner-wallet signing for approved zero-value tasks",
    "/autosign_off - disable automatic signing",
    "/sign_test - sign a harmless message to test the burner wallet",
    "/reset_wallet_confirm - replace your burner wallet",
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
    "- auto-sign is OFF by default",
    "- auto-sign only applies after you approve a task",
    "- default auto-sign limit is 0 ETH value",
    "- no token approvals unless a later policy explicitly allows them",
    "",
    "Now just tell me what you want to do, like: claim faucets for me or find low-risk airdrops."
  ].join("\n");
}

export function defaultMemoryMarkdown(user: UserRecord) {
  return [
    `# User ${user.username ? `@${user.username}` : user.telegramId}`,
    "",
    "## Preferences",
    "- Risk mode: Safe",
    "- Prefer low-cost or free airdrop tasks",
    "- Avoid paid tasks unless the user clearly approves",
    "- Ask before signatures, token approvals, or spending gas",
    "",
    "## Goals",
    "- Discover useful airdrop opportunities",
    "- Turn casual Telegram messages into clear task plans",
    "- Keep task updates short and understandable",
    "",
    "## Notes",
    "- No extra preferences saved yet"
  ].join("\n");
}

export function profileMessage(user: UserRecord) {
  return [
    "Here is what your mini-agent remembers:",
    "",
    user.memoryMarkdown || defaultMemoryMarkdown(user)
  ].join("\n");
}

export function existingUserMessage(user: UserRecord) {
  return [
    "You are already onboarded.",
    "",
    `Wallet: ${user.walletAddress}`,
    `Mode: ${user.riskMode.toUpperCase()}`,
    `Auto-sign: ${user.autoSignEnabled ? "ON" : "OFF"}`,
    "",
    "Tell me what you want to farm, claim, check, or understand."
  ].join("\n");
}

export function taskPlanMessage(task: TaskRecord) {
  return [
    `I can help with this: ${task.parsed.title}`,
    "",
    task.parsed.summary,
    "",
    `How often: ${task.parsed.frequency}`,
    `Where: ${task.parsed.targets.length ? task.parsed.targets.join(", ") : "I need you to name the chain or platform"}`,
    "",
    "What I need permission to do:",
    ...task.parsed.permissions.map((permission) => `- ${permission}`),
    "",
    "Safety limits:",
    ...task.parsed.riskNotes.map((note) => `- ${note}`),
    "",
    `If this looks right, approve it with: /approve ${task.id}`
  ].join("\n");
}

export function taskApprovedMessage(task: TaskRecord) {
  return [
    `Approved: ${task.parsed.title}`,
    "",
    "I queued this in Safe Mode. For this MVP, execution is simulated so we can validate the chat, approval, and reporting flow first.",
    "If auto-sign is enabled, future real workers can sign approved burner-wallet actions inside your limits.",
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
    "- no token approvals by default",
    "- no paid tasks by default",
    "- no unknown contract interactions",
    "- auto-sign is optional and only for approved tasks",
    "- explain before action, approve before execution"
  ].join("\n");
}

export function formatParsedAnswer(parsed: ParsedTask) {
  return [parsed.title, "", parsed.summary, "", ...parsed.riskNotes.map((note) => `- ${note}`)].join("\n");
}
