export const TELEGRAM_TASK_ID = "telegram_join";
export const TELEGRAM_GROUP_URL = "https://t.me/opiniatedng";
export const TELEGRAM_TASK_REWARD_UNITS = 1; // 1 OPN (100 units = $1.00, 1 unit = 1 OPN)
export const TASK_PROVIDER_ID = "task";

export type TaskDefinition = {
  id: string;
  title: string;
  description: string;
  rewardUnits: number;
  actionUrl: string;
  actionLabel: string;
};

export const TASKS: Record<string, TaskDefinition> = {
  [TELEGRAM_TASK_ID]: {
    id: TELEGRAM_TASK_ID,
    title: "Join our Telegram community",
    description: "Join the official Opiniated Telegram group to get real-time survey alerts, announcements, and platform updates.",
    rewardUnits: TELEGRAM_TASK_REWARD_UNITS,
    actionUrl: TELEGRAM_GROUP_URL,
    actionLabel: "Join Telegram Group",
  },
};
