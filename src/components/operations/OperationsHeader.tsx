import { ftwAssets } from '../../config/ftwAssets';

type OperationsHeaderProps = {
  onAddCatering: () => void;
  onRefresh: () => void;
  onDisconnect: () => void;
  connected: boolean;
  refreshBusy: boolean;
  statusLabel: string;
};

export function OperationsHeader({
  onAddCatering,
  onRefresh,
  onDisconnect,
  connected,
  refreshBusy,
  statusLabel,
}: OperationsHeaderProps) {
  return (
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
              <h1 className="ops-header__title">Catering Operations</h1>
              <p className="ops-header__subtitle">Upcoming events and preparation</p>
            </div>
          </div>
          <div className="ops-header__actions">
            <span
              className={`ops-header__status ${
                connected ? 'ops-header__status--ok' : 'ops-header__status--warn'
              }`}
              aria-live="polite"
            >
              {statusLabel}
            </span>
            {connected ? (
              <>
                <button
                  type="button"
                  className="ops-btn ops-btn--secondary"
                  onClick={onRefresh}
                  disabled={refreshBusy}
                >
                  {refreshBusy ? 'Refreshing...' : 'Refresh Data'}
                </button>
                <button
                  type="button"
                  className="ops-btn ops-btn--ghost ops-header__disconnect"
                  onClick={onDisconnect}
                >
                  Disconnect
                </button>
                <button
                  type="button"
                  className="ops-btn ops-btn--primary"
                  onClick={onAddCatering}
                >
                  Add Catering
                </button>
              </>
            ) : null}
            <span className="ops-header__badge">Internal Use</span>
          </div>
        </div>
      </div>
    </header>
  );
}
