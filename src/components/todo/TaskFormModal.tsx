import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
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
  deleting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: TodoTaskFormValues) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
};

export function TaskFormModal({
  open,
  mode,
  employees,
  departmentOptions,
  task,
  busy,
  deleting,
  error,
  onClose,
  onSave,
  onDelete,
}: TaskFormModalProps) {
  const titleId = useId();
  const datalistId = useId();
  const deleteTitleId = useId();
  const deleteDescriptionId = useId();
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement | null>(null);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);

  const isSaving = busy;
  const isDeleting = deleting;
  const formLocked = isSaving || isDeleting;

  useEffect(() => {
    if (!open) {
      setIsDeleteConfirmationOpen(false);
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
    setIsDeleteConfirmationOpen(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mode, task]);

  useEffect(() => {
    if (!isDeleteConfirmationOpen) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      deleteCancelRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isDeleteConfirmationOpen]);

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
    if (formLocked || isDeleteConfirmationOpen) {
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

  function openDeleteConfirmation() {
    if (formLocked || mode !== 'edit' || !task?.id || !onDelete) {
      return;
    }
    setLocalError(null);
    setIsDeleteConfirmationOpen(true);
  }

  function closeDeleteConfirmation() {
    if (isDeleting) {
      return;
    }
    setIsDeleteConfirmationOpen(false);
    window.requestAnimationFrame(() => {
      deleteButtonRef.current?.focus();
    });
  }

  async function confirmDelete() {
    if (isDeleting || isSaving || !task?.id || !onDelete) {
      return;
    }
    try {
      await onDelete(task.id);
      setIsDeleteConfirmationOpen(false);
    } catch {
      // Parent keeps Edit modal open and sets error.
    }
  }

  const displayError = localError ?? error;
  const heading = mode === 'edit' ? 'Edit Task' : 'Add Task';
  const canSave = title.trim().length > 0 && !formLocked;
  const showDelete =
    mode === 'edit' && Boolean(task?.id) && typeof onDelete === 'function';

  return createPortal(
    <div className="ops-modal todo-form-modal" role="presentation">
      <button
        type="button"
        className="ops-modal__backdrop"
        aria-label="Close"
        onClick={() => {
          if (!formLocked && !isDeleteConfirmationOpen) {
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
            disabled={formLocked || isDeleteConfirmationOpen}
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
                  disabled={formLocked}
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
                  disabled={formLocked}
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
                  disabled={formLocked}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <fieldset className="todo-assignees" disabled={formLocked}>
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
                              disabled={formLocked}
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
                  disabled={formLocked}
                  onChange={(event) => setDeadlineDate(event.target.value)}
                />
              </div>

              <div className="ops-field ops-field--full">
                <label htmlFor="todo-task-notes">Notes</label>
                <textarea
                  id="todo-task-notes"
                  rows={3}
                  value={notes}
                  disabled={formLocked}
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

          <div
            className={`ops-modal__footer${
              showDelete ? ' todo-task-form-footer--with-delete' : ''
            }`}
          >
            {showDelete ? (
              <button
                ref={deleteButtonRef}
                type="button"
                className="ops-btn todo-delete-task-button"
                disabled={formLocked}
                aria-label={`Delete task: ${task?.title ?? title}`}
                onClick={openDeleteConfirmation}
              >
                Delete Task
              </button>
            ) : null}
            <div className="todo-task-form-footer__actions">
              <button
                type="button"
                className="ops-btn ops-btn--ghost"
                disabled={formLocked}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ops-btn ops-btn--primary"
                disabled={!canSave}
              >
                {isSaving
                  ? 'Saving...'
                  : mode === 'edit'
                    ? 'Save Changes'
                    : 'Save Task'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {isDeleteConfirmationOpen && task ? (
        <div className="todo-delete-confirmation" role="presentation">
          <button
            type="button"
            className="ops-modal__backdrop todo-delete-confirmation__backdrop"
            aria-label="Close delete confirmation"
            disabled={isDeleting}
            onClick={closeDeleteConfirmation}
          />
          <div
            className="ops-modal__dialog todo-delete-confirmation__dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={deleteTitleId}
            aria-describedby={deleteDescriptionId}
          >
            <div className="ops-modal__header">
              <h2 id={deleteTitleId} className="ops-modal__title">
                Delete Task?
              </h2>
            </div>
            <div className="ops-modal__body">
              <p id={deleteDescriptionId}>
                This task will be permanently removed for everyone assigned to
                it. This action cannot be undone.
              </p>
              <p className="todo-delete-confirmation__task">
                <span className="todo-delete-confirmation__task-label">
                  Task:
                </span>{' '}
                <strong>{task.title}</strong>
              </p>
            </div>
            <div className="ops-modal__footer">
              <button
                ref={deleteCancelRef}
                type="button"
                className="ops-btn ops-btn--ghost"
                disabled={isDeleting}
                onClick={closeDeleteConfirmation}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ops-btn todo-delete-task-button"
                disabled={isDeleting}
                aria-label={`Confirm delete task: ${task.title}`}
                onClick={() => void confirmDelete()}
              >
                {isDeleting ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
