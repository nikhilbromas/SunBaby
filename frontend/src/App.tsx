import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import TemplateDesigner from './components/TemplateDesigner/Canvas';
import PresetManager from './components/PresetManager/PresetList';
import Preview from './components/Preview/BillPreview';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './styles/App.css';

type View = 'designer' | 'presets' | 'preview';

function AppInner() {
  const { permissions, companyName, email, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>('designer');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  const canPreset = permissions?.AllowPreset ?? false;
  const canTemplate = permissions?.AllowTemplate ?? false;
  const canPreview = permissions?.AllowPreview ?? false;

  // If current view becomes disallowed, move to first allowed
  React.useEffect(() => {
    const allowed: View[] = [];
    if (canTemplate) allowed.push('designer');
    if (canPreset) allowed.push('presets');
    if (canPreview) allowed.push('preview');
    if (allowed.length && !allowed.includes(currentView)) {
      setCurrentView(allowed[0]);
    }
  }, [canTemplate, canPreset, canPreview, currentView]);

  // Close user menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app">
        <header className="app-header">
          <div className="app-topbar">
            <h1>Dynamic Bill Preview System</h1>

            <nav className="app-nav" aria-label="Primary navigation">
              {canPreset && (
                <button
                  className={currentView === 'presets' ? 'active' : ''}
                  onClick={() => setCurrentView('presets')}
                >
                  Presets
                </button>
              )}
              {canTemplate && (
                <button
                  className={currentView === 'designer' ? 'active' : ''}
                  onClick={() => setCurrentView('designer')}
                >
                  Template Designer
                </button>
              )}
              {canPreview && (
                <button
                  className={currentView === 'preview' ? 'active' : ''}
                  onClick={() => setCurrentView('preview')}
                >
                  Preview
                </button>
              )}
            </nav>

            <div className="user-menu-container" ref={userMenuRef}>
              <button
                className="user-icon-btn"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="User menu"
                aria-expanded={isUserMenuOpen}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {isUserMenuOpen && (
                <div className="user-menu-dropdown">
                  {companyName && (
                    <div className="user-menu-item">
                      <span className="user-menu-label">Company:</span>
                      <span className="user-menu-value">{companyName}</span>
                    </div>
                  )}
                  {email && (
                    <div className="user-menu-item">
                      <span className="user-menu-label">User:</span>
                      <span className="user-menu-value">{email}</span>
                    </div>
                  )}
                  <div className="user-menu-divider"></div>
                  <button
                    className="user-menu-logout"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      void logout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="app-main">
          {currentView === 'presets' && canPreset && <PresetManager />}
          {currentView === 'designer' && canTemplate && <TemplateDesigner />}
          {currentView === 'preview' && canPreview && <Preview />}
        </main>
      </div>
    </DndProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <AppInner />
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;

