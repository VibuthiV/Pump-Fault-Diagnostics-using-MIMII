import React from 'react';
import type { HealthData, RunStatus } from '../../types';
import {
  Activity, CheckCircle2, AlertTriangle, Cpu, HardDrive,
  FileCheck, PlayCircle, BarChart3, ShieldCheck, Info, Sparkles
} from 'lucide-react';

interface ProjectOverviewProps {
  health: HealthData | null;
  latestRun: RunStatus | null;
  onOpenConfig: () => void;
  onNavigate: (tab: string) => void;
}

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({
  health,
  latestRun,
  onOpenConfig,
  onNavigate
}) => {
  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="overview-hero glass-card relative overflow-hidden p-7 sm:p-10">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
            <Sparkles className="h-3.5 w-3.5" />
            CRNN Acoustic Anomaly Detection & RAG Diagnostic Pipeline
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Pump anomaly intelligence, clearly presented
          </h2>
          
          <p className="text-sm text-slate-300 leading-relaxed">
            Operates the validated <span className="font-semibold text-blue-400">SpecOnlyModel</span> (CRNN: 4-layer CNN + Bidirectional GRU, 308K parameters) on precomputed log-Mel spectrograms. Integrates test set evaluation across multiple machine units and noise conditions with TF-IDF RAG retrieval and Groq LLM diagnostic reports.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenConfig}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-cyan-400 active:scale-95 transition-all"
            >
              <PlayCircle className="h-4 w-4" />
              Configure & Run Evaluation
            </button>

            {latestRun && (
              <button
                onClick={() => onNavigate('results')}
                className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 border border-slate-700 transition-all"
              >
                <BarChart3 className="h-4 w-4 text-blue-400" />
                View Latest Run Results ({latestRun.run_id})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Status Grid */}
      <div className="status-grid grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Card 1: Backend Health */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Backend Status</span>
            <Activity className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex items-center gap-2">
            {health?.status === 'ok' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="text-lg font-bold text-white">Online</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <span className="text-lg font-bold text-slate-400">Connecting...</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">FastAPI Engine v1.0.0</p>
        </div>

        {/* Card 2: Compute Device */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Compute Hardware</span>
            <Cpu className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white uppercase">{health?.device || 'CPU'}</span>
          </div>
          <p className="text-xs text-slate-400 truncate">
            {health?.gpu_name || 'CPU Execution Mode'}
          </p>
        </div>

        {/* Card 3: Manifest & Dataset */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Dataset Status</span>
            <HardDrive className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            {health?.dataset_root_exists ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="text-lg font-bold text-white">12,615 Samples</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <span className="text-lg font-bold text-amber-300">Missing Manifest</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">manifest.csv loaded</p>
        </div>

        {/* Card 4: Model Checkpoint */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Model Checkpoint</span>
            <FileCheck className="h-4 w-4 text-purple-400" />
          </div>
          <div className="flex items-center gap-2">
            {health?.checkpoint_exists ? (
              <>
                <ShieldCheck className="h-5 w-5 text-purple-400" />
                <span className="text-lg font-bold text-white">spec_only Available</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <span className="text-lg font-bold text-amber-300">Not Found</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">CRNN SpecOnly Architecture</p>
        </div>

      </div>

      {/* Latest Run Quick Summary / Empty State */}
      <div className="latest-summary glass-card p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center justify-between">
          <span>Latest Evaluation Summary</span>
          {latestRun && (
            <span className="text-xs font-mono font-normal text-slate-400">
              Run ID: {latestRun.run_id} ({latestRun.created_at})
            </span>
          )}
        </h3>

        {latestRun?.metrics ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
            <div className="rounded-lg bg-slate-900/90 p-3 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">ROC-AUC</span>
              <span className="text-xl font-bold text-blue-400">
                {latestRun.metrics.auc !== null ? latestRun.metrics.auc.toFixed(4) : 'N/A'}
              </span>
            </div>

            <div className="rounded-lg bg-slate-900/90 p-3 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Accuracy</span>
              <span className="text-xl font-bold text-emerald-400">
                {(latestRun.metrics.accuracy * 100).toFixed(2)}%
              </span>
            </div>

            <div className="rounded-lg bg-slate-900/90 p-3 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Precision</span>
              <span className="text-xl font-bold text-cyan-400">
                {latestRun.metrics.precision.toFixed(4)}
              </span>
            </div>

            <div className="rounded-lg bg-slate-900/90 p-3 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Recall</span>
              <span className="text-xl font-bold text-purple-400">
                {latestRun.metrics.recall.toFixed(4)}
              </span>
            </div>

            <div className="rounded-lg bg-slate-900/90 p-3 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">F1 Score</span>
              <span className="text-xl font-bold text-amber-400">
                {latestRun.metrics.f1_score.toFixed(4)}
              </span>
            </div>

            <div className="rounded-lg bg-slate-900/90 p-3 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Samples</span>
              <span className="text-xl font-bold text-slate-200">
                {latestRun.metrics.n_samples}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-900/50 p-6 border border-slate-800 text-center space-y-3">
            <Info className="h-8 w-8 text-blue-400 mx-auto" />
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="text-sm font-semibold text-white">No Evaluation Runs Completed Yet</h4>
              <p className="text-xs text-slate-400">
                Click "Configure & Run Evaluation" to select a test split, configure parameters, and launch model evaluation.
              </p>
            </div>
            <button
              onClick={onOpenConfig}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition-all shadow-md"
            >
              <PlayCircle className="h-4 w-4" />
              Configure First Run
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
