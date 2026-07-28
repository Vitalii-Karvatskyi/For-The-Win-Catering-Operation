import type { AppPanel } from '../lib/activePanel';

type AppPanelNavProps = {
  activePanel: AppPanel;
  onChange: (panel: AppPanel) => void;
};

export function AppPanelNav({ activePanel, onChange }: AppPanelNavProps) {
  return (
    <nav className="app-panel-nav" aria-label="Application panels">
      <div className="ops-container app-panel-nav__inner">
        <button
          type="button"
          className={`app-panel-nav__tab${
            activePanel === 'catering' ? ' app-panel-nav__tab--active' : ''
          }`}
          aria-current={activePanel === 'catering' ? 'page' : undefined}
          onClick={() => onChange('catering')}
        >
          Catering Operations
        </button>
        <button
          type="button"
          className={`app-panel-nav__tab${
            activePanel === 'todo' ? ' app-panel-nav__tab--active' : ''
          }`}
          aria-current={activePanel === 'todo' ? 'page' : undefined}
          onClick={() => onChange('todo')}
        >
          To Do
        </button>
      </div>
    </nav>
  );
}
