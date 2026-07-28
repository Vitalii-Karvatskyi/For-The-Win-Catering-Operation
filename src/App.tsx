import { useCallback, useEffect, useState } from 'react';
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
  deriveEmployeesKey,
  deriveTasksKey,
} from './services/todoCryptoService';
import type { TodoCryptoKeys } from './types/todo';
import './styles/operations.css';
import './styles/todo.css';

export default function App() {
  const [panel, setPanel] = useState<AppPanel>(() => readActivePanel());
  const [githubReady, setGithubReady] = useState(false);
  const [githubChecking, setGithubChecking] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSession, setConnectSession] = useState(0);

  const [todoKeys, setTodoKeys] = useState<TodoCryptoKeys | null>(null);
  const [todoUnlocked, setTodoUnlocked] = useState(false);
  const [todoUnlockBusy, setTodoUnlockBusy] = useState(false);
  const [todoUnlockOpen, setTodoUnlockOpen] = useState(false);
  const [todoAuthHydrated, setTodoAuthHydrated] = useState(false);

  const lockTodo = useCallback((openModal: boolean) => {
    clearTodoAuthStorage();
    setTodoKeys(null);
    setTodoUnlocked(false);
    setTodoUnlockOpen(openModal);
  }, []);

  const switchPanel = useCallback(
    (next: AppPanel) => {
      setPanel(next);
      writeActivePanel(next);
      if (next === 'todo') {
        if (!todoUnlocked) {
          setTodoUnlockOpen(true);
        }
      } else {
        setTodoUnlockOpen(false);
      }
    },
    [todoUnlocked],
  );

  const handleGithubAuthFailure = useCallback((message?: string) => {
    clearGitHubToken();
    setGithubReady(false);
    setConnectOpen(true);
    setConnectError(message ?? 'GitHub access expired. Enter a new token.');
  }, []);

  const bootstrapGithub = useCallback(async () => {
    setGithubChecking(true);
    setConnectError(null);
    const token = getGitHubToken();
    if (!token) {
      setGithubReady(false);
      setConnectOpen(true);
      setGithubChecking(false);
      return;
    }

    const result = await testGitHubConnection(token);
    if (!result.ok) {
      clearGitHubToken();
      setGithubReady(false);
      setConnectOpen(true);
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
      const keys = await importTodoKeysFromStorage();
      if (cancelled) {
        return;
      }
      if (keys) {
        setTodoKeys(keys);
        setTodoUnlocked(true);
        setTodoUnlockOpen(false);
      } else {
        setTodoKeys(null);
        setTodoUnlocked(false);
        if (readActivePanel() === 'todo') {
          setTodoUnlockOpen(true);
        }
      }
      setTodoAuthHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!todoAuthHydrated || githubChecking) {
      return;
    }
    if (panel === 'todo' && !todoUnlocked && !connectOpen) {
      setTodoUnlockOpen(true);
    }
  }, [todoAuthHydrated, githubChecking, panel, todoUnlocked, connectOpen]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (!event.key) {
        return;
      }

      if (event.key === ACTIVE_PANEL_STORAGE_KEY) {
        const next = event.newValue === 'todo' ? 'todo' : 'catering';
        setPanel(next);
        if (next === 'todo' && !todoUnlocked) {
          setTodoUnlockOpen(true);
        }
        if (next === 'catering') {
          setTodoUnlockOpen(false);
        }
        return;
      }

      if (event.key === TODO_AUTH_STORAGE_KEY) {
        if (!event.newValue) {
          setTodoKeys(null);
          setTodoUnlocked(false);
          if (panel === 'todo' && !connectOpen) {
            setTodoUnlockOpen(true);
          }
          return;
        }
        void (async () => {
          const keys = await importTodoKeysFromStorage();
          if (keys) {
            setTodoKeys(keys);
            setTodoUnlocked(true);
            setTodoUnlockOpen(false);
          } else {
            lockTodo(panel === 'todo' && !connectOpen);
          }
        })();
        return;
      }

      if (event.key === GITHUB_TOKEN_STORAGE_KEY) {
        if (!event.newValue) {
          setGithubReady(false);
          setConnectOpen(true);
        } else {
          void bootstrapGithub();
        }
      }
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [panel, todoUnlocked, connectOpen, lockTodo, bootstrapGithub]);

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
      if (panel === 'todo' && !todoUnlocked) {
        setTodoUnlockOpen(true);
      }
    } catch (error) {
      clearGitHubToken();
      setGithubReady(false);
      setConnectOpen(true);
      setConnectError(
        error instanceof Error ? error.message : 'Unable to connect to GitHub.',
      );
    } finally {
      setConnectBusy(false);
    }
  }

  async function handleTodoUnlock(password: string) {
    setTodoUnlockBusy(true);
    try {
      const [employeesKey, tasksKey] = await Promise.all([
        deriveEmployeesKey(password),
        deriveTasksKey(password),
      ]);
      const keys = { employeesKey, tasksKey };
      await persistTodoKeys(keys);
      setTodoKeys(keys);
      setTodoUnlocked(true);
      setTodoUnlockOpen(false);
      writeActivePanel('todo');
      setPanel('todo');
    } finally {
      setTodoUnlockBusy(false);
    }
  }

  function handleBackToCatering() {
    setTodoUnlockOpen(false);
    switchPanel('catering');
  }

  function handleLockTodo() {
    lockTodo(true);
    writeActivePanel('todo');
    setPanel('todo');
  }

  function handleTodoDecryptFailure() {
    clearTodoAuthStorage();
    setTodoKeys(null);
    setTodoUnlocked(false);
    if (!connectOpen) {
      setTodoUnlockOpen(true);
    }
  }

  const showGithubModal = connectOpen;
  const showTodoModal =
    !showGithubModal &&
    !githubChecking &&
    panel === 'todo' &&
    todoUnlockOpen &&
    !todoUnlocked;

  return (
    <div className="app-shell">
      <AppPanelNav activePanel={panel} onChange={switchPanel} />

      {panel === 'catering' ? (
        <OperationsPage
          managedAuth
          githubReady={githubReady}
          connectSession={connectSession}
          onAuthFailure={handleGithubAuthFailure}
        />
      ) : (
        <TodoPage
          unlocked={todoUnlocked && githubReady}
          keys={todoUnlocked ? todoKeys : null}
          onLock={handleLockTodo}
          onDecryptFailure={handleTodoDecryptFailure}
          onAuthFailure={handleGithubAuthFailure}
        />
      )}

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
