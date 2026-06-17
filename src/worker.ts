import type { JsonStore } from "./store.js";
import type { TaskRecord } from "./types.js";

export async function simulateApprovedTask(store: JsonStore, task: TaskRecord) {
  const now = new Date().toISOString();

  const runningTask: TaskRecord = {
    ...task,
    status: "running",
    updatedAt: now,
    logs: [...task.logs, "Execution started in Safe Mode."]
  };
  await store.updateTask(runningTask);

  const completedTask: TaskRecord = {
    ...runningTask,
    status: "completed",
    updatedAt: new Date().toISOString(),
    logs: [
      ...runningTask.logs,
      "Simulated browser/API execution completed.",
      "No gas, signatures, or token approvals were performed."
    ]
  };
  await store.updateTask(completedTask);

  return completedTask;
}
