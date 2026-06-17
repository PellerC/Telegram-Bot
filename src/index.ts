import crypto from "node:crypto";
import { Bot } from "grammy";
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
import { JsonStore } from "./store.js";
import type { TaskRecord, UserRecord } from "./types.js";
import { simulateApprovedTask } from "./worker.js";
import { createBurnerWallet } from "./wallet.js";

const bot = new Bot(config.telegramBotToken);
const store = new JsonStore(config.dataFile);

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

  const password = crypto.randomBytes(32).toString("hex");
  const wallet = await createBurnerWallet(password);
  const user: UserRecord = {
    telegramId,
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
    walletAddress: wallet.address,
    encryptedPrivateKey: wallet.encryptedPrivateKey,
    riskMode: "safe",
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

  await ctx.reply([`Wallet: ${user.walletAddress}`, `Mode: ${user.riskMode.toUpperCase()}`].join("\n"));
});

bot.command("settings", async (ctx) => {
  await ctx.reply(settingsMessage());
});

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
  await ctx.reply(taskPlanMessage(task));
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

  await ctx.reply("To create a task, send it like this:\n/task find low-risk airdrops for me");
});

await store.init();
bot.catch((error) => {
  console.error("Bot error", error);
});

console.log("Telegram AI Airdrop Bot is running");
await bot.start();
