import AsyncStorage from "@react-native-async-storage/async-storage";
import { Project, Task, DailyTask, DailyTaskStatus } from "./types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const PROJECTS_KEY = "todo_projects";
const TASKS_KEY = "todo_tasks";
const DAILY_TASKS_KEY = "todo_daily_tasks";
const DAILY_STATUS_KEY = "todo_daily_status";
const MEMO_KEY = "todo_memo";

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PROJECT_COLORS = [
  "#4A90D9",
  "#E57373",
  "#81C784",
  "#FFB74D",
  "#BA68C8",
  "#4DB6AC",
  "#F06292",
  "#7986CB",
];

// --- Projects ---

export async function getProjects(): Promise<Project[]> {
  const data = await AsyncStorage.getItem(PROJECTS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function addProject(name: string): Promise<Project> {
  const projects = await getProjects();
  const colorIndex = projects.length % PROJECT_COLORS.length;
  const project: Project = {
    id: generateId(),
    name,
    color: PROJECT_COLORS[colorIndex],
    archived: false,
    createdAt: new Date().toISOString(),
  };
  projects.push(project);
  await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  return project;
}

export async function renameProject(id: string, newName: string): Promise<void> {
  const projects = await getProjects();
  const project = projects.find((p) => p.id === id);
  if (project) {
    project.name = newName;
    await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }
}

export async function reorderProjects(orderedIds: string[]): Promise<void> {
  const projects = await getProjects();
  const sorted = orderedIds
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);
  // Append any projects not in orderedIds (safety)
  const remaining = projects.filter((p) => !orderedIds.includes(p.id));
  await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify([...sorted, ...remaining]));
}

// Move an entire category (all its active projects) relative to adjacent categories
export async function moveCategory(category: string, direction: "up" | "down"): Promise<void> {
  const projects = await getProjects();
  const rawActive = projects.filter((p) => !p.archived);
  // Sort: categorized first, uncategorized last
  const active = [
    ...rawActive.filter((p) => p.category),
    ...rawActive.filter((p) => !p.category),
  ];
  const archived = projects.filter((p) => p.archived);

  // Build contiguous category groups (preserving order)
  type Group = { key: string; projectIds: string[] };
  const groups: Group[] = [];
  for (const p of active) {
    const key = p.category ?? "__none__";
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.projectIds.push(p.id);
    } else {
      groups.push({ key, projectIds: [p.id] });
    }
  }

  const idx = groups.findIndex((g) => g.key === category);
  if (idx < 0) return;

  if (direction === "up" && idx > 0) {
    [groups[idx - 1], groups[idx]] = [groups[idx], groups[idx - 1]];
  } else if (direction === "down" && idx < groups.length - 1) {
    [groups[idx], groups[idx + 1]] = [groups[idx + 1], groups[idx]];
  } else {
    return;
  }

  const projectMap = Object.fromEntries(active.map((p) => [p.id, p]));
  const newActive = groups.flatMap((g) => g.projectIds.map((id) => projectMap[id]));
  await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify([...newActive, ...archived]));
}

export async function setProjectCategory(id: string, category: string | undefined): Promise<void> {
  const projects = await getProjects();
  const project = projects.find((p) => p.id === id);
  if (!project) return;

  const trimmed = category?.trim();
  if (trimmed) {
    project.category = trimmed;
  } else {
    delete project.category;
  }

  // Re-sort so projects with the same category are contiguous
  const archived = projects.filter((p) => p.archived);
  const active = projects.filter((p) => !p.archived);

  // Group by category, preserving the first-appearance order of each category
  const seen: string[] = [];
  const groups: Record<string, Project[]> = {};
  const uncategorized: Project[] = [];
  for (const p of active) {
    const cat = p.category;
    if (!cat) {
      uncategorized.push(p);
      continue;
    }
    if (!seen.includes(cat)) {
      seen.push(cat);
      groups[cat] = [];
    }
    groups[cat].push(p);
  }

  const newActive: Project[] = [];
  for (const cat of seen) {
    newActive.push(...groups[cat]);
  }
  newActive.push(...uncategorized);

  await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify([...newActive, ...archived]));
}

export async function changeProjectColor(id: string, newColor: string): Promise<void> {
  const projects = await getProjects();
  const project = projects.find((p) => p.id === id);
  if (project) {
    project.color = newColor;
    await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }
}

export async function toggleProjectArchived(id: string): Promise<void> {
  const projects = await getProjects();
  const project = projects.find((p) => p.id === id);
  if (project) {
    project.archived = !project.archived;
    await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }
}

export async function renameTask(id: string, newTitle: string): Promise<void> {
  const tasks = await getTasks();
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.title = newTitle;
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }
}

export async function deleteProject(id: string): Promise<void> {
  const projects = await getProjects();
  const filtered = projects.filter((p) => p.id !== id);
  await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));
  // Also delete tasks in this project
  const tasks = await getTasks();
  const filteredTasks = tasks.filter((t) => t.projectId !== id);
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(filteredTasks));
}

// --- Tasks ---

export async function getTasks(): Promise<Task[]> {
  const data = await AsyncStorage.getItem(TASKS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const tasks = await getTasks();
  return tasks.filter((t) => t.projectId === projectId);
}

export async function getTodayTasks(): Promise<Task[]> {
  const tasks = await getTasks();
  return tasks.filter((t) => t.isToday);
}

export async function addTask(
  projectId: string,
  title: string
): Promise<Task> {
  const tasks = await getTasks();
  const task: Task = {
    id: generateId(),
    projectId,
    title,
    done: false,
    isToday: false,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  return task;
}

export async function toggleTaskDone(id: string): Promise<void> {
  const tasks = await getTasks();
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.done = !task.done;
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }
}

export async function toggleTaskToday(id: string): Promise<void> {
  const tasks = await getTasks();
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.isToday = !task.isToday;
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }
}

export async function reorderTasks(projectId: string, orderedIds: string[]): Promise<void> {
  const tasks = await getTasks();
  // Tasks in this project, in new order
  const sortedInProject = orderedIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined && t.projectId === projectId);
  // Tasks not in this project, preserved as-is
  const others = tasks.filter((t) => t.projectId !== projectId);
  // Tasks in this project not in orderedIds (safety)
  const missing = tasks.filter(
    (t) => t.projectId === projectId && !orderedIds.includes(t.id)
  );
  await AsyncStorage.setItem(
    TASKS_KEY,
    JSON.stringify([...others, ...sortedInProject, ...missing])
  );
}

export async function moveTask(id: string, newProjectId: string): Promise<void> {
  const tasks = await getTasks();
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.projectId = newProjectId;
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }
}

export async function deleteTask(id: string): Promise<void> {
  const tasks = await getTasks();
  const filtered = tasks.filter((t) => t.id !== id);
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(filtered));
}

// --- Daily Tasks ---

export async function getDailyTasks(): Promise<DailyTask[]> {
  const data = await AsyncStorage.getItem(DAILY_TASKS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function addDailyTask(title: string): Promise<DailyTask> {
  const tasks = await getDailyTasks();
  const task: DailyTask = {
    id: generateId(),
    title,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  await AsyncStorage.setItem(DAILY_TASKS_KEY, JSON.stringify(tasks));
  return task;
}

export async function deleteDailyTask(id: string): Promise<void> {
  const tasks = await getDailyTasks();
  const filtered = tasks.filter((t) => t.id !== id);
  await AsyncStorage.setItem(DAILY_TASKS_KEY, JSON.stringify(filtered));
}

export async function getDailyStatus(): Promise<DailyTaskStatus> {
  const data = await AsyncStorage.getItem(DAILY_STATUS_KEY);
  if (data) {
    return JSON.parse(data);
  }
  const today = getTodayDate();
  return { date: today, doneIds: [] };
}

export async function resetDailyStatus(): Promise<void> {
  const today = getTodayDate();
  const fresh: DailyTaskStatus = { date: today, doneIds: [] };
  await AsyncStorage.setItem(DAILY_STATUS_KEY, JSON.stringify(fresh));
}

// --- Memo ---

export async function getMemo(): Promise<string> {
  const data = await AsyncStorage.getItem(MEMO_KEY);
  return data ?? "";
}

export async function saveMemo(text: string): Promise<void> {
  await AsyncStorage.setItem(MEMO_KEY, text);
}

export async function toggleDailyTaskDone(id: string): Promise<void> {
  const status = await getDailyStatus();
  if (status.doneIds.includes(id)) {
    status.doneIds = status.doneIds.filter((d) => d !== id);
  } else {
    status.doneIds.push(id);
  }
  await AsyncStorage.setItem(DAILY_STATUS_KEY, JSON.stringify(status));
}
