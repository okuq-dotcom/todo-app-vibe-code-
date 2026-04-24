import { useCallback, useEffect, useState } from "react";
import { Tabs, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/colors";
import { getTodayTasks, getDailyTasks, getDailyStatus } from "../../src/storage";
import { requestNotificationPermission, updateBadgeCount } from "../../src/badge";

export default function TabsLayout() {
  const [todayBadge, setTodayBadge] = useState<number | undefined>(undefined);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const updateBadge = useCallback(async () => {
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
    setTodayBadge(total > 0 ? total : undefined);
    await updateBadgeCount();
  }, []);

  useFocusEffect(
    useCallback(() => {
      updateBadge();
      const interval = setInterval(updateBadge, 5000);
      return () => clearInterval(interval);
    }, [updateBadge])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: { backgroundColor: Colors.surface },
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" size={size} color={color} />
          ),
          tabBarBadge: todayBadge,
          tabBarBadgeStyle: {
            backgroundColor: Colors.danger,
            fontSize: 11,
            minWidth: 18,
            height: 18,
          },
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
