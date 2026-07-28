import { useCallback, useEffect, useRef, useState } from 'react';
import { AppPanelNav } from './components/AppPanelNav';
import { ConnectGitHubModal } from './components/operations/ConnectGitHubModal';
import { OperationsPage } from './components/operations/OperationsPage';
import { TodoPage } from './components/todo/TodoPage';
import { UnlockTodoModal } from './components/todo/UnlockTodoModal';
import {
  ACTIVE_PANEL_STORAGE_KEY,
  TODO_AUTH_STORAGE_KEY,
  readActivePanel,
  writeActivePanel,
  type AppPanel,
} from './lib/activePanel';
import {
  clearTodoAuthStorage,
  importTodoKeysFromStorage,
  persistTodoKeys,
} from './lib/todoAuth';
import {
  clearGitHubToken,
  getGitHubToken,
  GITHUB_TOKEN_STORAGE_KEY,
  setGitHubToken,
  testGitHubConnection,
} from './services/githubDataService';
import {
  loadEncryptedTodoEmployees,
  loadEncryptedTodoTasks,
} from './services/todoDataService';
import {
  decryptJson,
  deriveEmployeesKey,
  deriveTasksKey,
  TodoCryptoError,
} from './services/todoCryptoService';
import type { TodoCryptoKeys } from './types/todo';
import './styles/operations.css';
import './styles/todo.css';

async function verifyTodoKeysCanDecrypt(keys: TodoCryptoKeys): Promise<void> {
  const [employeesFile, tasksFile] = await Promise.all([
    loadEncryptedTodoEmployees(),
    loadEncryptedTodoTasks(),
  ]);

  if (employeesFile.envelope.initialized) {
    await decryptJson(employeesFile.envelope, keys.employeesKey);
  }
  if (tasksFile.envelope.initialized) {
    await decryptJson(tasksFile.envelope, keys.tasksKey);
  }
}

export default function App() {
  const [activePanel, setActivePanel] = useState<AppPanel>('catering');
  const [pendingPanel, setPendingPanel] = useState<AppPanel | null>(null);
  const [isTodoUnlockModalOpen, setIsTodoUnlockModalOpen] = useState(false);
  const [isTodoUnlocked, setIsTodoUnlocked] = useState(false);

  const [githubReady, setGithubReady] = useState(false);
  const [githubChecking, setGithubChecking] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSession, setConnectSession] = useState(0);

  const [todoKeys, setTodoKeys] = useState<TodoCryptoKeys | null>(null);
  const [todoUnlockBusy, setTodoUnlockBusy] = useState(false);
  const [todoAuthHydrated, setTodoAuthHydrated] = useState(false);
  const unlockInFlight = useRef(false);

  const goToCatering = useCallback(() => {
    setActivePanel('catering');
    writeActivePanel('catering');
    setPendingPanel(null);
    setIsTodoUnlockModalOpen(false);
  }, []);

  const goToTodo = useCallback((keys: TodoCryptoKeys) => {
    setTodoKeys(keys);
    setIsTodoUnlocked(true);
    setIsTodoUnlockModalOpen(false);
    setPendingPanel(null);
    setActivePanel('todo');
    writeActivePanel('todo');
  }, []);

  const handlePanelChange = useCallback(
    (next: AppPanel) => {
      if (next === 'catering') {
        goToCatering();
        return;
      }

      if (isTodoUnlocked && todoKeys) {
        setActivePanel('todo');
        writeActivePanel('todo');
        setPendingPanel(null);
        setIsTodoUnlockModalOpen(false);
        return;
      }

      // Password-before-switch: keep Catering visible under the modal.
      setActivePanel('catering');
      setPendingPanel('todo');
      if (connectOpen || githubChecking || !githubReady) {
        setIsTodoUnlockModalOpen(false);
      } else {
        setIsTodoUnlockModalOpen(true);
      }
    },
    [
      goToCatering,
      isTodoUnlocked,
      todoKeys,
      connectOpen,
      githubChecking,
      githubReady,
    ],
  );

  const handleGithubAuthFailure = useCallback((message?: string) => {
    clearGitHubToken();
    setGithubReady(false);
    setConnectOpen(true);
    setIsTodoUnlockModalOpen(false);
    setConnectError(message ?? 'GitHub access expired. Enter a new token.');
  }, []);

  const bootstrapGithub = useCallback(async () => {
    setGithubChecking(true);
    setConnectError(null);
    const token = getGitHubToken();
    if (!token) {
      setGithubReady(false);
      setConnectOpen(true);
      setIsTodoUnlockModalOpen(false);
      setGithubChecking(false);
      return;
    }

    const result = await testGitHubConnection(token);
    if (!result.ok) {
      clearGitHubToken();
      setGithubReady(false);
      setConnectOpen(true);
      setIsTodoUnlockModalOpen(false);
      setConnectError(
        result.error.includes('expired') || result.error.includes('Invalid')
          ? 'GitHub access expired. Enter a new token.'
          : result.error,
      );
      setGithubChecking(false);
      return;
    }

    setGithubReady(true);
    setConnectOpen(false);
    setConnectError(null);
    setConnectSession((value) => value + 1);
    setGithubChecking(false);
  }, []);

  useEffect(() => {
    void bootstrapGithub();
  }, [bootstrapGithub]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const savedPanel = readActivePanel();
      const keys = await importTodoKeysFromStorage();
      if (cancelled) {
        return;
      }

      if (keys && savedPanel === 'todo') {
        setTodoKeys(keys);
        setIsTodoUnlocked(true);
        setActivePanel('todo');
        setPendingPanel(null);
        setIsTodoUnlockModalOpen(false);
      } else if (savedPanel === 'todo') {
        clearTodoAuthStorage();
        setTodoKeys(null);
        setIsTodoUnlocked(false);
        setActivePanel('catering');
        setPendingPanel('todo');
        setIsTodoUnlockModalOpen(false);
      } else {
        setTodoKeys(keys);
        setIsTodoUnlocked(Boolean(keys));
        setActivePanel('catering');
        setPendingPanel(null);
        setIsTodoUnlockModalOpen(false);
      }

      setTodoAuthHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!todoAuthHydrated || githubChecking || connectOpen || !githubReady) {
      return;
    }

    if (pendingPanel === 'todo' && !isTodoUnlocked) {
      setIsTodoUnlockModalOpen(true);
      return;
    }

    if (
      isTodoUnlocked &&
      todoKeys &&
      readActivePanel() === 'todo' &&
      activePanel !== 'todo'
    ) {
      // Keys restored while still showing catering during hydrate — promote after GitHub ready.
      void (async () => {
        try {
          await verifyTodoKeysCanDecrypt(todoKeys);
          if (readActivePanel() === 'todo') {
            setActivePanel('todo');
            setPendingPanel(null);
            setIsTodoUnlockModalOpen(false);
          }
        } catch {
          clearTodoAuthStorage();
          setTodoKeys(null);
          setIsTodoUnlocked(false);
          setActivePanel('catering');
          setPendingPanel('todo');
          setIsTodoUnlockModalOpen(true);
        }
      })();
    }
  }, [
    todoAuthHydrated,
    githubChecking,
    connectOpen,
    githubReady,
    pendingPanel,
    isTodoUnlocked,
    todoKeys,
    activePanel,
  ]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (!event.key) {
        return;
      }

      if (event.key === ACTIVE_PANEL_STORAGE_KEY) {
        const next = event.newValue === 'todo' ? 'todo' : 'catering';
        if (next === 'catering') {
          setActivePanel('catering');
          setPendingPanel(null);
          setIsTodoUnlockModalOpen(false);
          return;
        }
        if (isTodoUnlocked && todoKeys) {
          setActivePanel('todo');
          setPendingPanel(null);
          setIsTodoUnlockModalOpen(false);
        } else {
          setActivePanel('catering');
          setPendingPanel('todo');
          if (!connectOpen && githubReady) {
            setIsTodoUnlockModalOpen(true);
          }
        }
        return;
      }

      if (event.key === TODO_AUTH_STORAGE_KEY) {
        if (!event.newValue) {
          setTodoKeys(null);
          setIsTodoUnlocked(false);
          if (activePanel === 'todo' || pendingPanel === 'todo') {
            setActivePanel('catering');
            setPendingPanel('todo');
            if (!connectOpen && githubReady) {
              setIsTodoUnlockModalOpen(true);
            }
          }
          return;
        }
        void (async () => {
          const keys = await importTodoKeysFromStorage();
          if (keys) {
            setTodoKeys(keys);
            setIsTodoUnlocked(true);
            if (readActivePanel() === 'todo') {
              setActivePanel('todo');
              setPendingPanel(null);
              setIsTodoUnlockModalOpen(false);
            }
          } else {
            clearTodoAuthStorage();
            setTodoKeys(null);
            setIsTodoUnlocked(false);
            setActivePanel('catering');
            setPendingPanel('todo');
            if (!connectOpen && githubReady) {
              setIsTodoUnlockModalOpen(true);
            }
          }
        })();
        return;
      }

      if (event.key === GITHUB_TOKEN_STORAGE_KEY) {
        if (!event.newValue) {
          setGithubReady(false);
          setConnectOpen(true);
          setIsTodoUnlockModalOpen(false);
        } else {
          void bootstrapGithub();
        }
      }
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [
    activePanel,
    pendingPanel,
    isTodoUnlocked,
    todoKeys,
    connectOpen,
    githubReady,
    bootstrapGithub,
  ]);

  async function handleConnect(token: string) {
    setConnectBusy(true);
    setConnectError(null);
    const result = await testGitHubConnection(token);
    if (!result.ok) {
      setConnectBusy(false);
      setConnectError(result.error);
      return;
    }
    try {
      setGitHubToken(token);
      setGithubReady(true);
      setConnectOpen(false);
      setConnectSession((value) => value + 1);
      if (pendingPanel === 'todo' && !isTodoUnlocked) {
        setIsTodoUnlockModalOpen(true);
      }
    } catch (error) {
      clearGitHubToken();
      setGithubReady(false);
      setConnectOpen(true);
      setIsTodoUnlockModalOpen(false);
      setConnectError(
        error instanceof Error ? error.message : 'Unable to connect to GitHub.',
      );
    } finally {
      setConnectBusy(false);
    }
  }

  async function handleTodoUnlock(password: string) {
    if (unlockInFlight.current || todoUnlockBusy) {
      return;
    }
    unlockInFlight.current = true;
    setTodoUnlockBusy(true);
    try {
      const [employeesKey, tasksKey] = await Promise.all([
        deriveEmployeesKey(password),
        deriveTasksKey(password),
      ]);
      const keys = { employeesKey, tasksKey };
      await verifyTodoKeysCanDecrypt(keys);
      await persistTodoKeys(keys);
      goToTodo(keys);
    } catch (error) {
      if (error instanceof TodoCryptoError) {
        clearTodoAuthStorage();
        setTodoKeys(null);
        setIsTodoUnlocked(false);
        throw error;
      }
      throw error;
    } finally {
      unlockInFlight.current = false;
      setTodoUnlockBusy(false);
    }
  }

  function handleBackToCatering() {
    goToCatering();
  }

  function handleLockTodo() {
    clearTodoAuthStorage();
    setTodoKeys(null);
    setIsTodoUnlocked(false);
    setActivePanel('catering');
    setPendingPanel('todo');
    writeActivePanel('todo');
    if (connectOpen || !githubReady) {
      setIsTodoUnlockModalOpen(false);
    } else {
      setIsTodoUnlockModalOpen(true);
    }
  }

  function handleTodoDecryptFailure() {
    clearTodoAuthStorage();
    setTodoKeys(null);
    setIsTodoUnlocked(false);
    setActivePanel('catering');
    setPendingPanel('todo');
    writeActivePanel('todo');
    if (!connectOpen && githubReady) {
      setIsTodoUnlockModalOpen(true);
    }
  }

  const showGithubModal = connectOpen;
  const showTodoModal =
    !showGithubModal &&
    !githubChecking &&
    isTodoUnlockModalOpen &&
    !isTodoUnlocked;

  const showTodoPage =
    activePanel === 'todo' && isTodoUnlocked && Boolean(todoKeys);

  return (
    <div className="app-shell">
      <AppPanelNav activePanel={activePanel} onChange={handlePanelChange} />

      <main className="app-panel-content">
        {showTodoPage ? (
          <TodoPage
            unlocked
            keys={todoKeys}
            onLock={handleLockTodo}
            onDecryptFailure={handleTodoDecryptFailure}
            onAuthFailure={handleGithubAuthFailure}
          />
        ) : (
          <OperationsPage
            managedAuth
            githubReady={githubReady}
            connectSession={connectSession}
            onAuthFailure={handleGithubAuthFailure}
          />
        )}
      </main>

      <ConnectGitHubModal
        open={showGithubModal}
        busy={connectBusy}
        error={connectError}
        onConnect={handleConnect}
      />

      <UnlockTodoModal
        open={showTodoModal}
        busy={todoUnlockBusy}
        onUnlock={handleTodoUnlock}
        onBackToCatering={handleBackToCatering}
      />
    </div>
  );
}
