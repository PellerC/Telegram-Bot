import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { StoreShape, TaskRecord, UserRecord } from "./types.js";

const emptyStore = (): StoreShape => ({
  users: [],
  tasks: []
});

export class JsonStore {
  constructor(private readonly filePath: string) {}

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      await readFile(this.filePath, "utf8");
    } catch {
      await this.write(emptyStore());
    }
  }

  async getUser(telegramId: number) {
    const store = await this.read();
    return store.users.find((user) => user.telegramId === telegramId);
  }

  async upsertUser(user: UserRecord) {
    const store = await this.read();
    const existingIndex = store.users.findIndex((item) => item.telegramId === user.telegramId);

    if (existingIndex >= 0) {
      store.users[existingIndex] = user;
    } else {
      store.users.push(user);
    }

    await this.write(store);
  }

  async addTask(task: TaskRecord) {
    const store = await this.read();
    store.tasks.push(task);
    await this.write(store);
  }

  async getTask(telegramId: number, taskId: string) {
    const store = await this.read();
    return store.tasks.find((task) => task.telegramId === telegramId && task.id === taskId);
  }

  async updateTask(updatedTask: TaskRecord) {
    const store = await this.read();
    const index = store.tasks.findIndex((task) => task.id === updatedTask.id);

    if (index < 0) {
      throw new Error(`Task ${updatedTask.id} was not found`);
    }

    store.tasks[index] = updatedTask;
    await this.write(store);
  }

  async getTasksForUser(telegramId: number, limit = 5) {
    const store = await this.read();
    return store.tasks
      .filter((task) => task.telegramId === telegramId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async pauseUserTasks(telegramId: number) {
    const store = await this.read();
    const now = new Date().toISOString();

    store.tasks = store.tasks.map((task) => {
      if (task.telegramId !== telegramId || task.status === "completed" || task.status === "failed") {
        return task;
      }

      return {
        ...task,
        status: "paused",
        updatedAt: now,
        logs: [...task.logs, "Paused by user."]
      };
    });

    await this.write(store);
  }

  private async read(): Promise<StoreShape> {
    const raw = await readFile(this.filePath, "utf8");
    return JSON.parse(raw) as StoreShape;
  }

  private async write(store: StoreShape) {
    await writeFile(this.filePath, `${JSON.stringify(store, null, 2)}\n`);
  }
}
