export interface Project {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  category?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  done: boolean;
  isToday: boolean;
  createdAt: string;
}

export interface DailyTask {
  id: string;
  title: string;
  createdAt: string;
}

// Track which daily tasks are done today (resets each day)
export interface DailyTaskStatus {
  date: string; // "YYYY-MM-DD"
  doneIds: string[];
}
