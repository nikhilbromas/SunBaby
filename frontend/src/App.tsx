import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { MultiBackend, TouchTransition, MouseTransition } from 'react-dnd-multi-backend';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import TemplateDesigner from './components/TemplateDesigner/Canvas';
import PresetManager from './components/PresetManager/PresetList';
import Preview from './components/Preview/BillPreview';
import TemplateConfigList from './components/TemplateConfig/TemplateConfigList';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MobileProvider } from './contexts/MobileContext';
import { Palette, Eye, Settings ,Menu, LogOut } from 'lucide-react';
import './styles/App.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Multi-backend configuration for touch and mouse support
const HTML5toTouch = {
  backends: [
    {
      id: 'html5',
      backend: HTML5Backend,
      transition: MouseTransition,
    },
    {
      id: 'touch',
      backend: TouchBackend,
      options: { enableMouseEvents: true, delayTouchStart: 200 },
      preview: true,
      transition: TouchTransition,
    },
  ],
};

type View = 'designer' | 'presets' | 'preview' | 'templateConfig';

function AppInner() {
  const { permissions, companyName, email, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>('designer');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const mobileNavRef = React.useRef<HTMLDivElement>(null);

  const canPreset = permissions?.AllowPreset ?? false;
  const canTemplate = permissions?.AllowTemplate ?? false;
  const canPreview = permissions?.AllowPreview ?? false;
  const canTemplateConfig = permissions?.AllowTemplateConfig ?? false;

  // If current view becomes disallowed, move to first allowed
  React.useEffect(() => {
    const allowed: View[] = [];
    if (canTemplate) allowed.push('designer');
    if (canPreset) allowed.push('presets');
    if (canPreview) allowed.push('preview');
    if (canTemplateConfig) allowed.push('templateConfig');
    if (allowed.length && !allowed.includes(currentView)) {
      setCurrentView(allowed[0]);
    }
  }, [canTemplate, canPreset, canPreview, canTemplateConfig, currentView]);

  // Close user menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (mobileNavRef.current && !mobileNavRef.current.contains(event.target as Node)) {
        setIsMobileNavOpen(false);
      }
    };

    if (isUserMenuOpen || isMobileNavOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen, isMobileNavOpen]);

  // Close mobile nav on view change
  const handleViewChange = (view: View) => {
    setCurrentView(view);
    setIsMobileNavOpen(false);
  };

  return (
    <DndProvider backend={MultiBackend} options={HTML5toTouch}>
    <MobileProvider>
    <div className="min-h-screen bg-muted/40">
    <header className="sticky top-0 z-50 border-b bg-background">
    <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4">
    <h1 className="text-lg font-semibold tracking-tight">Dynamic Bill Preview System</h1>
    
    
    <div className="flex items-center gap-2">
    <div className="hidden md:flex gap-1">
    {canPreset && (
    <Button variant={currentView === 'presets' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('presets')}>
    Presets
    </Button>
    )}
    {canTemplate && (
    <Button variant={currentView === 'designer' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('designer')}>
    <Palette className="mr-2 h-4 w-4" /> Designer
    </Button>
    )}
    {canPreview && (
    <Button variant={currentView === 'preview' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('preview')}>
    <Eye className="mr-2 h-4 w-4" /> Preview
    </Button>
    )}
    {canTemplateConfig && (
    <Button variant={currentView === 'templateConfig' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('templateConfig')}>
    <Settings className="mr-2 h-4 w-4" /> Config
    </Button>
    )}
    </div>
    
    
    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}>
    <Menu className="h-5 w-5" />
    </Button>
    
    
    <DropdownMenu>
    <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">Account</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56">
    {companyName && <DropdownMenuLabel>{companyName}</DropdownMenuLabel>}
    {email && <DropdownMenuItem disabled>{email}</DropdownMenuItem>}
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => void logout()} className="text-destructive">
    <LogOut className="mr-2 h-4 w-4" /> Logout
    </DropdownMenuItem>
    </DropdownMenuContent>
    </DropdownMenu>
    </div>
    </div>
    
    
    {isMobileNavOpen && (
    <div className="border-t bg-background md:hidden">
    <div className="flex flex-col gap-1 p-2">
    {canPreset && <Button variant="ghost" onClick={() => handleViewChange('presets')}>Presets</Button>}
    {canTemplate && <Button variant="ghost" onClick={() => handleViewChange('designer')}>Template Designer</Button>}
    {canPreview && <Button variant="ghost" onClick={() => handleViewChange('preview')}>Preview</Button>}
    {canTemplateConfig && <Button variant="ghost" onClick={() => handleViewChange('templateConfig')}>Template Config</Button>}
    </div>
    </div>
    )}
    </header>
    
    
    <main className="mx-auto max-w-screen-2xl p-4">
    <Card className="p-4">
    {currentView === 'presets' && canPreset && <PresetManager />}
    {currentView === 'designer' && canTemplate && <TemplateDesigner />}
    {currentView === 'preview' && canPreview && <Preview />}
    {currentView === 'templateConfig' && canTemplateConfig && <TemplateConfigList />}
    </Card>
    </main>
    </div>
    </MobileProvider>
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

