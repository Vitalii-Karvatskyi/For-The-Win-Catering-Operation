import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type {
  TodoEmployee,
  TodoTask,
  TodoTaskFormValues,
} from '../../types/todo';

const DEPARTMENT_SUGGESTIONS = [
  'Financial',
  'Marketing',
  'Account Management',
  'Business Development',
  'Opps',
  'Brentwood',
  'Cypress Park',
  'Alhambra',
  'Hollywood',
  'Fleet / Warehouse / General',
];

type TaskFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  employees: TodoEmployee[];
  departmentOptions: string[];
  task: TodoTask | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: TodoTaskFormValues) => Promise<void>;
};

export function TaskFormModal({
  open,
  mode,
  employees,
  departmentOptions,
  task,
  busy,
  error,
  onClose,
  onSave,
}: TaskFormModalProps) {
  const titleId = useId();
  const datalistId = useId();
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === 'edit' && task) {
      setTitle(task.title);
      setDepartment(task.department ?? '');
      setDescription(task.description ?? '');
      setNotes(task.notes ?? '');
      setAssigneeIds([...task.assigneeIds]);
      setDeadlineDate(task.deadlineDate ?? '');
    } else {
      setTitle('');
      setDepartment('');
      setDescription('');
      setNotes('');
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

  const suggestions = useMemo(() => {
    const merged = new Set<string>([
      ...DEPARTMENT_SUGGESTIONS,
      ...departmentOptions,
    ]);
    return [...merged].sort((a, b) => a.localeCompare(b));
  }, [departmentOptions]);

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

  function clearForm() {
    setTitle('');
    setDepartment('');
    setDescription('');
    setNotes('');
    setAssigneeIds([]);
    setDeadlineDate('');
    setLocalError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setLocalError('Task Name is required.');
      return;
    }
    setLocalError(null);
    try {
      await onSave({
        title: trimmedTitle,
        department: department.trim(),
        description: description.trim(),
        notes: notes.trim(),
        assigneeIds,
        deadlineDate: deadlineDate.trim(),
      });
      clearForm();
    } catch {
      // Parent keeps modal open and preserves form values.
    }
  }

  const displayError = localError ?? error;
  const heading = mode === 'edit' ? 'Edit Task' : 'Add Task';
  const canSave = title.trim().length > 0 && !busy;

  return createPortal(
    <div className="ops-modal todo-form-modal" role="presentation">
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
        className="ops-modal__dialog todo-task-form-dialog"
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
            <div className="todo-task-form-grid">
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
                <label htmlFor="todo-task-department">Department</label>
                <input
                  id="todo-task-department"
                  type="text"
                  list={datalistId}
                  value={department}
                  disabled={busy}
                  onChange={(event) => setDepartment(event.target.value)}
                />
                <datalist id={datalistId}>
                  {suggestions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </div>

              <div className="ops-field ops-field--full">
                <label htmlFor="todo-task-description">Description</label>
                <textarea
                  id="todo-task-description"
                  rows={3}
                  value={description}
                  disabled={busy}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <fieldset className="todo-assignees">
                <legend>Assign To</legend>
                {employees.length === 0 ? (
                  <p className="todo-empty">
                    No people yet. Tasks can stay unassigned.
                  </p>
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

              <div className="ops-field ops-field--full">
                <label htmlFor="todo-task-notes">Notes</label>
                <textarea
                  id="todo-task-notes"
                  rows={3}
                  value={notes}
                  disabled={busy}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              {displayError ? (
                <p className="ops-field__error" role="alert">
                  {displayError}
                </p>
              ) : null}
            </div>
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
              disabled={!canSave}
            >
              {busy ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
