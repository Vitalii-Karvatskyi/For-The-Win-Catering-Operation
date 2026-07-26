import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CateringEvent,
  CateringFormMode,
  Employee,
} from '../../types/cateringOperations';
import {
  getOperationsSummary,
  groupEventsByDate,
} from '../../lib/cateringOperations';
import {
  clearLocalCateringsSnapshot,
  hasLocalCateringsSnapshot,
} from '../../lib/cateringStorage';
import {
  clearLocalEmployeesSnapshot,
  hasLocalEmployeesSnapshot,
} from '../../lib/employeeStorage';
import {
  addEmployee as addEmployeeRemote,
  clearGitHubToken,
  createCatering,
  deleteCatering,
  detectLocalDataForMigration,
  getGitHubToken,
  GitHubApiError,
  loadCaterings,
  loadEmployees,
  setGitHubToken,
  testGitHubConnection,
  updateCatering,
  updateDocument,
  updatePreparationTask,
  uploadLocalData,
} from '../../services/githubDataService';
import { OperationsHeader } from './OperationsHeader';
import { OperationsSummary } from './OperationsSummary';
import { CateringEventList } from './CateringEventList';
import { EmptyState } from './EmptyState';
import { AddCateringModal } from './AddCateringModal';
import { ConnectGitHubModal } from './ConnectGitHubModal';
import '../../styles/operations.css';

type ModalState =
  | { open: false }
  | { open: true; mode: CateringFormMode; event: CateringEvent | null };

type ConnectionPhase =
  | 'checking'
  | 'needs-token'
  | 'loading-data'
  | 'ready'
  | 'data-error';

export function OperationsPage() {
  const [phase, setPhase] = useState<ConnectionPhase>('checking');
  const [statusLabel, setStatusLabel] = useState('Connecting...');
  const [events, setEvents] = useState<CateringEvent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [showMigration, setShowMigration] = useState(false);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [savingChecklistIds, setSavingChecklistIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const bootstrapped = useRef(false);

  const handleAuthFailure = useCallback((message?: string) => {
    clearGitHubToken();
    setEvents([]);
    setEmployees([]);
    setPhase('needs-token');
    setStatusLabel('Unable to connect to GitHub.');
    setConnectOpen(true);
    setConnectError(message ?? 'GitHub access expired. Enter a new token.');
    setBannerMessage(null);
    setShowMigration(false);
  }, []);

  const loadSharedData = useCallback(async () => {
    setPhase('loading-data');
    setStatusLabel('Loading shared data...');
    setDataError(null);

    try {
      const [nextEvents, nextEmployees] = await Promise.all([
        loadCaterings(),
        loadEmployees(),
      ]);
      setEvents(nextEvents);
      setEmployees(nextEmployees);
      setPhase('ready');
      setStatusLabel('GitHub Connected');
      setShowMigration(detectLocalDataForMigration());
      setConnectOpen(false);
      setConnectError(null);
    } catch (error) {
      if (error instanceof GitHubApiError && error.code === 'unauthorized') {
        handleAuthFailure('GitHub access expired. Enter a new token.');
        return;
      }
      if (error instanceof GitHubApiError && error.code === 'forbidden') {
        handleAuthFailure(error.message);
        return;
      }
      setPhase('data-error');
      setStatusLabel('Unable to connect to GitHub.');
      setDataError(
        error instanceof Error
          ? error.message
          : 'Unable to load shared catering data.',
      );
    }
  }, [handleAuthFailure]);

  const bootstrap = useCallback(async () => {
    setPhase('checking');
    setStatusLabel('Connecting...');
    setConnectError(null);

    const token = getGitHubToken();
    if (!token) {
      setPhase('needs-token');
      setStatusLabel('Unable to connect to GitHub.');
      setConnectOpen(true);
      return;
    }

    const result = await testGitHubConnection(token);
    if (!result.ok) {
      clearGitHubToken();
      setPhase('needs-token');
      setStatusLabel('Unable to connect to GitHub.');
      setConnectOpen(true);
      setConnectError(
        result.error.includes('expired') || result.error.includes('Invalid')
          ? 'GitHub access expired. Enter a new token.'
          : result.error,
      );
      return;
    }

    setStatusLabel('GitHub Connected');
    await loadSharedData();
  }, [loadSharedData]);

  useEffect(() => {
    if (bootstrapped.current) {
      return;
    }
    bootstrapped.current = true;
    void bootstrap();
  }, [bootstrap]);

  async function handleConnect(token: string) {
    setConnectBusy(true);
    setConnectError(null);
    setStatusLabel('Connecting...');

    const result = await testGitHubConnection(token);
    if (!result.ok) {
      setConnectBusy(false);
      setConnectError(result.error);
      setStatusLabel('Unable to connect to GitHub.');
      return;
    }

    try {
      setGitHubToken(token);
      setConnectOpen(false);
      setStatusLabel('GitHub Connected');
      await loadSharedData();
    } catch (error) {
      clearGitHubToken();
      setConnectOpen(true);
      setConnectError(
        error instanceof Error ? error.message : 'Unable to connect to GitHub.',
      );
      setStatusLabel('Unable to connect to GitHub.');
      setPhase('needs-token');
    } finally {
      setConnectBusy(false);
    }
  }

  function handleDisconnect() {
    clearGitHubToken();
    setEvents([]);
    setEmployees([]);
    setPhase('needs-token');
    setStatusLabel('Unable to connect to GitHub.');
    setConnectOpen(true);
    setConnectError(null);
    setBannerMessage(null);
    setShowMigration(false);
    setModal({ open: false });
  }

  async function handleRefresh() {
    setRefreshBusy(true);
    setBannerMessage(null);
    await loadSharedData();
    setRefreshBusy(false);
  }

  async function handleRetry() {
    setConnectBusy(false);
    await bootstrap();
  }

  async function handleSaveCatering(event: CateringEvent): Promise<void> {
    const isNew = !events.some((item) => item.id === event.id);
    try {
      const next = isNew
        ? await createCatering(event)
        : await updateCatering(event);
      setEvents(next);
      setBannerMessage('Catering saved.');
    } catch (error) {
      if (error instanceof GitHubApiError && error.code === 'unauthorized') {
        handleAuthFailure('GitHub access expired. Enter a new token.');
      } else if (error instanceof GitHubApiError && error.code === 'forbidden') {
        handleAuthFailure(error.message);
      }
      throw error instanceof Error ? error : new Error('Save failed.');
    }
  }

  async function handleDeleteCatering(eventId: string): Promise<void> {
    const existing = events.find((event) => event.id === eventId);
    const eventName = existing?.eventName ?? 'Unknown';
    try {
      const next = await deleteCatering(eventId, eventName);
      setEvents(next);
      setExpandedIds((current) => {
        const nextSet = new Set(current);
        nextSet.delete(eventId);
        return nextSet;
      });
      setBannerMessage('Catering deleted.');
    } catch (error) {
      if (error instanceof GitHubApiError && error.code === 'unauthorized') {
        handleAuthFailure('GitHub access expired. Enter a new token.');
      } else if (error instanceof GitHubApiError && error.code === 'forbidden') {
        handleAuthFailure(error.message);
      }
      throw error instanceof Error ? error : new Error('Save failed.');
    }
  }

  async function handleTogglePreparationTask(
    eventId: string,
    taskId: string,
  ): Promise<void> {
    const busyKey = `${eventId}:task:${taskId}`;
    if (savingChecklistIds.has(busyKey)) {
      return;
    }

    const currentEvent = events.find((event) => event.id === eventId);
    const task = currentEvent?.preparationTasks.find((item) => item.id === taskId);
    if (!currentEvent || !task) {
      return;
    }

    const nextCompleted = !task.completed;
    const previous = events;
    setSavingChecklistIds((current) => new Set(current).add(busyKey));
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? {
              ...event,
              preparationTasks: event.preparationTasks.map((item) =>
                item.id === taskId ? { ...item, completed: nextCompleted } : item,
              ),
            }
          : event,
      ),
    );

    try {
      const next = await updatePreparationTask(eventId, taskId, nextCompleted);
      setEvents(next);
    } catch (error) {
      setEvents(previous);
      if (error instanceof GitHubApiError && error.code === 'unauthorized') {
        handleAuthFailure('GitHub access expired. Enter a new token.');
      } else {
        setBannerMessage('Save failed.');
      }
    } finally {
      setSavingChecklistIds((current) => {
        const next = new Set(current);
        next.delete(busyKey);
        return next;
      });
    }
  }

  async function handleToggleDocument(
    eventId: string,
    documentId: string,
  ): Promise<void> {
    const busyKey = `${eventId}:doc:${documentId}`;
    if (savingChecklistIds.has(busyKey)) {
      return;
    }

    const currentEvent = events.find((event) => event.id === eventId);
    const document = currentEvent?.documents.find((item) => item.id === documentId);
    if (!currentEvent || !document) {
      return;
    }

    const nextCompleted = !document.completed;
    const previous = events;
    setSavingChecklistIds((current) => new Set(current).add(busyKey));
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? {
              ...event,
              documents: event.documents.map((item) =>
                item.id === documentId
                  ? { ...item, completed: nextCompleted }
                  : item,
              ),
            }
          : event,
      ),
    );

    try {
      const next = await updateDocument(eventId, documentId, nextCompleted);
      setEvents(next);
    } catch (error) {
      setEvents(previous);
      if (error instanceof GitHubApiError && error.code === 'unauthorized') {
        handleAuthFailure('GitHub access expired. Enter a new token.');
      } else {
        setBannerMessage('Save failed.');
      }
    } finally {
      setSavingChecklistIds((current) => {
        const next = new Set(current);
        next.delete(busyKey);
        return next;
      });
    }
  }

  async function handleAddEmployee(name: string): Promise<Employee> {
    try {
      const result = await addEmployeeRemote(name);
      setEmployees(result.employees);
      return result.employee;
    } catch (error) {
      if (error instanceof GitHubApiError && error.code === 'unauthorized') {
        handleAuthFailure('GitHub access expired. Enter a new token.');
      }
      throw error instanceof Error ? error : new Error('Save failed.');
    }
  }

  async function handleUploadLocalData() {
    setMigrationBusy(true);
    setBannerMessage(null);
    try {
      const result = await uploadLocalData();
      setEvents(result.caterings);
      setEmployees(result.employees);
      setBannerMessage('Local data uploaded successfully.');
      setShowMigration(
        hasLocalCateringsSnapshot() || hasLocalEmployeesSnapshot(),
      );
    } catch (error) {
      if (error instanceof GitHubApiError && error.code === 'unauthorized') {
        handleAuthFailure('GitHub access expired. Enter a new token.');
      } else {
        setBannerMessage(
          error instanceof Error ? error.message : 'Save failed.',
        );
      }
    } finally {
      setMigrationBusy(false);
    }
  }

  function handleIgnoreLocalData() {
    setShowMigration(false);
  }

  function handleClearOldLocalData() {
    if (
      !window.confirm(
        'Clear old local catering and employee data from this browser? The GitHub token will be kept.',
      )
    ) {
      return;
    }
    clearLocalCateringsSnapshot();
    clearLocalEmployeesSnapshot();
    setShowMigration(false);
    setBannerMessage('Old local data cleared.');
  }

  function handleToggle(eventId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  const summary = getOperationsSummary(events);
  const groups = groupEventsByDate(events);
  const connected = phase === 'ready';
  const showDashboard = phase === 'ready';
  const showLoading =
    phase === 'checking' || phase === 'loading-data' || phase === 'needs-token';

  return (
    <div className="ops-page">
      <OperationsHeader
        onAddCatering={() =>
          setModal({ open: true, mode: 'create', event: null })
        }
        onRefresh={() => {
          void handleRefresh();
        }}
        onDisconnect={handleDisconnect}
        connected={connected}
        refreshBusy={refreshBusy}
        statusLabel={statusLabel}
      />

      <main className="ops-main">
        <div className="ops-container">
          {bannerMessage ? (
            <div className="ops-banner" role="status">
              <p>{bannerMessage}</p>
              <button
                type="button"
                className="ops-btn ops-btn--ghost"
                onClick={() => setBannerMessage(null)}
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {showMigration && connected ? (
            <section className="ops-migration" aria-label="Local Data Found">
              <h2 className="ops-migration__title">Local Data Found</h2>
              <p className="ops-migration__text">
                This browser contains catering data from the previous local version.
              </p>
              <div className="ops-migration__actions">
                <button
                  type="button"
                  className="ops-btn ops-btn--primary"
                  disabled={migrationBusy}
                  onClick={() => {
                    void handleUploadLocalData();
                  }}
                >
                  {migrationBusy ? 'Uploading...' : 'Upload Local Data'}
                </button>
                <button
                  type="button"
                  className="ops-btn ops-btn--secondary"
                  disabled={migrationBusy}
                  onClick={handleIgnoreLocalData}
                >
                  Ignore
                </button>
                <button
                  type="button"
                  className="ops-btn ops-btn--danger"
                  disabled={migrationBusy}
                  onClick={handleClearOldLocalData}
                >
                  Clear Old Local Data
                </button>
              </div>
            </section>
          ) : null}

          {phase === 'data-error' ? (
            <section className="ops-state-panel">
              <h2 className="ops-state-panel__title">Unable to load shared catering data.</h2>
              {dataError ? <p className="ops-state-panel__text">{dataError}</p> : null}
              <button
                type="button"
                className="ops-btn ops-btn--primary"
                onClick={() => {
                  void handleRetry();
                }}
              >
                Retry
              </button>
            </section>
          ) : null}

          {showLoading && phase !== 'needs-token' ? (
            <section className="ops-state-panel" aria-live="polite">
              <h2 className="ops-state-panel__title">
                {phase === 'loading-data'
                  ? 'Loading shared catering data...'
                  : 'Connecting...'}
              </h2>
            </section>
          ) : null}

          {showDashboard ? (
            <>
              <OperationsSummary counts={summary} />
              {groups.length === 0 ? (
                <EmptyState />
              ) : (
                <CateringEventList
                  groups={groups}
                  expandedIds={expandedIds}
                  savingChecklistIds={savingChecklistIds}
                  onToggle={handleToggle}
                  onEdit={(event) =>
                    setModal({ open: true, mode: 'edit', event })
                  }
                  onTogglePreparationTask={handleTogglePreparationTask}
                  onToggleDocument={handleToggleDocument}
                />
              )}
            </>
          ) : null}
        </div>
      </main>

      <ConnectGitHubModal
        open={connectOpen}
        busy={connectBusy}
        error={connectError}
        onConnect={handleConnect}
      />

      <AddCateringModal
        open={modal.open && connected}
        mode={modal.open ? modal.mode : 'create'}
        event={modal.open ? modal.event : null}
        employees={employees}
        onClose={() => setModal({ open: false })}
        onSave={handleSaveCatering}
        onDelete={handleDeleteCatering}
        onAddEmployee={handleAddEmployee}
      />
    </div>
  );
}
