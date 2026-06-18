import crypto from "node:crypto";
import { Bot } from "grammy";
import { getAgentReply } from "./agent.js";
import { config } from "./config.js";
import { parseTaskRequest } from "./ai.js";
import {
  existingUserMessage,
  helpMessage,
  historyMessage,
  onboardingMessage,
  settingsMessage,
  taskApprovedMessage,
  taskPlanMessage
} from "./messages.js";
import { defaultAutoSignValueLimitWei, signStatusMessage } from "./signer.js";
import { createStore } from "./store.js";
import type { TaskRecord, UserRecord } from "./types.js";
import { simulateApprovedTask } from "./worker.js";
import { createBurnerWallet } from "./wallet.js";

const bot = new Bot(config.telegramBotToken);
const store = createStore();

bot.command("start", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply("I could not identify your Telegram account.");
    return;
  }

  const existingUser = await store.getUser(telegramId);
  if (existingUser) {
    await ctx.reply(existingUserMessage(existingUser));
    return;
  }

  const wallet = await createBurnerWallet();
  const user: UserRecord = {
    telegramId,
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
    walletAddress: wallet.address,
    encryptedPrivateKey: wallet.encryptedPrivateKey,
    riskMode: "safe",
    autoSignEnabled: false,
    maxAutoSignValueWei: defaultAutoSignValueLimitWei,
    createdAt: new Date().toISOString()
  };

  await store.upsertUser(user);
  await ctx.reply(onboardingMessage(user, wallet.mnemonic));
});

bot.command("help", async (ctx) => {
  await ctx.reply(helpMessage());
});

bot.command("wallet", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await store.getUser(telegramId);
  if (!user) {
    await ctx.reply("You need to start first: /start");
    return;
  }

  await ctx.reply(
    [`Wallet: ${user.walletAddress}`, `Mode: ${user.riskMode.toUpperCase()}`, `Auto-sign: ${user.autoSignEnabled ? "ON" : "OFF"}`].join(
      "\n"
    )
  );
});

bot.command("settings", async (ctx) => {
  await ctx.reply(settingsMessage());
});

async function createTaskPlan(telegramId: number, request: string) {
  const parsed = await parseTaskRequest(request);
  const now = new Date().toISOString();
  const task: TaskRecord = {
    id: crypto.randomBytes(4).toString("hex"),
    telegramId,
    request,
    parsed,
    status: "pending_approval",
    logs: ["Task created and awaiting approval."],
    createdAt: now,
    updatedAt: now
  };

  await store.addTask(task);
  return task;
}

bot.command("task", async (ctx) => {
  const telegramId = ctx.from?.id;
  const request = ctx.match?.trim();

  if (!telegramId) return;

  const user = await store.getUser(telegramId);
  if (!user) {
    await ctx.reply("You need to start first: /start");
    return;
  }

  if (!request) {
    await ctx.reply("Send a request like: /task do my daily Sui and Galxe airdrop tasks");
    return;
  }

  const task = await createTaskPlan(telegramId, request);
  await ctx.reply(taskPlanMessage(task));
});

bot.command("autosign_on", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await store.getUser(telegramId);
  if (!user) {
    await ctx.reply("You need to start first: /start");
    return;
  }

  await store.upsertUser({
    ...user,
    autoSignEnabled: true,
    maxAutoSignValueWei: user.maxAutoSignValueWei ?? defaultAutoSignValueLimitWei,
    updatedAt: new Date().toISOString()
  });

  await ctx.reply(
    [
      "Auto-sign is now ON for this burner wallet.",
      "",
      "Current limit: 0 ETH transaction value.",
      "It only applies to tasks you approve first. Token approvals and paid actions are still blocked by default."
    ].join("\n")
  );
});

bot.command("autosign_off", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await store.getUser(telegramId);
  if (!user) {
    await ctx.reply("You need to start first: /start");
    return;
  }

  await store.upsertUser({
    ...user,
    autoSignEnabled: false,
    updatedAt: new Date().toISOString()
  });

  await ctx.reply("Auto-sign is now OFF.");
});

bot.command("sign_test", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await store.getUser(telegramId);
  if (!user) {
    await ctx.reply("You need to start first: /start");
    return;
  }

  try {
    const result = await signStatusMessage(user);
    await ctx.reply(
      [
        "Burner wallet signing works.",
        "",
        `Address: ${result.address}`,
        `Message: ${result.message}`,
        `Signature: ${result.signature}`
      ].join("\n")
    );
  } catch {
    await ctx.reply(
      [
        "I could not decrypt this wallet for signing.",
        "",
        "If this wallet was created before the auto-sign upgrade, create a fresh burner wallet after setting WALLET_ENCRYPTION_KEY on the VPS."
      ].join("\n")
    );
  }
});

bot.command("reset_wallet_confirm", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const existingUser = await store.getUser(telegramId);
  if (!existingUser) {
    await ctx.reply("You need to start first: /start");
    return;
  }

  const wallet = await createBurnerWallet();
  const user: UserRecord = {
    ...existingUser,
    walletAddress: wallet.address,
    encryptedPrivateKey: wallet.encryptedPrivateKey,
    autoSignEnabled: false,
    maxAutoSignValueWei: defaultAutoSignValueLimitWei,
    updatedAt: new Date().toISOString()
  };

  await store.upsertUser(user);
  await ctx.reply(
    [
      "Your burner wallet has been reset.",
      "",
      `New wallet: ${user.walletAddress}`,
      "",
      "Write this seed phrase down now. This MVP will not show it again:",
      wallet.mnemonic,
      "",
      "Auto-sign is OFF. Use /sign_test first, then /autosign_on when you are ready."
    ].join("\n")
  );
});

bot.command("approve", async (ctx) => {
  const telegramId = ctx.from?.id;
  const taskId = ctx.match?.trim();

  if (!telegramId) return;

  if (!taskId) {
    await ctx.reply("Use: /approve <task_id>");
    return;
  }

  const task = await store.getTask(telegramId, taskId);
  if (!task) {
    await ctx.reply("I could not find that task.");
    return;
  }

  if (task.status !== "pending_approval") {
    await ctx.reply(`That task is currently ${task.status}.`);
    return;
  }

  const approvedTask: TaskRecord = {
    ...task,
    status: "approved",
    updatedAt: new Date().toISOString(),
    logs: [...task.logs, "Approved by user."]
  };
  await store.updateTask(approvedTask);
  await ctx.reply(taskApprovedMessage(approvedTask));

  const completedTask = await simulateApprovedTask(store, approvedTask);
  await ctx.reply([`Completed: ${completedTask.parsed.title}`, "", completedTask.logs.at(-1)].join("\n"));
});

bot.command("history", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const tasks = await store.getTasksForUser(telegramId);
  await ctx.reply(historyMessage(tasks));
});

bot.command("pause", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await store.pauseUserTasks(telegramId);
  await ctx.reply("Paused all active and pending tasks.");
});

bot.on("message:text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) {
    await ctx.reply("I do not recognize that command. Try /help");
    return;
  }

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await store.getUser(telegramId);
  if (!user) {
    await ctx.reply("You need to start first: /start");
    return;
  }

  const agentReply = await getAgentReply(user, ctx.message.text);
  await ctx.reply(agentReply.reply);

  if (agentReply.shouldCreateTask) {
    const task = await createTaskPlan(telegramId, ctx.message.text);
    await ctx.reply(taskPlanMessage(task));
  }
});

await store.init();
bot.catch((error) => {
  console.error("Bot error", error);
});

console.log("Telegram AI Airdrop Bot is running");
await bot.start();
