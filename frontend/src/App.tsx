import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { MultiBackend, TouchTransition, MouseTransition } from 'react-dnd-multi-backend';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import TemplateDesigner from './components/TemplateDesigner/Canvas';
import PresetManager from './components/PresetManager/PresetList';
import Preview from './components/Preview/BillPreview';
import TemplateConfigList from './components/TemplateConfig/TemplateConfigList';
import AnalyticsPage from './components/Analytics/AnalyticsPage';
import DashboardsPage from './components/Dashboards/DashboardsPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MobileProvider } from './contexts/MobileContext';
import { Palette, Eye, Settings, Menu, LogOut, ClipboardList, User, BarChart3, LayoutDashboard } from 'lucide-react';
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

type View = 'designer' | 'presets' | 'preview' | 'templateConfig' | 'analytics' | 'dashboards';

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
  const canAnalytics = permissions?.AllowAnalytics ?? true; // default on until auth DB adds explicit flag
  const canDashboards = permissions?.AllowDashboard ?? true; // default on until auth DB adds explicit flag

  // If current view becomes disallowed, move to first allowed
  React.useEffect(() => {
    const allowed: View[] = [];
    if (canTemplate) allowed.push('designer');
    if (canPreset) allowed.push('presets');
    if (canPreview) allowed.push('preview');
    if (canTemplateConfig) allowed.push('templateConfig');
    if (canAnalytics) allowed.push('analytics');
    if (canDashboards) allowed.push('dashboards');
    if (allowed.length && !allowed.includes(currentView)) {
      setCurrentView(allowed[0]);
    }
  }, [canTemplate, canPreset, canPreview, canTemplateConfig, canAnalytics, canDashboards, currentView]);

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
    <div className="min-h-screen bg-black">
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-black">
  <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4">

    <h1 className="text-lg font-semibold tracking-tight text-white">
      Dynamic Bill Preview System
    </h1>

    <div className="flex items-center gap-2">

      {/* Desktop Nav */}
      <div className="hidden md:flex gap-1">
        {canPreset && (
          <Button
            variant={currentView === 'presets' ? 'outline' : 'ghost'}
            size="sm"
            className={
              currentView === 'presets'
              ? 'bg-white text-black border border-white transition-colors duration-200 ease-out'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors duration-200 ease-out'
          }
            onClick={() => handleViewChange('presets')}
          >
            <ClipboardList className="mr-2 h-4 w-4" /> SQL Presets
            
          </Button>
        )}

        {canTemplate && (
          <Button
            variant={currentView === 'designer' ? 'outline' : 'ghost'}
            size="sm"
            className={
              currentView === 'designer'
              ? 'bg-white text-black border border-white transition-colors duration-200 ease-out'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors duration-200 ease-out'
          }
            onClick={() => handleViewChange('designer')}
          >
            <Palette className="mr-2 h-4 w-4" /> Designer
          </Button>
        )}

        {canPreview && (
          <Button
            variant={currentView === 'preview' ? 'outline' : 'ghost'}
            size="sm"
            className={
              currentView === 'preview'
              ? 'bg-white text-black border border-white transition-colors duration-200 ease-out'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors duration-200 ease-out'
          }
            onClick={() => handleViewChange('preview')}
          >
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
        )}

        {canTemplateConfig && (
          <Button
            variant={currentView === 'templateConfig' ? 'outline' : 'ghost'}
            size="sm"
            className={
              currentView === 'templateConfig'
              ? 'bg-white text-black border border-white transition-colors duration-200 ease-out'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors duration-200 ease-out'
          }
            onClick={() => handleViewChange('templateConfig')}
          >
            <Settings className="mr-2 h-4 w-4" /> Config
          </Button>
        )}

        {canAnalytics && (
          <Button
            variant={currentView === 'analytics' ? 'outline' : 'ghost'}
            size="sm"
            className={
              currentView === 'analytics'
              ? 'bg-white text-black border border-white transition-colors duration-200 ease-out'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors duration-200 ease-out'
          }
            onClick={() => handleViewChange('analytics')}
          >
            <BarChart3 className="mr-2 h-4 w-4" /> Analytics
          </Button>
        )}

        {canDashboards && (
          <Button
            variant={currentView === 'dashboards' ? 'outline' : 'ghost'}
            size="sm"
            className={
              currentView === 'dashboards'
              ? 'bg-white text-black border border-white transition-colors duration-200 ease-out'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors duration-200 ease-out'
          }
            onClick={() => handleViewChange('dashboards')}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboards
          </Button>
        )}
      </div>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-white"
        onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Account Menu */}
      <DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="outline"
      size="sm"
      className="
        bg-black text-white border-white
        transition-colors duration-200 ease-out

        hover:bg-white hover:text-black

        data-[state=open]:bg-white
        data-[state=open]:text-black

        focus-visible:ring-2
        focus-visible:ring-white
      "
    >
      <User className="mr-2 h-4 w-4" />
      Account
    </Button>
  </DropdownMenuTrigger>



  <DropdownMenuContent
    align="end"
    className="
      w-56
      bg-black
      border border-neutral-800
      text-white
      shadow-xl
    "
  >

          {companyName && (
            <DropdownMenuLabel className="text-white">
              {companyName}
            </DropdownMenuLabel>
          )}
          {email && (
            <DropdownMenuItem disabled className="text-neutral-400">
              {email}
            </DropdownMenuItem>
          )}

<DropdownMenuSeparator className="bg-neutral-800" />

<DropdownMenuItem
  onClick={() => void logout()}
  className="
    text-white
    transition-colors duration-200 ease-out
    hover:bg-white hover:text-black
    focus:bg-white focus:text-black
  "
>
  <LogOut className="mr-2 h-4 w-4" />
  Logout
</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>

  {/* Mobile Nav */}
  {isMobileNavOpen && (
    <div className="border-t border-neutral-800 bg-black md:hidden">
      <div className="flex flex-col gap-1 p-2">
        {canPreset && (
          <Button variant="ghost" className="text-white" onClick={() => handleViewChange('presets')}>
            Presets
          </Button>
        )}
        {canTemplate && (
          <Button variant="ghost" className="text-white" onClick={() => handleViewChange('designer')}>
            Template Designer
          </Button>
        )}
        {canPreview && (
          <Button variant="ghost" className="text-white" onClick={() => handleViewChange('preview')}>
            Preview
          </Button>
        )}
        {canTemplateConfig && (
          <Button variant="ghost" className="text-white" onClick={() => handleViewChange('templateConfig')}>
            Template Config
          </Button>
        )}
        {canAnalytics && (
          <Button variant="ghost" className="text-white" onClick={() => handleViewChange('analytics')}>
            Analytics
          </Button>
        )}
        {canDashboards && (
          <Button variant="ghost" className="text-white" onClick={() => handleViewChange('dashboards')}>
            Dashboards
          </Button>
        )}
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
    {currentView === 'analytics' && canAnalytics && <AnalyticsPage />}
    {currentView === 'dashboards' && canDashboards && <DashboardsPage />}
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

