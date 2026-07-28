import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  TodoCryptoKeys,
  TodoEmployee,
  TodoTask,
  TodoTaskFormValues,
} from '../../types/todo';
import {
  addTodoEmployee,
  completeTodoTask,
  createTodoTask,
  loadTodoEmployees,
  loadTodoTasks,
  restoreTodoTask,
  updateTodoTask,
} from '../../services/todoDataService';
import { GitHubApiError } from '../../services/githubDataService';
import { TodoCryptoError } from '../../services/todoCryptoService';
import {
  activeTaskStatusLabel,
  createTodoId,
  formatLocalDateLabel,
  formatLocalDateTime,
  resolveAssignees,
  sortActiveTasks,
  sortCompletedTasks,
} from '../../lib/todoHelpers';
import { ManagePeopleModal } from './ManagePeopleModal';
import { TaskFormModal } from './TaskFormModal';
import { ftwAssets } from '../../config/ftwAssets';
import '../../styles/todo.css';

const UNASSIGNED_KEY = 'unassigned';

type TodoPageProps = {
  unlocked: boolean;
  keys: TodoCryptoKeys | null;
  onLock: () => void;
  onDecryptFailure: () => void;
  onAuthFailure: (message?: string) => void;
};

type LoadPhase = 'idle' | 'loading' | 'ready' | 'error' | 'decrypt-error';

function buildTaskFromForm(values: TodoTaskFormValues): Omit<
  TodoTask,
  'id' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt'
> {
  const task: Omit<
    TodoTask,
    'id' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt'
  > = {
    title: values.title.trim(),
    assigneeIds: values.assigneeIds,
  };
  if (values.department.trim()) task.department = values.department.trim();
  if (values.description.trim()) task.description = values.description.trim();
  if (values.amountOrDueDate.trim()) {
    task.amountOrDueDate = values.amountOrDueDate.trim();
  }
  if (values.involvement.trim()) task.involvement = values.involvement.trim();
  if (values.notes.trim()) task.notes = values.notes.trim();
  if (values.deadlineDate.trim()) task.deadlineDate = values.deadlineDate.trim();
  return task;
}

function statusClassName(label: string): string {
  if (label === 'Overdue') return 'todo-task-card__status todo-task-card__status--overdue';
  if (label === 'Due Today') return 'todo-task-card__status todo-task-card__status--today';
  if (label === 'Upcoming') return 'todo-task-card__status todo-task-card__status--upcoming';
  if (label === 'Completed') return 'todo-task-card__status todo-task-card__status--completed';
  return 'todo-task-card__status';
}

type TaskCardProps = {
  task: TodoTask;
  employees: TodoEmployee[];
  completed?: boolean;
  busy: boolean;
  mutationsBlocked: boolean;
  onEdit: (task: TodoTask) => void;
  onComplete: (taskId: string) => void;
  onRestore: (taskId: string) => void;
};

function TodoTaskCard({
  task,
  employees,
  completed = false,
  busy,
  mutationsBlocked,
  onEdit,
  onComplete,
  onRestore,
}: TaskCardProps) {
  const assignees = resolveAssignees(task.assigneeIds, employees);
  const status = completed
    ? 'Completed'
    : activeTaskStatusLabel(task.deadlineDate);
  const shared = task.assigneeIds.length > 1;

  return (
    <article
      className={`todo-task-card${completed ? ' todo-task-card--completed' : ''}`}
    >
      <div className="todo-task-card__top">
        <div className="todo-task-card__heading">
          <div className="todo-task-card__badges">
            <span className={statusClassName(status)}>{status}</span>
            {shared ? (
              <span className="todo-task-card__shared">Shared task</span>
            ) : null}
          </div>
          <h3 className="todo-task-card__title">{task.title}</h3>
          <div className="todo-task-card__meta-row">
            {task.department?.trim() ? (
              <span className="todo-task-card__pill">{task.department}</span>
            ) : null}
            {task.deadlineDate ? (
              <span className="todo-task-card__deadline">
                Deadline: {formatLocalDateLabel(task.deadlineDate)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="todo-task-card__actions">
          {completed ? (
            <button
              type="button"
              className="ops-btn ops-btn--secondary"
              disabled={busy || mutationsBlocked}
              aria-label={`Restore task: ${task.title}`}
              onClick={() => onRestore(task.id)}
            >
              {busy ? 'Restoring...' : 'Restore'}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="ops-btn ops-btn--ghost"
                disabled={busy || mutationsBlocked}
                aria-label={`Edit task: ${task.title}`}
                onClick={() => onEdit(task)}
              >
                Edit
              </button>
              <button
                type="button"
                className="ops-btn ops-btn--primary"
                disabled={busy || mutationsBlocked}
                aria-label={`Complete task: ${task.title}`}
                onClick={() => onComplete(task.id)}
              >
                {busy ? 'Completing...' : 'Complete'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="todo-task-card__body">
        {task.description?.trim() ? (
          <p className="todo-task-card__detail">
            <span>Description</span>
            {task.description}
          </p>
        ) : null}
        {task.amountOrDueDate?.trim() ? (
          <p className="todo-task-card__detail">
            <span>Amount / Due Date</span>
            {task.amountOrDueDate}
          </p>
        ) : null}
        {task.involvement?.trim() ? (
          <p className="todo-task-card__detail">
            <span>Involvement</span>
            {task.involvement}
          </p>
        ) : null}
        {task.notes?.trim() ? (
          <p className="todo-task-card__detail">
            <span>Notes</span>
            {task.notes}
          </p>
        ) : null}

        <div className="todo-task-card__assignees">
          <span className="todo-task-card__assignees-label">Assigned to</span>
          <div className="todo-task-card__chips">
            {assignees.length === 0 ? (
              <span className="todo-chip todo-chip--muted">Unassigned</span>
            ) : (
              assignees.map((person) => (
                <span key={person.id} className="todo-chip">
                  {person.name}
                </span>
              ))
            )}
          </div>
        </div>

        {completed && task.completedAt ? (
          <p className="todo-task-card__completed-at">
            Completed: {formatLocalDateTime(task.completedAt)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

type PersonSectionProps = {
  sectionKey: string;
  title: string;
  subtitle?: string;
  initial?: string;
  activeTasks: TodoTask[];
  completedTasks: TodoTask[];
  employees: TodoEmployee[];
  expanded: boolean;
  onToggleCompleted: () => void;
  mutatingTaskIds: ReadonlySet<string>;
  mutationsBlocked: boolean;
  onEdit: (task: TodoTask) => void;
  onComplete: (taskId: string) => void;
  onRestore: (taskId: string) => void;
};

function PersonSection({
  sectionKey,
  title,
  subtitle,
  initial,
  activeTasks,
  completedTasks,
  employees,
  expanded,
  onToggleCompleted,
  mutatingTaskIds,
  mutationsBlocked,
  onEdit,
  onComplete,
  onRestore,
}: PersonSectionProps) {
  const completedPanelId = useId();
  const activeLabel =
    activeTasks.length === 1
      ? '1 active task'
      : `${activeTasks.length} active tasks`;

  return (
    <section className="todo-person-section" aria-labelledby={`${sectionKey}-heading`}>
      <header className="todo-person-header">
        <div className="todo-person-header__identity">
          {initial ? (
            <span className="todo-person-avatar" aria-hidden="true">
              {initial}
            </span>
          ) : (
            <span className="todo-person-avatar todo-person-avatar--muted" aria-hidden="true">
              ?
            </span>
          )}
          <div>
            <h2 id={`${sectionKey}-heading`} className="todo-person-header__name">
              {title}
            </h2>
            {subtitle ? (
              <p className="todo-person-header__subtitle">{subtitle}</p>
            ) : (
              <p className="todo-person-header__subtitle">{activeLabel}</p>
            )}
          </div>
        </div>
        <p className="todo-person-header__counts">
          {activeLabel}
          {' · '}
          {completedTasks.length} completed
        </p>
      </header>

      <div className="todo-person-section__block">
        <h3 className="todo-person-section__label">Active Tasks</h3>
        {activeTasks.length === 0 ? (
          <p className="todo-empty">No active tasks.</p>
        ) : (
          <div className="todo-task-grid">
            {activeTasks.map((task) => (
              <TodoTaskCard
                key={`${sectionKey}-active-${task.id}`}
                task={task}
                employees={employees}
                busy={mutatingTaskIds.has(task.id)}
                mutationsBlocked={mutationsBlocked}
                onEdit={onEdit}
                onComplete={onComplete}
                onRestore={onRestore}
              />
            ))}
          </div>
        )}
      </div>

      <div className="todo-person-section__block">
        <button
          type="button"
          className="todo-completed-toggle"
          aria-expanded={expanded}
          aria-controls={completedPanelId}
          onClick={onToggleCompleted}
        >
          Completed Tasks ({completedTasks.length})
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        </button>
        {expanded ? (
          <div id={completedPanelId}>
            {completedTasks.length === 0 ? (
              <p className="todo-empty">No completed tasks.</p>
            ) : (
              <div className="todo-task-grid">
                {completedTasks.map((task) => (
                  <TodoTaskCard
                    key={`${sectionKey}-done-${task.id}`}
                    task={task}
                    employees={employees}
                    completed
                    busy={mutatingTaskIds.has(task.id)}
                    mutationsBlocked={mutationsBlocked}
                    onEdit={onEdit}
                    onComplete={onComplete}
                    onRestore={onRestore}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TodoPage({
  unlocked,
  keys,
  onLock,
  onDecryptFailure,
  onAuthFailure,
}: TodoPageProps) {
  const [phase, setPhase] = useState<LoadPhase>('idle');
  const [employees, setEmployees] = useState<TodoEmployee[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [peopleBusy, setPeopleBusy] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<
    | { open: false }
    | { open: true; mode: 'create' | 'edit'; task: TodoTask | null }
  >({ open: false });
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [mutatingTaskIds, setMutatingTaskIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [expandedCompletedGroups, setExpandedCompletedGroups] = useState<
    Record<string, boolean>
  >({});
  const [mutationsBlocked, setMutationsBlocked] = useState(false);

  const loadGeneration = useRef(0);
  const onDecryptFailureRef = useRef(onDecryptFailure);
  const onAuthFailureRef = useRef(onAuthFailure);
  onDecryptFailureRef.current = onDecryptFailure;
  onAuthFailureRef.current = onAuthFailure;

  const clearDecryptedState = useCallback(() => {
    setEmployees([]);
    setTasks([]);
    setPhase('idle');
    setError(null);
    setBanner(null);
    setPeopleOpen(false);
    setTaskModal({ open: false });
    setExpandedCompletedGroups({});
    setMutationsBlocked(false);
  }, []);

  const handleCryptoFailure = useCallback(() => {
    clearDecryptedState();
    setPhase('decrypt-error');
    setError('Unable to decrypt To Do data. Unlock To Do again.');
    setMutationsBlocked(true);
    onDecryptFailureRef.current();
  }, [clearDecryptedState]);

  const loadData = useCallback(async () => {
    if (!keys) {
      clearDecryptedState();
      return;
    }

    const generation = loadGeneration.current + 1;
    loadGeneration.current = generation;
    setPhase('loading');
    setError(null);
    setMutationsBlocked(false);

    try {
      const [nextEmployees, nextTasks] = await Promise.all([
        loadTodoEmployees(keys.employeesKey),
        loadTodoTasks(keys.tasksKey),
      ]);
      if (generation !== loadGeneration.current) {
        return;
      }
      setEmployees(nextEmployees);
      setTasks(nextTasks);
      setPhase('ready');
    } catch (err) {
      if (generation !== loadGeneration.current) {
        return;
      }
      if (err instanceof TodoCryptoError) {
        handleCryptoFailure();
        return;
      }
      if (err instanceof GitHubApiError && err.code === 'unauthorized') {
        clearDecryptedState();
        onAuthFailureRef.current('GitHub access expired. Enter a new token.');
        return;
      }
      if (err instanceof GitHubApiError && err.code === 'forbidden') {
        setPhase('error');
        setError(err.message);
        setMutationsBlocked(true);
        return;
      }
      setPhase('error');
      setError('Unable to load To Do data.');
    }
  }, [keys, clearDecryptedState, handleCryptoFailure]);

  useEffect(() => {
    if (!unlocked || !keys) {
      clearDecryptedState();
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable reload gate
  }, [unlocked, keys]);

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [employees],
  );

  const departmentOptions = useMemo(() => {
    const values = new Set<string>();
    for (const task of tasks) {
      if (task.department?.trim()) {
        values.add(task.department.trim());
      }
    }
    return [...values];
  }, [tasks]);

  const unassignedActive = useMemo(
    () =>
      sortActiveTasks(
        tasks.filter((task) => !task.completed && task.assigneeIds.length === 0),
      ),
    [tasks],
  );

  const unassignedCompleted = useMemo(
    () =>
      sortCompletedTasks(
        tasks.filter((task) => task.completed && task.assigneeIds.length === 0),
      ),
    [tasks],
  );

  function employeeActiveTasks(employeeId: string): TodoTask[] {
    return sortActiveTasks(
      tasks.filter(
        (task) => !task.completed && task.assigneeIds.includes(employeeId),
      ),
    );
  }

  function employeeCompletedTasks(employeeId: string): TodoTask[] {
    return sortCompletedTasks(
      tasks.filter(
        (task) => task.completed && task.assigneeIds.includes(employeeId),
      ),
    );
  }

  function toggleCompletedGroup(key: string) {
    setExpandedCompletedGroups((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function handleRefresh() {
    if (!keys || refreshBusy) {
      return;
    }
    setRefreshBusy(true);
    setBanner(null);
    try {
      await loadData();
    } finally {
      setRefreshBusy(false);
    }
  }

  async function handleAddPerson(name: string) {
    if (!keys || mutationsBlocked) {
      return;
    }
    setPeopleBusy(true);
    setPeopleError(null);
    try {
      const employee: TodoEmployee = {
        id: createTodoId('person'),
        name: name.trim(),
        createdAt: new Date().toISOString(),
      };
      const next = await addTodoEmployee(employee, keys.employeesKey);
      setEmployees(next);
    } catch (err) {
      if (err instanceof TodoCryptoError) {
        handleCryptoFailure();
        throw err;
      }
      if (err instanceof GitHubApiError && err.code === 'unauthorized') {
        onAuthFailureRef.current('GitHub access expired. Enter a new token.');
        throw err;
      }
      setPeopleError(err instanceof Error ? err.message : 'Unable to add person.');
      throw err;
    } finally {
      setPeopleBusy(false);
    }
  }

  async function handleSaveTask(values: TodoTaskFormValues) {
    if (!keys || mutationsBlocked || !taskModal.open || taskBusy) {
      return;
    }
    setTaskBusy(true);
    setTaskError(null);
    try {
      const fields = buildTaskFromForm(values);
      if (taskModal.mode === 'create') {
        const now = new Date().toISOString();
        const task: TodoTask = {
          id: createTodoId('task'),
          ...fields,
          createdAt: now,
          updatedAt: now,
          completed: false,
          completedAt: null,
        };
        loadGeneration.current += 1;
        const savedTasks = await createTodoTask(task, keys.tasksKey);
        setTasks(savedTasks);
        setBanner('Task added.');
      } else if (taskModal.task) {
        loadGeneration.current += 1;
        const savedTasks = await updateTodoTask(
          taskModal.task.id,
          fields,
          keys.tasksKey,
        );
        setTasks(savedTasks);
        setBanner('Task updated.');
      }
      setTaskModal({ open: false });
    } catch (err) {
      if (err instanceof TodoCryptoError) {
        handleCryptoFailure();
        throw err;
      }
      if (err instanceof GitHubApiError && err.code === 'unauthorized') {
        onAuthFailureRef.current('GitHub access expired. Enter a new token.');
        throw err;
      }
      setTaskError(err instanceof Error ? err.message : 'Save failed.');
      throw err instanceof Error ? err : new Error('Save failed.');
    } finally {
      setTaskBusy(false);
    }
  }

  async function handleComplete(taskId: string) {
    if (!keys || mutationsBlocked || mutatingTaskIds.has(taskId)) {
      return;
    }
    setMutatingTaskIds((current) => new Set(current).add(taskId));
    try {
      loadGeneration.current += 1;
      const savedTasks = await completeTodoTask(taskId, keys.tasksKey);
      setTasks(savedTasks);
    } catch (err) {
      if (err instanceof TodoCryptoError) {
        handleCryptoFailure();
        return;
      }
      if (err instanceof GitHubApiError && err.code === 'unauthorized') {
        onAuthFailureRef.current('GitHub access expired. Enter a new token.');
        return;
      }
      setBanner(err instanceof Error ? err.message : 'Unable to complete task.');
    } finally {
      setMutatingTaskIds((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    }
  }

  async function handleRestore(taskId: string) {
    if (!keys || mutationsBlocked || mutatingTaskIds.has(taskId)) {
      return;
    }
    setMutatingTaskIds((current) => new Set(current).add(taskId));
    try {
      loadGeneration.current += 1;
      const savedTasks = await restoreTodoTask(taskId, keys.tasksKey);
      setTasks(savedTasks);
    } catch (err) {
      if (err instanceof TodoCryptoError) {
        handleCryptoFailure();
        return;
      }
      if (err instanceof GitHubApiError && err.code === 'unauthorized') {
        onAuthFailureRef.current('GitHub access expired. Enter a new token.');
        return;
      }
      setBanner(err instanceof Error ? err.message : 'Unable to restore task.');
    } finally {
      setMutatingTaskIds((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    }
  }

  return (
    <div className="ops-page todo-page">
      <header className="ops-header">
        <div className="ops-header__bar" aria-hidden="true" />
        <div className="ops-header__inner">
          <div className="ops-container ops-header__row">
            <div className="ops-header__brand">
              <img
                className="ops-header__logo"
                src={ftwAssets.logo}
                alt="For The Win"
                width={345}
                height={117}
              />
              <div className="ops-header__titles">
                <h1 className="ops-header__title">To Do</h1>
                <p className="ops-header__subtitle">
                  Manage team tasks and deadlines.
                </p>
              </div>
            </div>
            <div className="ops-header__actions">
              {unlocked ? (
                <>
                  <button
                    type="button"
                    className="ops-btn ops-btn--primary"
                    disabled={
                      !keys || phase !== 'ready' || mutationsBlocked || taskBusy
                    }
                    onClick={() =>
                      setTaskModal({ open: true, mode: 'create', task: null })
                    }
                  >
                    Add Task
                  </button>
                  <button
                    type="button"
                    className="ops-btn ops-btn--secondary"
                    disabled={!keys || phase !== 'ready' || mutationsBlocked}
                    onClick={() => {
                      setPeopleError(null);
                      setPeopleOpen(true);
                    }}
                  >
                    Manage People
                  </button>
                  <button
                    type="button"
                    className="ops-btn ops-btn--secondary"
                    disabled={!keys || refreshBusy || phase === 'loading'}
                    onClick={() => {
                      void handleRefresh();
                    }}
                  >
                    {refreshBusy ? 'Refreshing...' : 'Refresh'}
                  </button>
                  <button
                    type="button"
                    className="ops-btn ops-btn--ghost"
                    onClick={onLock}
                  >
                    Lock To Do
                  </button>
                </>
              ) : null}
              <span className="ops-header__badge">Internal Use</span>
            </div>
          </div>
        </div>
      </header>

      <main className="ops-main">
        <div className="ops-container">
          {banner ? (
            <div className="ops-banner" role="status">
              <p>{banner}</p>
              <button
                type="button"
                className="ops-btn ops-btn--ghost"
                onClick={() => setBanner(null)}
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {!unlocked ? (
            <section className="ops-state-panel">
              <h2 className="ops-state-panel__title">To Do is locked</h2>
              <p className="ops-state-panel__text">
                Unlock To Do to view tasks and team members on this device.
              </p>
            </section>
          ) : null}

          {unlocked && phase === 'loading' ? (
            <section className="ops-state-panel" aria-live="polite">
              <h2 className="ops-state-panel__title">Loading To Do data...</h2>
            </section>
          ) : null}

          {unlocked && phase === 'error' ? (
            <section className="ops-state-panel">
              <h2 className="ops-state-panel__title">
                {error ?? 'Unable to load To Do data.'}
              </h2>
              <button
                type="button"
                className="ops-btn ops-btn--primary"
                onClick={() => {
                  void loadData();
                }}
              >
                Retry
              </button>
            </section>
          ) : null}

          {unlocked && phase === 'decrypt-error' ? (
            <section className="ops-state-panel">
              <h2 className="ops-state-panel__title">
                Unable to decrypt To Do data. Unlock To Do again.
              </h2>
            </section>
          ) : null}

          {unlocked && phase === 'ready' ? (
            <section className="todo-section">
              <h2 className="todo-section__title">Team Tasks</h2>

              {sortedEmployees.length === 0 ? (
                <p className="todo-empty todo-empty--team">
                  No team members yet.
                  <br />
                  Add people to organize tasks by person.
                </p>
              ) : (
                sortedEmployees.map((employee) => {
                  const active = employeeActiveTasks(employee.id);
                  const completed = employeeCompletedTasks(employee.id);
                  return (
                    <PersonSection
                      key={employee.id}
                      sectionKey={employee.id}
                      title={employee.name}
                      initial={employee.name.trim().charAt(0).toUpperCase() || '?'}
                      activeTasks={active}
                      completedTasks={completed}
                      employees={employees}
                      expanded={Boolean(expandedCompletedGroups[employee.id])}
                      onToggleCompleted={() => toggleCompletedGroup(employee.id)}
                      mutatingTaskIds={mutatingTaskIds}
                      mutationsBlocked={mutationsBlocked}
                      onEdit={(task) =>
                        setTaskModal({ open: true, mode: 'edit', task })
                      }
                      onComplete={(taskId) => {
                        void handleComplete(taskId);
                      }}
                      onRestore={(taskId) => {
                        void handleRestore(taskId);
                      }}
                    />
                  );
                })
              )}

              <PersonSection
                sectionKey={UNASSIGNED_KEY}
                title="Unassigned"
                subtitle="Tasks not assigned to anyone."
                activeTasks={unassignedActive}
                completedTasks={unassignedCompleted}
                employees={employees}
                expanded={Boolean(expandedCompletedGroups[UNASSIGNED_KEY])}
                onToggleCompleted={() => toggleCompletedGroup(UNASSIGNED_KEY)}
                mutatingTaskIds={mutatingTaskIds}
                mutationsBlocked={mutationsBlocked}
                onEdit={(task) =>
                  setTaskModal({ open: true, mode: 'edit', task })
                }
                onComplete={(taskId) => {
                  void handleComplete(taskId);
                }}
                onRestore={(taskId) => {
                  void handleRestore(taskId);
                }}
              />
            </section>
          ) : null}
        </div>
      </main>

      <ManagePeopleModal
        open={peopleOpen}
        employees={employees}
        busy={peopleBusy}
        error={peopleError}
        onClose={() => setPeopleOpen(false)}
        onAdd={handleAddPerson}
      />

      <TaskFormModal
        open={taskModal.open}
        mode={taskModal.open ? taskModal.mode : 'create'}
        employees={employees}
        departmentOptions={departmentOptions}
        task={taskModal.open ? taskModal.task : null}
        busy={taskBusy}
        error={taskError}
        onClose={() => setTaskModal({ open: false })}
        onSave={handleSaveTask}
      />
    </div>
  );
}
