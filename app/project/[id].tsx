import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Task, Project } from "../../src/types";
import {
  getTasksByProject,
  getProjects,
  addTask,
  toggleTaskDone,
  toggleTaskToday,
  deleteTask,
  renameTask,
  moveTask,
  reorderTasks,
} from "../../src/storage";
import { Colors } from "../../src/colors";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Rename
  const [renameTarget, setRenameTarget] = useState<Task | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Move
  const [moveTarget, setMoveTarget] = useState<Task | null>(null);

  // Menu
  const [menuTarget, setMenuTarget] = useState<Task | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const projects = await getProjects();
    setAllProjects(projects);
    const p = projects.find((p) => p.id === id) ?? null;
    setProject(p);
    const t = await getTasksByProject(id);
    setTasks(t);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || !id) return;
    await addTask(id, trimmed);
    setNewTitle("");
    setShowAddModal(false);
    await load();
  };

  const handleToggleDone = async (taskId: string) => {
    await toggleTaskDone(taskId);
    await load();
  };

  const handleToggleToday = async (taskId: string) => {
    await toggleTaskToday(taskId);
    await load();
  };

  const handleLongPress = (task: Task) => {
    setMenuTarget(task);
  };

  const handleMoveUp = async (task: Task) => {
    const ids = tasks.map((t) => t.id);
    const idx = ids.indexOf(task.id);
    if (idx <= 0) return;
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    if (!id) return;
    await reorderTasks(id, ids);
    await load();
  };

  const handleMoveDown = async (task: Task) => {
    const ids = tasks.map((t) => t.id);
    const idx = ids.indexOf(task.id);
    if (idx < 0 || idx >= ids.length - 1) return;
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    if (!id) return;
    await reorderTasks(id, ids);
    await load();
  };

  const handleMenuAction = async (action: string) => {
    if (!menuTarget) return;
    const task = menuTarget;

    // For Up/Down, don't close the menu so user can tap repeatedly
    if (action === "up") {
      await handleMoveUp(task);
      return;
    }
    if (action === "down") {
      await handleMoveDown(task);
      return;
    }

    setMenuTarget(null);

    switch (action) {
      case "rename":
        setRenameTarget(task);
        setRenameTitle(task.title);
        break;
      case "move":
        setMoveTarget(task);
        break;
      case "delete":
        Alert.alert("Delete Task", `Delete "${task.title}"?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteTask(task.id);
              await load();
            },
          },
        ]);
        break;
    }
  };

  const handleMove = async (newProjectId: string) => {
    if (!moveTarget) return;
    await moveTask(moveTarget.id, newProjectId);
    setMoveTarget(null);
    await load();
  };

  const handleRename = async () => {
    const trimmed = renameTitle.trim();
    if (!trimmed || !renameTarget) return;
    await renameTask(renameTarget.id, trimmed);
    setRenameTarget(null);
    setRenameTitle("");
    await load();
  };

  const visible = showDone ? tasks : tasks.filter((t) => !t.done);
  const doneCount = tasks.filter((t) => t.done).length;

  const renderTask = ({ item }: { item: Task }) => (
    <View
      style={styles.taskRow}
    >
      <TouchableOpacity
        onPress={() => handleToggleDone(item.id)}
        hitSlop={8}
      >
        <Ionicons
          name={item.done ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          color={item.done ? Colors.done : project?.color ?? Colors.primary}
        />
      </TouchableOpacity>
      <Pressable
        style={styles.taskContent}
        onLongPress={() => handleLongPress(item)}
      >
        <Text style={[styles.taskTitle, item.done && styles.taskDone]}>
          {item.title}
        </Text>
      </Pressable>
      <TouchableOpacity
        onPress={() => handleToggleToday(item.id)}
        hitSlop={8}
      >
        <Ionicons
          name={item.isToday ? "today" : "today-outline"}
          size={22}
          color={item.isToday ? Colors.today : Colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: project?.name ?? "Project",
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
        }}
      />

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tasks yet</Text>
          </View>
        }
      />

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

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Task</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Task name"
              value={newTitle}
              onChangeText={setNewTitle}
              onSubmitEditing={handleAdd}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setNewTitle(""); setShowAddModal(false); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename Task Modal */}
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setRenameTarget(null)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Rename Task</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="New name"
              value={renameTitle}
              onChangeText={setRenameTitle}
              onSubmitEditing={handleRename}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setRenameTarget(null); setRenameTitle(""); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={handleRename}>
                <Text style={styles.addBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Move Task Modal */}
      <Modal
        visible={moveTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveTarget(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setMoveTarget(null)}>
          <Pressable style={[styles.modal, styles.moveModal]} onPress={() => {}}>
            <Text style={styles.modalTitle}>Move to...</Text>
            <ScrollView
              style={styles.moveList}
              contentContainerStyle={{ gap: 8 }}
              showsVerticalScrollIndicator
            >
              {allProjects
                .filter((p) => p.id !== id && !p.archived)
                .map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.moveRow}
                    onPress={() => handleMove(p.id)}
                  >
                    <View style={[styles.moveColorDot, { backgroundColor: p.color }]} />
                    <Text style={styles.moveName} numberOfLines={1}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              {allProjects.filter((p) => p.id !== id && !p.archived).length === 0 && (
                <Text style={styles.emptyText}>No other projects</Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setMoveTarget(null)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Task Menu Modal */}
      <Modal
        visible={menuTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTarget(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuTarget(null)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>{menuTarget?.title}</Text>
            {(() => {
              const idx = menuTarget ? tasks.findIndex((t) => t.id === menuTarget.id) : -1;
              return (
                <>
                  {idx > 0 && (
                    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("up")}>
                      <Ionicons name="arrow-up" size={20} color={Colors.text} />
                      <Text style={styles.menuText}>Move Up</Text>
                    </TouchableOpacity>
                  )}
                  {idx >= 0 && idx < tasks.length - 1 && (
                    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("down")}>
                      <Ionicons name="arrow-down" size={20} color={Colors.text} />
                      <Text style={styles.menuText}>Move Down</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("rename")}>
              <Ionicons name="pencil-outline" size={20} color={Colors.text} />
              <Text style={styles.menuText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("move")}>
              <Ionicons name="swap-horizontal-outline" size={20} color={Colors.text} />
              <Text style={styles.menuText}>Move to...</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("delete")}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              <Text style={[styles.menuText, { color: Colors.danger }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuCancel]}
              onPress={() => setMenuTarget(null)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, flexGrow: 1 },
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
  taskTitle: { fontSize: 16, color: Colors.text },
  taskDone: { textDecorationLine: "line-through", color: Colors.done },
  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { fontSize: 16, color: Colors.textSecondary },
  toggleDone: { alignItems: "center", paddingVertical: 8 },
  toggleDoneText: { color: Colors.textSecondary, fontSize: 14 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
  moveModal: {
    maxHeight: "80%",
  },
  moveList: {
    maxHeight: 400,
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
  moveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  moveColorDot: { width: 12, height: 12, borderRadius: 6 },
  moveName: { fontSize: 16, color: Colors.text },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuText: { fontSize: 16, color: Colors.text },
  menuCancel: {
    justifyContent: "center",
    borderBottomWidth: 0,
    marginTop: 4,
  },
});
