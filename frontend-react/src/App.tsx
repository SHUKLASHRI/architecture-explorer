import React, { useEffect } from 'react';
import { ExplorerProvider, useExplorer } from './context/ExplorerContext';
import { HeaderBar } from './components/HeaderBar';
import { ProjectSidebar } from './components/ProjectSidebar';
import { HeroCanvas } from './components/HeroCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { SafeRenameModal } from './components/SafeRenameModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ErrorBoundary } from './components/ErrorBoundary';

const PyArchStudioApp: React.FC = () => {
  const {
    error,
    isLoading,
    setLeftPanelOpen,
    setRightPanelOpen,
    minimizeAllPanels,
  } = useExplorer();

  // Global layout keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+B / Cmd+B: Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setLeftPanelOpen((prev) => !prev);
      }
      // Ctrl+J / Cmd+J: Toggle Inspector
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setRightPanelOpen((prev) => !prev);
      }
      // Escape: minimize open floating panels if modals aren't open
      if (e.key === 'Escape') {
        minimizeAllPanels();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setLeftPanelOpen, setRightPanelOpen, minimizeAllPanels]);

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#09090b] text-zinc-200 font-sans text-xs antialiased select-none">
      {/* 1. IMMERSIVE FULL-BLEED CANVAS (Occupies 100% of the screen) */}
      <HeroCanvas />

      {/* 2. FLOATING TOP COMMAND BAR */}
      <HeaderBar />

      {/* 3. FLOATING DYNAMIC LEFT & RIGHT PANELS (Auto-minimize on canvas click, expand on hover) */}
      <ProjectSidebar />
      <InspectorPanel />

      {/* MODALS */}
      <CommandPaletteModal />
      <SafeRenameModal />

      {/* Global Error Banner */}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-rose-950/95 border border-rose-500/50 text-rose-300 px-4 py-2 rounded-xl backdrop-blur-xl shadow-2xl flex items-center gap-2 font-mono">
          <span className="material-symbols-outlined text-rose-400">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading Notification */}
      {isLoading && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 bg-[#121217]/95 border border-white/10 text-zinc-300 px-4 py-2 rounded-full backdrop-blur-xl shadow-2xl flex items-center gap-2 font-mono text-[11px]">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
          <span>Parsing Python AST &amp; Building Graph...</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ExplorerProvider>
        <PyArchStudioApp />
      </ExplorerProvider>
    </ErrorBoundary>
  );
}
