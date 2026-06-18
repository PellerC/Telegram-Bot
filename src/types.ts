export type RiskMode = "safe";

export type TaskStatus = "pending_approval" | "approved" | "running" | "completed" | "failed" | "paused";

export type TaskIntent =
  | "find_airdrops"
  | "create_daily_task"
  | "explain_campaign"
  | "show_progress"
  | "explain_crypto_term"
  | "unknown";

export type ParsedTask = {
  intent: TaskIntent;
  title: string;
  targets: string[];
  frequency: "once" | "daily" | "weekly";
  summary: string;
  permissions: string[];
  riskNotes: string[];
};

export type UserRecord = {
  telegramId: number;
  username?: string;
  firstName?: string;
  walletAddress: string;
  encryptedPrivateKey: string;
  riskMode: RiskMode;
  autoSignEnabled?: boolean;
  maxAutoSignValueWei?: string;
  createdAt: string;
  updatedAt?: string;
};

export type TaskRecord = {
  id: string;
  telegramId: number;
  request: string;
  parsed: ParsedTask;
  status: TaskStatus;
  logs: string[];
  createdAt: string;
  updatedAt: string;
};

export type StoreShape = {
  users: UserRecord[];
  tasks: TaskRecord[];
};

export type AgentReply = {
  reply: string;
  shouldCreateTask: boolean;
};
