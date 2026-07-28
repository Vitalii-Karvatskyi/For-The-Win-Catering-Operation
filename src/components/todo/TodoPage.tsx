import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [completedOpen, setCompletedOpen] = useState(false);
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
    setCompletedOpen(false);
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
    // Only reload when unlock/session keys change — not when parent callbacks change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable reload gate
  }, [unlocked, keys]);

  const activeTasks = useMemo(
    () => sortActiveTasks(tasks.filter((task) => !task.completed)),
    [tasks],
  );
  const completedTasks = useMemo(
    () => sortCompletedTasks(tasks.filter((task) => task.completed)),
    [tasks],
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
        // Bump generation so an in-flight stale load cannot overwrite this save.
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
      setTaskError(
        err instanceof Error ? err.message : 'Save failed.',
      );
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

  function assigneeLabel(task: TodoTask): string {
    const assignees = resolveAssignees(task.assigneeIds, employees);
    if (assignees.length === 0) {
      return 'Unassigned';
    }
    return assignees.map((person) => person.name).join(', ');
  }

  function statusClass(label: string): string {
    if (label === 'Overdue') return 'todo-status todo-status--overdue';
    if (label === 'Due Today') return 'todo-status todo-status--today';
    return 'todo-status';
  }

  function renderTaskExtras(task: TodoTask) {
    return (
      <>
        {task.description ? (
          <p className="todo-task__description">{task.description}</p>
        ) : null}
        {task.notes ? (
          <p className="todo-task__notes">Notes: {task.notes}</p>
        ) : null}
      </>
    );
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
                    disabled={!keys || phase !== 'ready' || mutationsBlocked || taskBusy}
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
            <>
              <section className="todo-section">
                <h2 className="todo-section__title">Active Tasks</h2>
                {activeTasks.length === 0 ? (
                  <p className="todo-empty">No active tasks.</p>
                ) : (
                  <>
                    <div className="todo-table-wrap" aria-hidden="false">
                      <table className="todo-table">
                        <thead>
                          <tr>
                            <th scope="col">Status</th>
                            <th scope="col">Department</th>
                            <th scope="col">Quick Note Task</th>
                            <th scope="col">Amount / Due Date</th>
                            <th scope="col">Involvement</th>
                            <th scope="col">Assigned To</th>
                            <th scope="col">Deadline</th>
                            <th scope="col">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTasks.map((task) => {
                            const busy = mutatingTaskIds.has(task.id);
                            const status = activeTaskStatusLabel(task.deadlineDate);
                            return (
                              <tr key={task.id}>
                                <td>
                                  <span className={statusClass(status)}>
                                    {status}
                                  </span>
                                </td>
                                <td>{task.department?.trim() || '—'}</td>
                                <td>
                                  <div className="todo-table__task">
                                    <strong>{task.title}</strong>
                                    {renderTaskExtras(task)}
                                  </div>
                                </td>
                                <td>{task.amountOrDueDate?.trim() || '—'}</td>
                                <td>{task.involvement?.trim() || '—'}</td>
                                <td>{assigneeLabel(task)}</td>
                                <td>
                                  {task.deadlineDate
                                    ? formatLocalDateLabel(task.deadlineDate)
                                    : 'No deadline'}
                                </td>
                                <td>
                                  <div className="todo-task__actions">
                                    <button
                                      type="button"
                                      className="ops-btn ops-btn--ghost"
                                      disabled={busy || mutationsBlocked}
                                      onClick={() =>
                                        setTaskModal({
                                          open: true,
                                          mode: 'edit',
                                          task,
                                        })
                                      }
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="ops-btn ops-btn--primary"
                                      disabled={busy || mutationsBlocked}
                                      onClick={() => {
                                        void handleComplete(task.id);
                                      }}
                                    >
                                      {busy ? 'Completing...' : 'Complete'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <ul className="todo-card-list">
                      {activeTasks.map((task) => {
                        const busy = mutatingTaskIds.has(task.id);
                        const status = activeTaskStatusLabel(task.deadlineDate);
                        return (
                          <li key={task.id} className="todo-card">
                            <p className={statusClass(status)}>{status}</p>
                            {task.department?.trim() ? (
                              <p className="todo-card__row">
                                <span>Department</span>
                                <strong>{task.department}</strong>
                              </p>
                            ) : null}
                            <h3 className="todo-task__title">{task.title}</h3>
                            {renderTaskExtras(task)}
                            {task.amountOrDueDate?.trim() ? (
                              <p className="todo-card__row">
                                <span>Amount / Due Date</span>
                                <strong>{task.amountOrDueDate}</strong>
                              </p>
                            ) : null}
                            {task.involvement?.trim() ? (
                              <p className="todo-card__row">
                                <span>Involvement</span>
                                <strong>{task.involvement}</strong>
                              </p>
                            ) : null}
                            <p className="todo-card__row">
                              <span>Assigned To</span>
                              <strong>{assigneeLabel(task)}</strong>
                            </p>
                            <p className="todo-card__row">
                              <span>Deadline</span>
                              <strong>
                                {task.deadlineDate
                                  ? formatLocalDateLabel(task.deadlineDate)
                                  : 'No deadline'}
                              </strong>
                            </p>
                            <div className="todo-task__actions">
                              <button
                                type="button"
                                className="ops-btn ops-btn--ghost"
                                disabled={busy || mutationsBlocked}
                                onClick={() =>
                                  setTaskModal({
                                    open: true,
                                    mode: 'edit',
                                    task,
                                  })
                                }
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="ops-btn ops-btn--primary"
                                disabled={busy || mutationsBlocked}
                                onClick={() => {
                                  void handleComplete(task.id);
                                }}
                              >
                                {busy ? 'Completing...' : 'Complete'}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>

              <section className="todo-section">
                <button
                  type="button"
                  className="todo-completed-toggle"
                  aria-expanded={completedOpen}
                  onClick={() => setCompletedOpen((open) => !open)}
                >
                  Completed Tasks ({completedTasks.length})
                  <span aria-hidden="true">{completedOpen ? '▾' : '▸'}</span>
                </button>
                {completedOpen ? (
                  completedTasks.length === 0 ? (
                    <p className="todo-empty">No completed tasks.</p>
                  ) : (
                    <ul className="todo-card-list todo-card-list--always">
                      {completedTasks.map((task) => {
                        const busy = mutatingTaskIds.has(task.id);
                        return (
                          <li
                            key={task.id}
                            className="todo-card todo-card--completed"
                          >
                            {task.department?.trim() ? (
                              <p className="todo-card__row">
                                <span>Department</span>
                                <strong>{task.department}</strong>
                              </p>
                            ) : null}
                            <h3 className="todo-task__title">{task.title}</h3>
                            {renderTaskExtras(task)}
                            {task.amountOrDueDate?.trim() ? (
                              <p className="todo-card__row">
                                <span>Amount / Due Date</span>
                                <strong>{task.amountOrDueDate}</strong>
                              </p>
                            ) : null}
                            {task.involvement?.trim() ? (
                              <p className="todo-card__row">
                                <span>Involvement</span>
                                <strong>{task.involvement}</strong>
                              </p>
                            ) : null}
                            <p className="todo-card__row">
                              <span>Assigned To</span>
                              <strong>{assigneeLabel(task)}</strong>
                            </p>
                            {task.deadlineDate ? (
                              <p className="todo-card__row">
                                <span>Deadline</span>
                                <strong>
                                  {formatLocalDateLabel(task.deadlineDate)}
                                </strong>
                              </p>
                            ) : null}
                            {task.completedAt ? (
                              <p className="todo-card__row">
                                <span>Completed</span>
                                <strong>
                                  {formatLocalDateTime(task.completedAt)}
                                </strong>
                              </p>
                            ) : null}
                            <div className="todo-task__actions">
                              <button
                                type="button"
                                className="ops-btn ops-btn--secondary"
                                disabled={busy || mutationsBlocked}
                                onClick={() => {
                                  void handleRestore(task.id);
                                }}
                              >
                                {busy ? 'Restoring...' : 'Restore'}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )
                ) : null}
              </section>
            </>
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
