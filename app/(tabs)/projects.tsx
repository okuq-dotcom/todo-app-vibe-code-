import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Pressable,
  Modal,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Project } from "../../src/types";
import {
  getProjects,
  addProject,
  deleteProject,
  renameProject,
  changeProjectColor,
  toggleProjectArchived,
  reorderProjects,
  setProjectCategory,
  moveCategory,
  getTasksByProject,
} from "../../src/storage";
import { Colors } from "../../src/colors";

const ALL_COLORS = [
  "#4A90D9", "#E57373", "#81C784", "#FFB74D",
  "#BA68C8", "#4DB6AC", "#F06292", "#7986CB",
  "#FF8A65", "#A1887F", "#90A4AE", "#DCE775",
  "#4DD0E1", "#CE93D8", "#FFD54F", "#E0E0E0",
];

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [newName, setNewName] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Menu
  const [menuTarget, setMenuTarget] = useState<Project | null>(null);

  // Rename
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameName, setRenameName] = useState("");

  // Color picker
  const [colorTarget, setColorTarget] = useState<Project | null>(null);

  // Category
  const [categoryTarget, setCategoryTarget] = useState<Project | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const load = useCallback(async () => {
    const p = await getProjects();
    setProjects(p);
    const counts: Record<string, { total: number; done: number }> = {};
    for (const proj of p) {
      const tasks = await getTasksByProject(proj.id);
      counts[proj.id] = {
        total: tasks.length,
        done: tasks.filter((t) => t.done).length,
      };
    }
    setTaskCounts(counts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await addProject(trimmed);
    setNewName("");
    setShowModal(false);
    await load();
  };

  const getSortedActive = () => {
    const raw = projects.filter((p) => !p.archived);
    return [
      ...raw.filter((p) => p.category),
      ...raw.filter((p) => !p.category),
    ];
  };

  const handleMoveUp = async (project: Project) => {
    const active = getSortedActive();
    const idx = active.findIndex((p) => p.id === project.id);
    if (idx <= 0) return;
    const ids = active.map((p) => p.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    await reorderProjects(ids);
    await load();
  };

  const handleMoveDown = async (project: Project) => {
    const active = getSortedActive();
    const idx = active.findIndex((p) => p.id === project.id);
    if (idx < 0 || idx >= active.length - 1) return;
    const ids = active.map((p) => p.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    await reorderProjects(ids);
    await load();
  };

  const handleLongPress = (project: Project) => {
    setMenuTarget(project);
  };

  const handleMenuAction = async (action: string) => {
    if (!menuTarget) return;
    const project = menuTarget;

    // For reorder actions, don't close the menu so user can tap repeatedly
    if (action === "up") {
      await handleMoveUp(project);
      return;
    }
    if (action === "down") {
      await handleMoveDown(project);
      return;
    }
    if (action === "catup") {
      if (project.category) {
        await moveCategory(project.category, "up");
        await load();
      }
      return;
    }
    if (action === "catdown") {
      if (project.category) {
        await moveCategory(project.category, "down");
        await load();
      }
      return;
    }

    setMenuTarget(null);

    switch (action) {
      case "rename":
        setRenameTarget(project);
        setRenameName(project.name);
        break;
      case "color":
        setColorTarget(project);
        break;
      case "category":
        setCategoryTarget(project);
        setCategoryName(project.category ?? "");
        break;
      case "archive":
        await toggleProjectArchived(project.id);
        await load();
        break;
      case "delete":
        Alert.alert(
          "Delete Project",
          `"${project.name}" and all its tasks will be deleted.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                await deleteProject(project.id);
                await load();
              },
            },
          ]
        );
        break;
    }
  };

  const handleRename = async () => {
    const trimmed = renameName.trim();
    if (!trimmed || !renameTarget) return;
    await renameProject(renameTarget.id, trimmed);
    setRenameTarget(null);
    setRenameName("");
    await load();
  };

  const handleColorChange = async (color: string) => {
    if (!colorTarget) return;
    await changeProjectColor(colorTarget.id, color);
    setColorTarget(null);
    await load();
  };

  const handleSaveCategory = async () => {
    if (!categoryTarget) return;
    await setProjectCategory(categoryTarget.id, categoryName || undefined);
    setCategoryTarget(null);
    setCategoryName("");
    await load();
  };

  const handleSelectCategory = async (cat: string | undefined) => {
    if (!categoryTarget) return;
    await setProjectCategory(categoryTarget.id, cat);
    setCategoryTarget(null);
    setCategoryName("");
    await load();
  };

  const rawActive = projects.filter((p) => !p.archived);
  // Sort: categorized (preserving order) first, uncategorized at the bottom
  const activeProjects = [
    ...rawActive.filter((p) => p.category),
    ...rawActive.filter((p) => !p.category),
  ];
  const archivedProjects = projects.filter((p) => p.archived);

  // Build list items with category dividers
  type ListItem =
    | { type: "divider"; category: string; key: string }
    | { type: "project"; project: Project; key: string };

  const listItems: ListItem[] = [];
  let lastCategory: string | undefined = undefined;
  for (const p of activeProjects) {
    const cat = p.category;
    if (cat !== lastCategory) {
      if (cat) {
        listItems.push({ type: "divider", category: cat, key: `div-${cat}` });
      }
      lastCategory = cat;
    }
    listItems.push({ type: "project", project: p, key: p.id });
  }

  const renderProject = ({ item }: { item: Project }) => {
    const count = taskCounts[item.id];
    return (
      <Pressable
        style={[styles.projectRow, item.archived && styles.projectRowArchived]}
        onPress={() => router.push(`/project/${item.id}`)}
        onLongPress={() => handleLongPress(item)}
      >
        <View style={[styles.colorDot, { backgroundColor: item.color }]} />
        <View style={styles.projectContent}>
          <Text style={[styles.projectName, item.archived && styles.archivedText]}>
            {item.name}
          </Text>
          {count && (
            <Text style={styles.projectCount}>
              {count.done}/{count.total} tasks
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={listItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.type === "divider") {
            return (
              <View style={styles.categoryDivider}>
                <View style={styles.categoryLine} />
                <Text style={styles.categoryLabel}>{item.category}</Text>
                <View style={styles.categoryLine} />
              </View>
            );
          }
          return renderProject({ item: item.project });
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No projects yet</Text>
          </View>
        }
        ListFooterComponent={
          archivedProjects.length > 0 ? (
            <View>
              <TouchableOpacity
                style={styles.archivedToggle}
                onPress={() => setShowArchived(!showArchived)}
              >
                <Ionicons
                  name={showArchived ? "chevron-down" : "chevron-forward"}
                  size={18}
                  color={Colors.textSecondary}
                />
                <Text style={styles.archivedToggleText}>
                  Archived ({archivedProjects.length})
                </Text>
              </TouchableOpacity>
              {showArchived &&
                archivedProjects.map((item) => (
                  <View key={item.id}>{renderProject({ item })}</View>
                ))}
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Add Project Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Project</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Project name"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={handleAdd}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setNewName(""); setShowModal(false); }}
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

      {/* Rename Project Modal */}
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setRenameTarget(null)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Rename Project</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="New name"
              value={renameName}
              onChangeText={setRenameName}
              onSubmitEditing={handleRename}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setRenameTarget(null); setRenameName(""); }}
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

      {/* Color Picker Modal */}
      <Modal
        visible={colorTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setColorTarget(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setColorTarget(null)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Choose Color</Text>
            <View style={styles.colorGrid}>
              {ALL_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => handleColorChange(c)}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    colorTarget?.color === c && styles.colorSelected,
                  ]}
                />
              ))}
            </View>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setColorTarget(null)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Category Modal */}
      <Modal
        visible={categoryTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryTarget(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setCategoryTarget(null)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Set Category</Text>
            {(() => {
              const existingCategories = Array.from(
                new Set(
                  projects
                    .map((p) => p.category)
                    .filter((c): c is string => !!c)
                )
              );
              return existingCategories.length > 0 ? (
                <View style={{ gap: 6 }}>
                  {existingCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.menuItem}
                      onPress={() => handleSelectCategory(cat)}
                    >
                      <Ionicons name="pricetag" size={18} color={Colors.textSecondary} />
                      <Text style={styles.menuText}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleSelectCategory(undefined)}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={Colors.textSecondary} />
                    <Text style={styles.menuText}>No category</Text>
                  </TouchableOpacity>
                </View>
              ) : null;
            })()}
            <Text style={styles.menuLabel}>Or create new:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category name"
              value={categoryName}
              onChangeText={setCategoryName}
              onSubmitEditing={handleSaveCategory}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setCategoryTarget(null); setCategoryName(""); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={handleSaveCategory}>
                <Text style={styles.addBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Project Menu Modal */}
      <Modal
        visible={menuTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTarget(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuTarget(null)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>{menuTarget?.name}</Text>
            {(() => {
              const active = getSortedActive();
              const idx = menuTarget ? active.findIndex((p) => p.id === menuTarget.id) : -1;

              // Determine category position
              let catIdx = -1;
              let catCount = 0;
              if (menuTarget?.category) {
                const groups: string[] = [];
                let last: string | undefined = undefined;
                for (const p of active) {
                  const k = p.category ?? "__none__";
                  if (k !== last) {
                    groups.push(k);
                    last = k;
                  }
                }
                catIdx = groups.indexOf(menuTarget.category);
                catCount = groups.length;
              }

              return (
                <>
                  {idx > 0 && (
                    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("up")}>
                      <Ionicons name="arrow-up" size={20} color={Colors.text} />
                      <Text style={styles.menuText}>Move Up</Text>
                    </TouchableOpacity>
                  )}
                  {idx >= 0 && idx < active.length - 1 && (
                    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("down")}>
                      <Ionicons name="arrow-down" size={20} color={Colors.text} />
                      <Text style={styles.menuText}>Move Down</Text>
                    </TouchableOpacity>
                  )}
                  {menuTarget?.category && catIdx > 0 && (
                    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("catup")}>
                      <Ionicons name="chevron-up-circle-outline" size={20} color={Colors.text} />
                      <Text style={styles.menuText}>Move Category Up</Text>
                    </TouchableOpacity>
                  )}
                  {menuTarget?.category && catIdx >= 0 && catIdx < catCount - 1 && (
                    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("catdown")}>
                      <Ionicons name="chevron-down-circle-outline" size={20} color={Colors.text} />
                      <Text style={styles.menuText}>Move Category Down</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("rename")}>
              <Ionicons name="pencil-outline" size={20} color={Colors.text} />
              <Text style={styles.menuText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("color")}>
              <Ionicons name="color-palette-outline" size={20} color={Colors.text} />
              <Text style={styles.menuText}>Change Color</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("category")}>
              <Ionicons name="pricetag-outline" size={20} color={Colors.text} />
              <Text style={styles.menuText}>Set Category</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction("archive")}>
              <Ionicons name="archive-outline" size={20} color={Colors.text} />
              <Text style={styles.menuText}>{menuTarget?.archived ? "Restore" : "Archive"}</Text>
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
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  projectRowArchived: { opacity: 0.5 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  projectContent: { flex: 1 },
  projectName: { fontSize: 16, color: Colors.text, fontWeight: "500" },
  archivedText: { color: Colors.textSecondary },
  projectCount: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingTop: 100,
  },
  emptyText: { fontSize: 16, color: Colors.textSecondary },
  archivedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  archivedToggleText: { fontSize: 14, color: Colors.textSecondary },
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
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: Colors.text,
  },
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
  menuLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  categoryDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  categoryLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.5,
  },
  categoryLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    opacity: 0.7,
  },
});
