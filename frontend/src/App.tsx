import { useState, useEffect } from 'react';
import type { HealthData, CapabilitiesData, RunConfig, ValidateResponse, RunStatus } from './types';
import { fetchHealth, fetchCapabilities, createRun, fetchRuns } from './services/api';

import { Navbar } from './components/layout/Navbar';
import { ProjectOverview } from './components/overview/ProjectOverview';
import { RunConfigForm } from './components/config/RunConfigForm';
import { ConfirmationModal } from './components/config/ConfirmationModal';
import { LiveExecutionMonitor } from './components/monitor/LiveExecutionMonitor';
import { ResultsDashboard } from './components/results/ResultsDashboard';
import { PredictionsExplorer } from './components/predictions/PredictionsExplorer';
import { DiagnosticReportsPage } from './components/reports/DiagnosticReportsPage';
import { RunHistoryPage } from './components/history/RunHistoryPage';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilitiesData | null>(null);
  const [latestRun, setLatestRun] = useState<RunStatus | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [predictionsFilter, setPredictionsFilter] = useState<any>(null);

  // Modal states
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [proposedConfig, setProposedConfig] = useState<RunConfig | null>(null);
  const [validationData, setValidationData] = useState<ValidateResponse | null>(null);

  // Monitor state
  const [activeJobRunId, setActiveJobRunId] = useState<string | null>(null);

  useEffect(() => {
    loadHealthAndHistory();
    const interval = setInterval(loadHealthAndHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadHealthAndHistory = async () => {
    try {
      const [h, cap, runs] = await Promise.all([
        fetchHealth(),
        fetchCapabilities(),
        fetchRuns()
      ]);
      setHealth(h);
      setCapabilities(cap);
      if (runs.length > 0) {
        setLatestRun(runs[0]);
        if (!selectedRunId) {
          setSelectedRunId(runs[0].run_id);
        }
      }
    } catch (err) {
      console.error('Failed to load system health', err);
    }
  };

  // Step 1 of run creation: Validation success -> open confirmation modal
  const handleValidateSuccess = (config: RunConfig, validation: ValidateResponse) => {
    setProposedConfig(config);
    setValidationData(validation);
    setShowConfigForm(false);
    setShowConfirmation(true);
  };

  // Step 2 of run creation: User explicitly clicks "Confirm and Run"
  const handleConfirmRun = async () => {
    if (!proposedConfig) return;
    try {
      const newRun = await createRun(proposedConfig);
      setShowConfirmation(false);
      setActiveJobRunId(newRun.run_id);
      setSelectedRunId(newRun.run_id);
    } catch (err: any) {
      alert(err.message || 'Failed to start run');
      setShowConfirmation(false);
    }
  };

  const handleRunFinished = () => {
    loadHealthAndHistory();
  };

  const handleOpenResultsFromMonitor = () => {
    setActiveJobRunId(null);
    setCurrentTab('results');
  };

  const handleNavigateToPredictions = (filterObj?: any) => {
    setPredictionsFilter(filterObj || null);
    setCurrentTab('predictions');
  };

  return (
    <div className="app-shell min-h-screen flex flex-col">
      
      {/* Top Navbar */}
      <Navbar
        health={health}
        activeRun={latestRun?.status === 'RUNNING' ? latestRun : null}
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setActiveJobRunId(null);
          setCurrentTab(tab);
        }}
        onOpenConfig={() => setShowConfigForm(true)}
      />

      {/* Main Body */}
      <main className="app-main flex-1 mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
        
        {/* If background run is actively executing */}
        {activeJobRunId ? (
          <LiveExecutionMonitor
            runId={activeJobRunId}
            onRunFinished={handleRunFinished}
            onOpenResults={handleOpenResultsFromMonitor}
          />
        ) : (
          <>
            {currentTab === 'overview' && (
              <ProjectOverview
                health={health}
                latestRun={latestRun}
                onOpenConfig={() => setShowConfigForm(true)}
                onNavigate={setCurrentTab}
              />
            )}

            {currentTab === 'results' && selectedRunId && (
              <ResultsDashboard
                runId={selectedRunId}
                onNavigateToPredictions={handleNavigateToPredictions}
              />
            )}

            {currentTab === 'predictions' && selectedRunId && (
              <PredictionsExplorer
                runId={selectedRunId}
                initialFilter={predictionsFilter}
              />
            )}

            {currentTab === 'reports' && selectedRunId && (
              <DiagnosticReportsPage runId={selectedRunId} />
            )}

            {currentTab === 'history' && (
              <RunHistoryPage
                onSelectRun={(rid) => {
                  setSelectedRunId(rid);
                  setCurrentTab('results');
                }}
              />
            )}
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="app-footer border-t py-5 text-center text-xs">
        <div className="mx-auto max-w-7xl px-4 flex flex-wrap items-center justify-between gap-2">
          <span>End-to-End MIMII Pump Anomaly Detection & Diagnostic Suite</span>
          <span className="font-mono">SpecOnlyModel CRNN • PyTorch • RAG • Groq LLM</span>
        </div>
      </footer>

      {/* Modal 1: Configuration Form */}
      {showConfigForm && (
        <RunConfigForm
          capabilities={capabilities}
          onValidateSuccess={handleValidateSuccess}
          onClose={() => setShowConfigForm(false)}
        />
      )}

      {/* Modal 2: Explicit Confirmation Modal */}
      {showConfirmation && proposedConfig && validationData && (
        <ConfirmationModal
          config={proposedConfig}
          validation={validationData}
          onConfirm={handleConfirmRun}
          onCancel={() => setShowConfirmation(false)}
        />
      )}

    </div>
  );
}

export default App;
