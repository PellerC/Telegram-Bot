import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { config } from "./config.js";
import type { StoreShape, TaskRecord, UserRecord } from "./types.js";

export type Store = {
  init(): Promise<void>;
  getUser(telegramId: number): Promise<UserRecord | undefined>;
  upsertUser(user: UserRecord): Promise<void>;
  addTask(task: TaskRecord): Promise<void>;
  getTask(telegramId: number, taskId: string): Promise<TaskRecord | undefined>;
  updateTask(updatedTask: TaskRecord): Promise<void>;
  getTasksForUser(telegramId: number, limit?: number): Promise<TaskRecord[]>;
  pauseUserTasks(telegramId: number): Promise<void>;
};

const emptyStore = (): StoreShape => ({
  users: [],
  tasks: []
});

export class JsonStore implements Store {
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

type PgPool = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type UserRow = {
  telegram_id: string;
  username?: string;
  first_name?: string;
  wallet_address: string;
  encrypted_private_key: string;
  risk_mode: UserRecord["riskMode"];
  auto_sign_enabled: boolean;
  max_auto_sign_value_wei: string;
  created_at: Date;
  updated_at?: Date;
};

type TaskRow = {
  id: string;
  telegram_id: string;
  request: string;
  parsed: TaskRecord["parsed"];
  status: TaskRecord["status"];
  logs: string[];
  created_at: Date;
  updated_at: Date;
};

export class PostgresStore implements Store {
  private readonly pool: PgPool;

  constructor(databaseUrl: string) {
    const require = createRequire(import.meta.url);
    const { Pool } = require("pg") as { Pool: new (options: { connectionString: string }) => PgPool };
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async init() {
    await this.pool.query(`
      create table if not exists users (
        telegram_id bigint primary key,
        username text,
        first_name text,
        wallet_address text not null,
        encrypted_private_key text not null,
        risk_mode text not null default 'safe',
        auto_sign_enabled boolean not null default false,
        max_auto_sign_value_wei text not null default '0',
        created_at timestamptz not null default now(),
        updated_at timestamptz
      )
    `);

    await this.pool.query(`
      create table if not exists tasks (
        id text primary key,
        telegram_id bigint not null references users(telegram_id) on delete cascade,
        request text not null,
        parsed jsonb not null,
        status text not null,
        logs jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);

    await this.pool.query("create index if not exists tasks_telegram_id_created_at_idx on tasks (telegram_id, created_at desc)");
  }

  async getUser(telegramId: number) {
    const result = await this.pool.query<UserRow>("select * from users where telegram_id = $1", [telegramId]);
    const row = result.rows[0];
    return row ? this.mapUser(row) : undefined;
  }

  async upsertUser(user: UserRecord) {
    await this.pool.query(
      `
        insert into users (
          telegram_id, username, first_name, wallet_address, encrypted_private_key,
          risk_mode, auto_sign_enabled, max_auto_sign_value_wei, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (telegram_id) do update set
          username = excluded.username,
          first_name = excluded.first_name,
          wallet_address = excluded.wallet_address,
          encrypted_private_key = excluded.encrypted_private_key,
          risk_mode = excluded.risk_mode,
          auto_sign_enabled = excluded.auto_sign_enabled,
          max_auto_sign_value_wei = excluded.max_auto_sign_value_wei,
          updated_at = excluded.updated_at
      `,
      [
        user.telegramId,
        user.username,
        user.firstName,
        user.walletAddress,
        user.encryptedPrivateKey,
        user.riskMode,
        user.autoSignEnabled ?? false,
        user.maxAutoSignValueWei ?? "0",
        user.createdAt,
        user.updatedAt ?? null
      ]
    );
  }

  async addTask(task: TaskRecord) {
    await this.pool.query(
      `
        insert into tasks (id, telegram_id, request, parsed, status, logs, created_at, updated_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [task.id, task.telegramId, task.request, task.parsed, task.status, task.logs, task.createdAt, task.updatedAt]
    );
  }

  async getTask(telegramId: number, taskId: string) {
    const result = await this.pool.query<TaskRow>("select * from tasks where telegram_id = $1 and id = $2", [telegramId, taskId]);
    const row = result.rows[0];
    return row ? this.mapTask(row) : undefined;
  }

  async updateTask(task: TaskRecord) {
    const result = await this.pool.query(
      `
        update tasks
        set request = $3, parsed = $4, status = $5, logs = $6, updated_at = $7
        where telegram_id = $1 and id = $2
      `,
      [task.telegramId, task.id, task.request, task.parsed, task.status, task.logs, task.updatedAt]
    );

    if (!("rowCount" in result) || result.rowCount === 0) {
      throw new Error(`Task ${task.id} was not found`);
    }
  }

  async getTasksForUser(telegramId: number, limit = 5) {
    const result = await this.pool.query<TaskRow>(
      "select * from tasks where telegram_id = $1 order by created_at desc limit $2",
      [telegramId, limit]
    );
    return result.rows.map((row) => this.mapTask(row));
  }

  async pauseUserTasks(telegramId: number) {
    await this.pool.query(
      `
        update tasks
        set status = 'paused',
          updated_at = now(),
          logs = logs || '["Paused by user."]'::jsonb
        where telegram_id = $1 and status not in ('completed', 'failed')
      `,
      [telegramId]
    );
  }

  private mapUser(row: UserRow): UserRecord {
    return {
      telegramId: Number(row.telegram_id),
      username: row.username,
      firstName: row.first_name,
      walletAddress: row.wallet_address,
      encryptedPrivateKey: row.encrypted_private_key,
      riskMode: row.risk_mode,
      autoSignEnabled: row.auto_sign_enabled,
      maxAutoSignValueWei: row.max_auto_sign_value_wei,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at?.toISOString()
    };
  }

  private mapTask(row: TaskRow): TaskRecord {
    return {
      id: row.id,
      telegramId: Number(row.telegram_id),
      request: row.request,
      parsed: row.parsed,
      status: row.status,
      logs: row.logs,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}

export function createStore(): Store {
  if (config.databaseUrl) {
    return new PostgresStore(config.databaseUrl);
  }

  return new JsonStore(config.dataFile);
}
