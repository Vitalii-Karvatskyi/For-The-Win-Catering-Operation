import { useEffect, useId, useState, type FormEvent } from 'react';
import type { TodoEmployee, TodoTask } from '../../types/todo';

type TaskFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  employees: TodoEmployee[];
  task: TodoTask | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: {
    title: string;
    description: string;
    assigneeIds: string[];
    deadlineDate: string;
  }) => Promise<void>;
};

export function TaskFormModal({
  open,
  mode,
  employees,
  task,
  busy,
  error,
  onClose,
  onSave,
}: TaskFormModalProps) {
  const titleId = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === 'edit' && task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setAssigneeIds([...task.assigneeIds]);
      setDeadlineDate(task.deadlineDate ?? '');
    } else {
      setTitle('');
      setDescription('');
      setAssigneeIds([]);
      setDeadlineDate('');
    }
    setLocalError(null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mode, task]);

  if (!open) {
    return null;
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setLocalError('Task Name is required.');
      return;
    }
    setLocalError(null);
    try {
      await onSave({
        title: trimmedTitle,
        description: description.trim(),
        assigneeIds,
        deadlineDate: deadlineDate.trim(),
      });
    } catch {
      // Parent keeps modal open.
    }
  }

  const displayError = localError ?? error;
  const heading = mode === 'edit' ? 'Edit Task' : 'Add Task';

  return (
    <div className="ops-modal" role="presentation">
      <button
        type="button"
        className="ops-modal__backdrop"
        aria-label="Close"
        onClick={() => {
          if (!busy) {
            onClose();
          }
        }}
      />
      <div
        className="ops-modal__dialog ops-modal__dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="ops-modal__header">
          <h2 id={titleId} className="ops-modal__title">
            {heading}
          </h2>
          <button
            type="button"
            className="ops-modal__close"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form
          className="ops-modal__form"
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          <div className="ops-modal__body">
            <div className="ops-field ops-field--full">
              <label htmlFor="todo-task-title">Task Name</label>
              <input
                id="todo-task-title"
                type="text"
                value={title}
                disabled={busy}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setLocalError(null);
                }}
              />
            </div>

            <div className="ops-field ops-field--full">
              <label htmlFor="todo-task-description">Description</label>
              <textarea
                id="todo-task-description"
                rows={4}
                value={description}
                disabled={busy}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <fieldset className="todo-assignees">
              <legend>Assign To</legend>
              {employees.length === 0 ? (
                <p className="todo-empty">No people yet. Tasks can stay unassigned.</p>
              ) : (
                <ul className="todo-assignees__list">
                  {employees.map((employee) => {
                    const checked = assigneeIds.includes(employee.id);
                    return (
                      <li key={employee.id}>
                        <label className="todo-assignees__item">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy}
                            onChange={() => toggleAssignee(employee.id)}
                          />
                          <span>{employee.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {assigneeIds.length > 0 ? (
                <p className="todo-assignees__selected">
                  Selected:{' '}
                  {employees
                    .filter((employee) => assigneeIds.includes(employee.id))
                    .map((employee) => employee.name)
                    .join(', ')}
                </p>
              ) : (
                <p className="todo-assignees__selected">Unassigned</p>
              )}
            </fieldset>

            <div className="ops-field ops-field--full">
              <label htmlFor="todo-task-deadline">Deadline</label>
              <input
                id="todo-task-deadline"
                type="date"
                value={deadlineDate}
                disabled={busy}
                onChange={(event) => setDeadlineDate(event.target.value)}
              />
            </div>

            {displayError ? (
              <p className="ops-field__error" role="alert">
                {displayError}
              </p>
            ) : null}
          </div>

          <div className="ops-modal__footer">
            <button
              type="button"
              className="ops-btn ops-btn--ghost"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ops-btn ops-btn--primary"
              disabled={busy}
            >
              {busy ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
