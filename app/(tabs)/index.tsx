import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Task, Project, DailyTask } from "../../src/types";
import {
  getTodayTasks,
  toggleTaskDone,
  getProjects,
  getDailyTasks,
  getDailyStatus,
  resetDailyStatus,
  addDailyTask,
  deleteDailyTask,
  toggleDailyTaskDone,
  getMemo,
  saveMemo,
} from "../../src/storage";
import { Colors } from "../../src/colors";

export default function TodayScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showDone, setShowDone] = useState(false);

  // Daily tasks
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [dailyDoneIds, setDailyDoneIds] = useState<string[]>([]);
  const [newDaily, setNewDaily] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Memo
  const [memo, setMemo] = useState("");

  const load = useCallback(async () => {
    const [t, p, dt, ds, m] = await Promise.all([
      getTodayTasks(),
      getProjects(),
      getDailyTasks(),
      getDailyStatus(),
      getMemo(),
    ]);
    setTasks(t);
    setProjects(p);
    setDailyTasks(dt);
    setDailyDoneIds(ds.doneIds);
    setMemo(m);
  }, []);

  const handleMemoChange = async (text: string) => {
    setMemo(text);
    await saveMemo(text);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  // Sort tasks by project order (matching Projects tab), then keep original order within
  const projectOrderMap = Object.fromEntries(
    projects.map((p, i) => [p.id, i])
  );
  const sortedTasks = [...tasks].sort((a, b) => {
    const ai = projectOrderMap[a.projectId] ?? 999;
    const bi = projectOrderMap[b.projectId] ?? 999;
    return ai - bi;
  });
  const visible = showDone ? sortedTasks : sortedTasks.filter((t) => !t.done);
  const doneCount = tasks.filter((t) => t.done).length;

  const handleToggle = async (id: string) => {
    await toggleTaskDone(id);
    await load();
  };

  const handleToggleDaily = async (id: string) => {
    await toggleDailyTaskDone(id);
    await load();
  };

  const handleAddDaily = async () => {
    const trimmed = newDaily.trim();
    if (!trimmed) return;
    await addDailyTask(trimmed);
    setNewDaily("");
    setShowModal(false);
    await load();
  };

  const handleDeleteDaily = (item: DailyTask) => {
    Alert.alert("Delete", `"${item.title}" to delete?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDailyTask(item.id);
          await load();
        },
      },
    ]);
  };

  const handleResetDaily = async () => {
    await resetDailyStatus();
    await load();
  };

  const dailyDoneCount = dailyTasks.filter((d) =>
    dailyDoneIds.includes(d.id)
  ).length;

  const scrollRef = useRef<ScrollView>(null);

  const handleMemoFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* --- Today's Tasks Section --- */}
        <Text style={styles.sectionTitle}>Today</Text>

        {tasks.length === 0 ? (
          <View style={styles.emptySmall}>
            <Text style={styles.emptyText}>
              No tasks for today — add from a project
            </Text>
          </View>
        ) : (
          <>
            {visible.map((item) => {
              const project = projectMap[item.projectId];
              return (
                <View
                  key={item.id}
                  style={styles.taskRow}
                >
                  <TouchableOpacity onPress={() => handleToggle(item.id)} hitSlop={8}>
                    <Ionicons
                      name={item.done ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={item.done ? Colors.done : Colors.primary}
                    />
                  </TouchableOpacity>
                  <View style={styles.taskContent}>
                    <Text
                      style={[styles.taskTitle, item.done && styles.taskDone]}
                    >
                      {item.title}
                    </Text>
                    {project && (
                      <Text
                        style={[styles.projectLabel, { color: project.color }]}
                      >
                        {project.name}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
            {doneCount > 0 && (
              <TouchableOpacity
                style={styles.toggleDone}
                onPress={() => setShowDone(!showDone)}
              >
                <Text style={styles.toggleDoneText}>
                  {showDone ? "Hide" : "Show"} completed ({doneCount})
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* --- Daily Tasks Section --- */}
        <View style={styles.dailyHeader}>
          <Ionicons name="repeat-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.sectionTitle}>Daily</Text>
          <Text style={styles.dailyProgress}>
            {dailyDoneCount}/{dailyTasks.length}
          </Text>
          {dailyDoneCount > 0 && (
            <TouchableOpacity onPress={handleResetDaily} style={styles.resetBtn}>
              <Ionicons name="refresh" size={18} color={Colors.primary} />
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {dailyTasks.length === 0 ? (
          <View style={styles.emptySmall}>
            <Text style={styles.emptyText}>No daily tasks yet</Text>
          </View>
        ) : (
          dailyTasks.map((item) => {
            const isDone = dailyDoneIds.includes(item.id);
            return (
              <View
                key={item.id}
                style={styles.taskRow}
              >
                <TouchableOpacity onPress={() => handleToggleDaily(item.id)} hitSlop={8}>
                  <Ionicons
                    name={isDone ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={isDone ? Colors.done : Colors.today}
                  />
                </TouchableOpacity>
                <Pressable
                  style={styles.taskContent}
                  onLongPress={() => handleDeleteDaily(item)}
                >
                  <Text style={[styles.taskTitle, isDone && styles.taskDone]}>
                    {item.title}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={styles.addDailyBtn}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addDailyText}>Add daily task</Text>
        </TouchableOpacity>

        {/* --- Memo Section --- */}
        <View style={styles.memoHeader}>
          <Ionicons name="document-text-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.sectionTitle}>Memo</Text>
        </View>
        <TextInput
          style={styles.memoInput}
          placeholder="Quick notes..."
          placeholderTextColor={Colors.textSecondary}
          value={memo}
          onChangeText={handleMemoChange}
          onFocus={handleMemoFocus}
          multiline
          textAlignVertical="top"
        />
        {/* Spacer for keyboard */}
        <View style={{ height: 300 }} />
      </ScrollView>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Daily Task</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Exercise, Read..."
              value={newDaily}
              onChangeText={setNewDaily}
              onSubmitEditing={handleAddDaily}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setNewDaily(""); setShowModal(false); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={handleAddDaily}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 12,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 16, color: Colors.text, flex: 1 },
  taskDone: { textDecorationLine: "line-through", color: Colors.done },
  projectLabel: { fontSize: 12, marginTop: 2 },
  emptySmall: { paddingVertical: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  toggleDone: { alignItems: "center", paddingVertical: 8 },
  toggleDoneText: { color: Colors.textSecondary, fontSize: 14 },
  dailyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
    marginBottom: 12,
  },
  dailyProgress: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: "auto",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resetText: { fontSize: 13, color: Colors.primary },
  addDailyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  addDailyText: { fontSize: 14, color: Colors.primary },
  memoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
    marginBottom: 12,
  },
  memoInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 120,
    lineHeight: 22,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    width: "85%",
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  modalInput: {
    fontSize: 16,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 8,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "600" },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: { color: "#FFF", fontWeight: "600" },
});
