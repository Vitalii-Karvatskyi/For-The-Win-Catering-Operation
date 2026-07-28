import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TodoCryptoKeys, TodoEmployee, TodoTask } from '../../types/todo';
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
  createTodoId,
  deadlineStatus,
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
    onDecryptFailure();
  }, [clearDecryptedState, onDecryptFailure]);

  const loadData = useCallback(async () => {
    if (!keys) {
      clearDecryptedState();
      return;
    }

    setPhase('loading');
    setError(null);
    setMutationsBlocked(false);

    try {
      const [nextEmployees, nextTasks] = await Promise.all([
        loadTodoEmployees(keys.employeesKey),
        loadTodoTasks(keys.tasksKey),
      ]);
      setEmployees(nextEmployees);
      setTasks(nextTasks);
      setPhase('ready');
    } catch (err) {
      if (err instanceof TodoCryptoError) {
        handleCryptoFailure();
        return;
      }
      if (err instanceof GitHubApiError && err.code === 'unauthorized') {
        clearDecryptedState();
        onAuthFailure('GitHub access expired. Enter a new token.');
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
  }, [keys, clearDecryptedState, handleCryptoFailure, onAuthFailure]);

  useEffect(() => {
    if (!unlocked || !keys) {
      clearDecryptedState();
      return;
    }
    void loadData();
  }, [unlocked, keys, loadData, clearDecryptedState]);

  const activeTasks = useMemo(
    () => sortActiveTasks(tasks.filter((task) => !task.completed)),
    [tasks],
  );
  const completedTasks = useMemo(
    () => sortCompletedTasks(tasks.filter((task) => task.completed)),
    [tasks],
  );

  async function handleRefresh() {
    if (!keys || refreshBusy) {
      return;
    }
    setRefreshBusy(true);
    setBanner(null);
    await loadData();
    setRefreshBusy(false);
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
        onAuthFailure('GitHub access expired. Enter a new token.');
        throw err;
      }
      setPeopleError(err instanceof Error ? err.message : 'Unable to add person.');
      throw err;
    } finally {
      setPeopleBusy(false);
    }
  }

  async function handleSaveTask(values: {
    title: string;
    description: string;
    assigneeIds: string[];
    deadlineDate: string;
  }) {
    if (!keys || mutationsBlocked || !taskModal.open) {
      return;
    }
    setTaskBusy(true);
    setTaskError(null);
    try {
      if (taskModal.mode === 'create') {
        const now = new Date().toISOString();
        const task: TodoTask = {
          id: createTodoId('task'),
          title: values.title,
          description: values.description || undefined,
          assigneeIds: values.assigneeIds,
          createdAt: now,
          updatedAt: now,
          deadlineDate: values.deadlineDate || undefined,
          completed: false,
          completedAt: null,
        };
        const next = await createTodoTask(task, keys.tasksKey);
        setTasks(next);
        setBanner('Task added.');
      } else if (taskModal.task) {
        const next = await updateTodoTask(
          taskModal.task.id,
          {
            title: values.title,
            description: values.description,
            assigneeIds: values.assigneeIds,
            deadlineDate: values.deadlineDate,
          },
          keys.tasksKey,
        );
        setTasks(next);
        setBanner('Task updated.');
      }
      setTaskModal({ open: false });
    } catch (err) {
      if (err instanceof TodoCryptoError) {
        handleCryptoFailure();
        throw err;
      }
      if (err instanceof GitHubApiError && err.code === 'unauthorized') {
        onAuthFailure('GitHub access expired. Enter a new token.');
        throw err;
      }
      setTaskError(err instanceof Error ? err.message : 'Unable to save task.');
      throw err;
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
      const next = await completeTodoTask(taskId, keys.tasksKey);
      setTasks(next);
    } catch (err) {
      if (err instanceof TodoCryptoError) {
        handleCryptoFailure();
        return;
      }
      if (err instanceof GitHubApiError && err.code === 'unauthorized') {
        onAuthFailure('GitHub access expired. Enter a new token.');
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
      const next = await restoreTodoTask(taskId, keys.tasksKey);
      setTasks(next);
    } catch (err) {
      if (err instanceof TodoCryptoError) {
        handleCryptoFailure();
        return;
      }
      if (err instanceof GitHubApiError && err.code === 'unauthorized') {
        onAuthFailure('GitHub access expired. Enter a new token.');
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

  function renderAssignees(task: TodoTask) {
    const assignees = resolveAssignees(task.assigneeIds, employees);
    if (assignees.length === 0) {
      return <span className="todo-chip todo-chip--muted">Unassigned</span>;
    }
    return assignees.map((person) => (
      <span key={person.id} className="todo-chip">
        {person.name}
      </span>
    ));
  }

  function renderDeadline(task: TodoTask) {
    if (!task.deadlineDate) {
      return null;
    }
    const status = deadlineStatus(task.deadlineDate);
    return (
      <p className="todo-task__meta">
        Deadline: {formatLocalDateLabel(task.deadlineDate)}
        {status === 'overdue' ? (
          <span className="todo-label todo-label--overdue">Overdue</span>
        ) : null}
        {status === 'today' ? (
          <span className="todo-label todo-label--today">Due today</span>
        ) : null}
      </p>
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
                    disabled={!keys || phase !== 'ready' || mutationsBlocked}
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
                  <ul className="todo-task-list">
                    {activeTasks.map((task) => {
                      const busy = mutatingTaskIds.has(task.id);
                      return (
                        <li key={task.id} className="todo-task">
                          <div className="todo-task__body">
                            <h3 className="todo-task__title">{task.title}</h3>
                            {task.description ? (
                              <p className="todo-task__description">
                                {task.description}
                              </p>
                            ) : null}
                            <div className="todo-task__chips">
                              {renderAssignees(task)}
                            </div>
                            {renderDeadline(task)}
                            <p className="todo-task__meta">
                              Created: {formatLocalDateTime(task.createdAt)}
                            </p>
                          </div>
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
                    <ul className="todo-task-list">
                      {completedTasks.map((task) => {
                        const busy = mutatingTaskIds.has(task.id);
                        return (
                          <li
                            key={task.id}
                            className="todo-task todo-task--completed"
                          >
                            <div className="todo-task__body">
                              <h3 className="todo-task__title">{task.title}</h3>
                              {task.description ? (
                                <p className="todo-task__description">
                                  {task.description}
                                </p>
                              ) : null}
                              <div className="todo-task__chips">
                                {renderAssignees(task)}
                              </div>
                              {task.deadlineDate ? (
                                <p className="todo-task__meta">
                                  Deadline:{' '}
                                  {formatLocalDateLabel(task.deadlineDate)}
                                </p>
                              ) : null}
                              {task.completedAt ? (
                                <p className="todo-task__meta">
                                  Completed:{' '}
                                  {formatLocalDateTime(task.completedAt)}
                                </p>
                              ) : null}
                            </div>
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
        task={taskModal.open ? taskModal.task : null}
        busy={taskBusy}
        error={taskError}
        onClose={() => setTaskModal({ open: false })}
        onSave={handleSaveTask}
      />
    </div>
  );
}
