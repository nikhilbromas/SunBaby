import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import TemplateDesigner from './components/TemplateDesigner/Canvas';
import PresetManager from './components/PresetManager/PresetList';
import Preview from './components/Preview/BillPreview';
import './styles/App.css';

type View = 'designer' | 'presets' | 'preview';

function App() {
  const [currentView, setCurrentView] = useState<View>('designer');

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app">
        <header className="app-header">
          <h1>Dynamic Bill Preview System</h1>
          <nav className="app-nav">
            <button
              className={currentView === 'presets' ? 'active' : ''}
              onClick={() => setCurrentView('presets')}
            >
              Presets
            </button>
            <button
              className={currentView === 'designer' ? 'active' : ''}
              onClick={() => setCurrentView('designer')}
            >
              Template Designer
            </button>
            <button
              className={currentView === 'preview' ? 'active' : ''}
              onClick={() => setCurrentView('preview')}
            >
              Preview
            </button>
          </nav>
        </header>
        <main className="app-main">
          {currentView === 'presets' && <PresetManager />}
          {currentView === 'designer' && <TemplateDesigner />}
          {currentView === 'preview' && <Preview />}
        </main>
      </div>
    </DndProvider>
  );
}

export default App;

