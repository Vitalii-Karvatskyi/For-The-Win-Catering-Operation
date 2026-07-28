import { useEffect, useId, useState, type FormEvent } from 'react';
import type { TodoEmployee } from '../../types/todo';

type ManagePeopleModalProps = {
  open: boolean;
  employees: TodoEmployee[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
};

export function ManagePeopleModal({
  open,
  employees,
  busy,
  error,
  onClose,
  onAdd,
}: ManagePeopleModalProps) {
  const titleId = useId();
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName('');
    setLocalError(null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError('Name is required.');
      return;
    }
    const duplicate = employees.some(
      (employee) => employee.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setLocalError('A person with this name already exists.');
      return;
    }
    setLocalError(null);
    try {
      await onAdd(trimmed);
      setName('');
    } catch {
      // Parent keeps modal open and sets error.
    }
  }

  const displayError = localError ?? error;

  return (
    <div className="ops-modal" role="presentation">
      <button
        type="button"
        className="ops-modal__backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="ops-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="ops-modal__header">
          <h2 id={titleId} className="ops-modal__title">
            Manage People
          </h2>
          <button
            type="button"
            className="ops-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="ops-modal__body">
          {employees.length === 0 ? (
            <p className="todo-empty">No people yet. Add the first person below.</p>
          ) : (
            <ul className="todo-people-list">
              {employees.map((employee) => (
                <li key={employee.id}>{employee.name}</li>
              ))}
            </ul>
          )}

          <form
            className="todo-people-form"
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
          >
            <div className="ops-field ops-field--full">
              <label htmlFor="todo-person-name">Name</label>
              <input
                id="todo-person-name"
                type="text"
                value={name}
                disabled={busy}
                autoComplete="off"
                onChange={(event) => {
                  setName(event.target.value);
                  setLocalError(null);
                }}
              />
            </div>
            {displayError ? (
              <p className="ops-field__error" role="alert">
                {displayError}
              </p>
            ) : null}
            <button
              type="submit"
              className="ops-btn ops-btn--primary"
              disabled={busy}
            >
              {busy ? 'Saving...' : 'Add Person'}
            </button>
          </form>
        </div>

        <div className="ops-modal__footer">
          <button
            type="button"
            className="ops-btn ops-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
