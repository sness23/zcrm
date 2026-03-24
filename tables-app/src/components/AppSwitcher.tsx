import { useState, useRef, useEffect } from 'react';
import { APP_CONFIGS } from '../types';
import './AppSwitcher.css';

interface AppSwitcherProps {
  currentAppId: string;
  onAppChange: (appId: string) => void;
}

export default function AppSwitcher({ currentAppId, onAppChange }: AppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentApp = APP_CONFIGS.find((app) => app.id === currentAppId)!;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAppSelect = (appId: string) => {
    onAppChange(appId);
    setIsOpen(false);
  };

  return (
    <div className="app-switcher" ref={dropdownRef}>
      <button
        className="app-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="app-icon">{currentApp.icon}</span>
        <span className="app-name">{currentApp.name}</span>
        <span className="app-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="app-switcher-dropdown">
          <div className="app-switcher-header">Apps</div>
          <div className="app-switcher-list">
            {APP_CONFIGS.map((app) => (
              <button
                key={app.id}
                className={`app-switcher-item ${app.id === currentAppId ? 'active' : ''}`}
                onClick={() => handleAppSelect(app.id)}
              >
                <span className="app-icon">{app.icon}</span>
                <span className="app-name">{app.name}</span>
                {app.id === currentAppId && <span className="app-checkmark">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
