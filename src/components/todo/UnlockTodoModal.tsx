import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { verifyTodoPassword } from '../../services/todoCryptoService';

type UnlockTodoModalProps = {
  open: boolean;
  busy: boolean;
  onUnlock: (password: string) => Promise<void>;
  onBackToCatering: () => void;
};

export function UnlockTodoModal({
  open,
  busy,
  onUnlock,
  onBackToCatering,
}: UnlockTodoModalProps) {
  const titleId = useId();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPassword('');
    setError(null);
    setVerifying(false);
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
    if (busy || verifying) {
      return;
    }
    const value = password;
    if (!value) {
      setError('Incorrect password.');
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const ok = await verifyTodoPassword(value);
      if (!ok) {
        setError('Incorrect password.');
        return;
      }
      await onUnlock(value);
      setPassword('');
    } catch {
      setError('Incorrect password.');
    } finally {
      setVerifying(false);
    }
  }

  const unlocking = busy || verifying;

  return createPortal(
    <div className="todo-unlock-overlay" role="presentation">
      <div
        className="todo-unlock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="todo-unlock-dialog__title">
          Unlock To Do
        </h2>
        <p className="todo-unlock-dialog__description">
          Enter the To Do password to access tasks and team members on this
          device.
        </p>

        <form
          className="todo-unlock-dialog__form"
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          <div className="todo-unlock-dialog__field">
            <label htmlFor="todo-password-input">Password</label>
            <input
              id="todo-password-input"
              type="password"
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              value={password}
              disabled={unlocking}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
            />
          </div>

          {error ? (
            <p className="todo-unlock-dialog__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="todo-unlock-dialog__actions">
            <button
              type="button"
              className="ops-btn ops-btn--ghost"
              onClick={() => {
                setPassword('');
                setError(null);
                onBackToCatering();
              }}
            >
              Back to Catering
            </button>
            <button
              type="submit"
              className="ops-btn ops-btn--primary"
              disabled={unlocking}
            >
              {unlocking ? 'Unlocking...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
