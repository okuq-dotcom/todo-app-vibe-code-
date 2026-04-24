import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getTodayTasks, getDailyTasks, getDailyStatus } from "./storage";

// Use new channel ID to force recreation with correct settings
const CHANNEL_ID = "todo-tasks-v2";

let lastBadgeCount: number | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Task Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: true,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function updateBadgeCount(): Promise<void> {
  try {
    const hasPermission = await Notifications.getPermissionsAsync();
    if (hasPermission.status !== "granted") return;

    const [tasks, dailyTasks, dailyStatus] = await Promise.all([
      getTodayTasks(),
      getDailyTasks(),
      getDailyStatus(),
    ]);
    const undoneToday = tasks.filter((t) => !t.done).length;
    const undoneDaily = dailyTasks.filter(
      (d) => !dailyStatus.doneIds.includes(d.id)
    ).length;
    const total = undoneToday + undoneDaily;

    if (total === lastBadgeCount) return;
    lastBadgeCount = total;

    await Notifications.setBadgeCountAsync(total);

    await Notifications.dismissAllNotificationsAsync();
    if (total > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "To Do",
          body: `${total} tasks remaining`,
          badge: total,
          ...(Platform.OS === "android" && {
            channelId: CHANNEL_ID,
          }),
        },
        trigger: null,
      });
    }
  } catch (e) {
    console.log("Badge error:", e);
  }
}
