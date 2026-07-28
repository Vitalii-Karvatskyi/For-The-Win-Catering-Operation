import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { TodoEmployee } from '../../types/todo';

type ManagePeopleModalProps = {
  open: boolean;
  employees: TodoEmployee[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
  onRename: (employeeId: string, name: string) => Promise<void>;
};

export function ManagePeopleModal({
  open,
  employees,
  busy,
  error,
  onClose,
  onAdd,
  onRename,
}: ManagePeopleModalProps) {
  const titleId = useId();
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName('');
    setLocalError(null);
    setEditingId(null);
    setEditName('');
    setEditError(null);
    setIsSavingEdit(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function startEdit(employee: TodoEmployee) {
    if (busy || isSavingEdit) {
      return;
    }
    setEditingId(employee.id);
    setEditName(employee.name);
    setEditError(null);
  }

  function cancelEdit() {
    if (isSavingEdit) {
      return;
    }
    setEditingId(null);
    setEditName('');
    setEditError(null);
  }

  async function handleSaveEdit(employeeId: string) {
    if (isSavingEdit || busy) {
      return;
    }
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('Name is required.');
      return;
    }
    const duplicate = employees.some(
      (employee) =>
        employee.id !== employeeId &&
        employee.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setEditError('A person with this name already exists.');
      return;
    }

    setEditError(null);
    setIsSavingEdit(true);
    try {
      await onRename(employeeId, trimmed);
      setEditingId(null);
      setEditName('');
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Unable to update person.',
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || isSavingEdit) {
      return;
    }
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
  const formLocked = busy || isSavingEdit;

  return createPortal(
    <div className="ops-modal todo-form-modal" role="presentation">
      <button
        type="button"
        className="ops-modal__backdrop"
        aria-label="Close"
        onClick={() => {
          if (!formLocked) {
            onClose();
          }
        }}
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
            disabled={formLocked}
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
              {employees.map((employee) => {
                const isEditing = editingId === employee.id;
                return (
                  <li key={employee.id} className="todo-people-list__item">
                    {isEditing ? (
                      <div className="todo-person-edit">
                        <input
                          type="text"
                          className="todo-person-edit__input"
                          value={editName}
                          disabled={isSavingEdit}
                          autoComplete="off"
                          aria-label={`Edit name for ${employee.name}`}
                          onChange={(event) => {
                            setEditName(event.target.value);
                            setEditError(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelEdit();
                            }
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void handleSaveEdit(employee.id);
                            }
                          }}
                        />
                        <div className="todo-person-edit-actions">
                          <button
                            type="button"
                            className="ops-btn ops-btn--primary"
                            disabled={isSavingEdit}
                            onClick={() => void handleSaveEdit(employee.id)}
                          >
                            {isSavingEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="ops-btn ops-btn--ghost"
                            disabled={isSavingEdit}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                        {editError ? (
                          <p className="ops-field__error" role="alert">
                            {editError}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="todo-people-list__row">
                        <span className="todo-people-list__name">
                          {employee.name}
                        </span>
                        <button
                          type="button"
                          className="ops-btn ops-btn--ghost todo-person-edit-trigger"
                          disabled={formLocked}
                          aria-label={`Edit ${employee.name}`}
                          onClick={() => startEdit(employee)}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
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
                disabled={formLocked}
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
              disabled={formLocked}
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
            disabled={formLocked}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
