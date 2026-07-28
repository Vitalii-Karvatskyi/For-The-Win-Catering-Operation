import type { TodoEmployee, TodoTask } from '../types/todo';
import { COMPLETION_DATE_UNKNOWN } from '../types/todo';

/** Local calendar YYYY-MM-DD (no UTC day shift). */
export function localDateYmd(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalDateLabel(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) {
    return ymd;
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatLocalDateTime(iso: string): string {
  if (!iso || iso === COMPLETION_DATE_UNKNOWN) {
    return 'Date not recorded';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function deadlineStatus(
  deadlineDate: string | undefined,
  todayYmd = localDateYmd(),
): 'overdue' | 'today' | 'upcoming' | 'none' {
  if (!deadlineDate || !/^\d{4}-\d{2}-\d{2}$/.test(deadlineDate)) {
    return 'none';
  }
  if (deadlineDate < todayYmd) {
    return 'overdue';
  }
  if (deadlineDate === todayYmd) {
    return 'today';
  }
  return 'upcoming';
}

export function activeTaskStatusLabel(
  deadlineDate: string | undefined,
): 'Overdue' | 'Due Today' | 'Upcoming' | 'Active' {
  const status = deadlineStatus(deadlineDate);
  if (status === 'overdue') {
    return 'Overdue';
  }
  if (status === 'today') {
    return 'Due Today';
  }
  if (status === 'upcoming') {
    return 'Upcoming';
  }
  return 'Active';
}

function createdAtMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

export function sortActiveTasks(tasks: TodoTask[]): TodoTask[] {
  const today = localDateYmd();
  return [...tasks].sort((a, b) => {
    const statusA = deadlineStatus(a.deadlineDate, today);
    const statusB = deadlineStatus(b.deadlineDate, today);
    const rank = (status: ReturnType<typeof deadlineStatus>): number => {
      if (status === 'overdue') return 0;
      if (status === 'today') return 1;
      if (status === 'upcoming') return 2;
      return 3;
    };
    const rankDiff = rank(statusA) - rank(statusB);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    if (statusA === 'upcoming' && statusB === 'upcoming') {
      const dateDiff = (a.deadlineDate ?? '').localeCompare(b.deadlineDate ?? '');
      if (dateDiff !== 0) {
        return dateDiff;
      }
    }
    return createdAtMs(a.createdAt) - createdAtMs(b.createdAt);
  });
}

export function sortCompletedTasks(
  tasks: TodoTask[],
  completionKey: string,
): TodoTask[] {
  return [...tasks].sort((a, b) => {
    const aMs = createdAtMs(a.completedAtByAssignee[completionKey] ?? '');
    const bMs = createdAtMs(b.completedAtByAssignee[completionKey] ?? '');
    return bMs - aMs;
  });
}

export function resolveAssignees(
  assigneeIds: string[],
  employees: TodoEmployee[],
): TodoEmployee[] {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  return assigneeIds
    .map((id) => byId.get(id))
    .filter((employee): employee is TodoEmployee => Boolean(employee));
}

export function createTodoId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
