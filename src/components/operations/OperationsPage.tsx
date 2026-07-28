import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  expandCateringEvents,
  isRecurringOccurrence,
  resolveSeriesTemplate,
} from '../../lib/cateringRecurrence';
import {
  addEmployee as addEmployeeRemote,
  clearGitHubToken,
  createCatering,
  deleteCatering,
  getGitHubToken,
  GitHubApiError,
  loadCaterings,
  loadEmployees,
  setGitHubToken,
  testGitHubConnection,
  updateCatering,
  updateDocument,
  updatePreparationTask,
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

export type OperationsPageProps = {
  /** When true, GitHub Connect modal is owned by the parent shell. */
  managedAuth?: boolean;
  githubReady?: boolean;
  connectSession?: number;
  onAuthFailure?: (message?: string) => void;
};

export function OperationsPage({
  managedAuth = false,
  githubReady = false,
  connectSession = 0,
  onAuthFailure,
}: OperationsPageProps) {
  const [phase, setPhase] = useState<ConnectionPhase>('checking');
  const [statusLabel, setStatusLabel] = useState('Connecting...');
  const [storedEvents, setStoredEvents] = useState<CateringEvent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [seriesPromptEvent, setSeriesPromptEvent] = useState<CateringEvent | null>(
    null,
  );
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [savingChecklistIds, setSavingChecklistIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const bootstrapped = useRef(false);

  const displayEvents = useMemo(
    () => expandCateringEvents(storedEvents),
    [storedEvents],
  );

  const handleAuthFailure = useCallback((message?: string) => {
    clearGitHubToken();
    setStoredEvents([]);
    setEmployees([]);
    setPhase('needs-token');
    setStatusLabel('Unable to connect to GitHub.');
    setBannerMessage(null);
    setSeriesPromptEvent(null);
    setModal({ open: false });
    if (managedAuth) {
      onAuthFailure?.(message ?? 'GitHub access expired. Enter a new token.');
    } else {
      setConnectOpen(true);
      setConnectError(message ?? 'GitHub access expired. Enter a new token.');
    }
  }, [managedAuth, onAuthFailure]);

  const loadSharedData = useCallback(async () => {
    setPhase('loading-data');
    setStatusLabel('Loading shared data...');
    setDataError(null);

    try {
      const [nextEvents, nextEmployees] = await Promise.all([
        loadCaterings(),
        loadEmployees(),
      ]);
      setStoredEvents(nextEvents);
      setEmployees(nextEmployees);
      setPhase('ready');
      setStatusLabel('GitHub Connected');
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

    if (managedAuth) {
      if (!githubReady) {
        setPhase('needs-token');
        setStatusLabel('Unable to connect to GitHub.');
        return;
      }
      setStatusLabel('GitHub Connected');
      await loadSharedData();
      return;
    }

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
  }, [loadSharedData, managedAuth, githubReady]);

  useEffect(() => {
    if (managedAuth) {
      return;
    }
    if (bootstrapped.current) {
      return;
    }
    bootstrapped.current = true;
    void bootstrap();
  }, [bootstrap, managedAuth]);

  useEffect(() => {
    if (!managedAuth) {
      return;
    }
    if (!githubReady) {
      setPhase('needs-token');
      setStatusLabel('Unable to connect to GitHub.');
      setStoredEvents([]);
      setEmployees([]);
      setConnectOpen(false);
      return;
    }
    void loadSharedData();
  }, [managedAuth, githubReady, connectSession, loadSharedData]);

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
    setStoredEvents([]);
    setEmployees([]);
    setPhase('needs-token');
    setStatusLabel('Unable to connect to GitHub.');
    setConnectError(null);
    setBannerMessage(null);
    setSeriesPromptEvent(null);
    setModal({ open: false });
    if (managedAuth) {
      onAuthFailure?.();
    } else {
      setConnectOpen(true);
    }
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

  function handleRequestEdit(event: CateringEvent) {
    if (isRecurringOccurrence(event) || event.isRecurringTemplate) {
      setSeriesPromptEvent(event);
      return;
    }
    setModal({ open: true, mode: 'edit', event });
  }

  function handleEditEntireSeries() {
    if (!seriesPromptEvent) {
      return;
    }
    const template = resolveSeriesTemplate(storedEvents, seriesPromptEvent);
    setSeriesPromptEvent(null);
    if (!template) {
      setBannerMessage('Unable to open the recurring series template.');
      return;
    }
    setModal({ open: true, mode: 'edit', event: template });
  }

  async function handleSaveCatering(event: CateringEvent): Promise<void> {
    const isNew = !storedEvents.some((item) => item.id === event.id);
    try {
      const next = isNew
        ? await createCatering(event)
        : await updateCatering(event);
      setStoredEvents(next);
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
    const existing = storedEvents.find((event) => event.id === eventId);
    const eventName = existing?.eventName ?? 'Unknown';
    try {
      const next = await deleteCatering(eventId, eventName);
      setStoredEvents(next);
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

    const currentEvent = displayEvents.find((event) => event.id === eventId);
    const task = currentEvent?.preparationTasks.find((item) => item.id === taskId);
    if (!currentEvent || !task) {
      return;
    }

    // Recurring occurrences are virtual — do not persist per-date checklist state.
    if (isRecurringOccurrence(currentEvent)) {
      return;
    }

    const nextCompleted = !task.completed;
    const previous = storedEvents;
    setSavingChecklistIds((current) => new Set(current).add(busyKey));
    setStoredEvents((current) =>
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
      setStoredEvents(next);
    } catch (error) {
      setStoredEvents(previous);
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

    const currentEvent = displayEvents.find((event) => event.id === eventId);
    const document = currentEvent?.documents.find((item) => item.id === documentId);
    if (!currentEvent || !document) {
      return;
    }

    if (isRecurringOccurrence(currentEvent)) {
      return;
    }

    const nextCompleted = !document.completed;
    const previous = storedEvents;
    setSavingChecklistIds((current) => new Set(current).add(busyKey));
    setStoredEvents((current) =>
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
      setStoredEvents(next);
    } catch (error) {
      setStoredEvents(previous);
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

  const summary = getOperationsSummary(displayEvents);
  const groups = groupEventsByDate(displayEvents);
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
                  onEdit={handleRequestEdit}
                  onTogglePreparationTask={handleTogglePreparationTask}
                  onToggleDocument={handleToggleDocument}
                />
              )}
            </>
          ) : null}
        </div>
      </main>

      {seriesPromptEvent
        ? createPortal(
            <div
              className="ops-modal ops-modal--blocking catering-form-modal"
              role="presentation"
            >
              <div className="ops-modal__backdrop" aria-hidden="true" />
              <div
                className="ops-modal__dialog ops-modal__dialog--connect"
                role="dialog"
                aria-modal="true"
                aria-labelledby="recurring-series-title"
              >
                <div className="ops-modal__header">
                  <h2 id="recurring-series-title" className="ops-modal__title">
                    Recurring Event
                  </h2>
                </div>
                <div className="ops-modal__body">
                  <p className="ops-connect__description">
                    This is a recurring weekly event. Changes will apply to all
                    future Altadena Pop-Up events.
                  </p>
                </div>
                <div className="ops-modal__footer">
                  <button
                    type="button"
                    className="ops-btn ops-btn--ghost"
                    onClick={() => setSeriesPromptEvent(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ops-btn ops-btn--primary"
                    onClick={handleEditEntireSeries}
                  >
                    Edit Entire Series
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {!managedAuth ? (
        <ConnectGitHubModal
          open={connectOpen}
          busy={connectBusy}
          error={connectError}
          onConnect={handleConnect}
        />
      ) : null}

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
