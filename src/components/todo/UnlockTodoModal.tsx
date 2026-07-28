import { useEffect, useId, useState, type FormEvent } from 'react';
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
        setVerifying(false);
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

  const locked = busy || verifying;

  return (
    <div className="ops-modal ops-modal--blocking" role="presentation">
      <div className="ops-modal__backdrop" aria-hidden="true" />
      <div
        className="ops-modal__dialog ops-modal__dialog--connect"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="ops-modal__header">
          <h2 id={titleId} className="ops-modal__title">
            Unlock To Do
          </h2>
        </div>

        <form className="ops-modal__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="ops-modal__body">
            <p className="ops-connect__description">
              Enter the To Do password to access tasks and team members on this
              device.
            </p>

            <div className="ops-field ops-field--full">
              <label htmlFor="todo-password-input">Password</label>
              <input
                id="todo-password-input"
                type="password"
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                value={password}
                disabled={locked}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
              />
            </div>

            {error ? (
              <p className="ops-field__error" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="ops-modal__footer">
            <button
              type="button"
              className="ops-btn ops-btn--ghost"
              disabled={locked}
              onClick={onBackToCatering}
            >
              Back to Catering
            </button>
            <button
              type="submit"
              className="ops-btn ops-btn--primary"
              disabled={locked}
            >
              {locked ? 'Unlocking...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
