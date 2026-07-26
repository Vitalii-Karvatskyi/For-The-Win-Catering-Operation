import { useEffect, useId, useState, type FormEvent } from 'react';

type ConnectGitHubModalProps = {
  open: boolean;
  busy: boolean;
  error: string | null;
  onConnect: (token: string) => Promise<void>;
};

export function ConnectGitHubModal({
  open,
  busy,
  error,
  onConnect,
}: ConnectGitHubModalProps) {
  const titleId = useId();
  const [token, setToken] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setToken('');
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
    const trimmed = token.trim();
    if (!trimmed) {
      setLocalError('GitHub Token is required.');
      return;
    }
    setLocalError(null);
    await onConnect(trimmed);
  }

  const displayError = localError ?? error;

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
            Connect GitHub
          </h2>
        </div>

        <form className="ops-modal__form" onSubmit={handleSubmit} noValidate>
          <div className="ops-modal__body">
            <p className="ops-connect__description">
              Enter the fine-grained GitHub token for the FTW Catering Operations
              repository. The token will be saved in this browser so you do not need
              to enter it again on this device.
            </p>
            <p className="ops-connect__warning">
              Only use this on a trusted personal device.
            </p>

            <div className="ops-field ops-field--full">
              <label htmlFor="github-token-input">GitHub Token</label>
              <input
                id="github-token-input"
                type="password"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={token}
                disabled={busy}
                onChange={(event) => {
                  setToken(event.target.value);
                  setLocalError(null);
                }}
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
              type="submit"
              className="ops-btn ops-btn--primary"
              disabled={busy}
            >
              {busy ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
