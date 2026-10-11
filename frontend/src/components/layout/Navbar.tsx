import React from 'react';
import type { HealthData, RunStatus } from '../../types';
import { Activity, Cpu, Database, AlertCircle, PlayCircle, BarChart3, FileText, History } from 'lucide-react';

interface NavbarProps {
  health: HealthData | null;
  activeRun: RunStatus | null;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenConfig: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  activeRun,
  currentTab,
  onSelectTab,
  onOpenConfig
}) => {
  const isRunning = activeRun?.status === 'RUNNING' || activeRun?.status === 'QUEUED';

  return (
    <header className="app-header sticky top-0 z-40">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10">
        
        {/* Brand */}
        <div className="brand flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab('overview')}>
          <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-white">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
              MIMII Pump Diagnostics
              <span className="brand-tag rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                ML workspace
              </span>
            </h1>
            <p className="text-xs">Acoustic anomaly detection and explainability</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="app-nav hidden md:flex items-center gap-1 rounded-xl p-1">
          <button
            onClick={() => onSelectTab('overview')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === 'overview'
                ? 'nav-active'
                : 'nav-inactive'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Overview
          </button>

          <button
            onClick={() => onSelectTab('results')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === 'results'
                ? 'nav-active'
                : 'nav-inactive'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Results Dashboard
          </button>

          <button
            onClick={() => onSelectTab('predictions')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === 'predictions'
                ? 'nav-active'
                : 'nav-inactive'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Predictions
          </button>

          <button
            onClick={() => onSelectTab('reports')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === 'reports'
                ? 'nav-active'
                : 'nav-inactive'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Stage 4 Reports
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === 'history'
                ? 'nav-active'
                : 'nav-inactive'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Run History
          </button>
        </nav>

        {/* Status Indicators & Run Action */}
        <div className="flex items-center gap-3">
          {/* Device Badge */}
          <div className="header-chip hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            <span>{health ? health.device.toUpperCase() : 'CPU'}</span>
            {health?.gpu_name && <span className="text-[10px] text-slate-500">({health.gpu_name})</span>}
          </div>

          {/* Backend Status */}
          <div className="header-chip flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs">
            {health?.status === 'ok' ? (
                <span className="flex items-center gap-1.5 status-ready font-medium">
                <span className="h-2 w-2 rounded-full status-dot" />
                Backend Ready
              </span>
            ) : (
                <span className="flex items-center gap-1.5 status-error font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                Connecting...
              </span>
            )}
          </div>

          {/* New Run Button */}
          <button
            onClick={onOpenConfig}
            disabled={isRunning}
            className={`run-button flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-all ${
              isRunning
                ? 'run-button-disabled cursor-not-allowed'
                : 'run-button-ready active:scale-95'
            }`}
          >
            {isRunning ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                Executing Run...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Configure & Run Evaluation
              </>
            )}
          </button>
        </div>

      </div>
    </header>
  );
};
