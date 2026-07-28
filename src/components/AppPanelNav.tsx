import type { AppPanel } from '../lib/activePanel';
import { ftwAssets } from '../config/ftwAssets';

type AppPanelNavProps = {
  activePanel: AppPanel;
  onChange: (panel: AppPanel) => void;
};

export function AppPanelNav({ activePanel, onChange }: AppPanelNavProps) {
  function handleHomeClick() {
    const targetId =
      activePanel === 'todo' ? 'todo-panel-top' : 'catering-panel-top';
    const target = document.getElementById(targetId);

    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  return (
    <nav className="app-panel-nav" aria-label="Application panels">
      <div className="app-panel-nav__inner">
        <button
          type="button"
          className="app-panel-nav__home"
          aria-label="Go to top of current panel"
          onClick={handleHomeClick}
        >
          <img
            src={ftwAssets.logo}
            alt="For The Win"
            className="app-panel-nav__logo"
            width={345}
            height={117}
          />
        </button>

        <div className="app-panel-nav__tabs">
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
      </div>
    </nav>
  );
}
