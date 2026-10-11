import React, { useEffect, useState, useRef } from 'react';
import type { ProgressEvent } from '../../types';
import { cancelRun } from '../../services/api';
import {
  CheckCircle2, AlertCircle, Terminal,
  StopCircle, ArrowRight, Loader2
} from 'lucide-react';

interface LiveExecutionMonitorProps {
  runId: string;
  onRunFinished: (runId: string) => void;
  onOpenResults: () => void;
}

const STAGES = [
  'Stage 1: Dataset Loading',
  'Stage 2: Model Setup / Training',
  'Stage 3: Evaluation',
  'Stage 4: Metric Computation',
  'Stage 5: Representative Cases',
  'Stage 6: Diagnostic Reports',
  'Stage 7: Finalizing'
];

export const LiveExecutionMonitor: React.FC<LiveExecutionMonitorProps> = ({
  runId,
  onRunFinished,
  onOpenResults
}) => {
  const [currentEvent, setCurrentEvent] = useState<ProgressEvent | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/v1/runs/${runId}/events`);

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      try {
        const data: ProgressEvent = JSON.parse(e.data);
        setCurrentEvent(data);
        if (data.message) {
          const timeStr = data.timestamp || new Date().toLocaleTimeString();
          setLogs((prev) => [...prev, `[${timeStr}] ${data.message}`]);
        }

        if (data.stage === 'COMPLETED') {
          setIsFinished(true);
          onRunFinished(runId);
          eventSource.close();
        } else if (data.stage === 'FAILED') {
          setIsFailed(true);
          setErrorMessage(data.error || 'Pipeline execution encountered an error.');
          eventSource.close();
        } else if (data.stage === 'CANCELLED') {
          setIsFailed(true);
          setErrorMessage('Run was cancelled by user.');
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE event', err);
      }
    });

    eventSource.addEventListener('status', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status === 'COMPLETED') {
          setIsFinished(true);
          onRunFinished(runId);
          eventSource.close();
        } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
          setIsFailed(true);
          setErrorMessage(data.error || `Run status: ${data.status}`);
          eventSource.close();
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [runId]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelRun(runId);
      setLogs((prev) => [...prev, `[System] Cancellation request sent to backend...`]);
    } catch (err: any) {
      console.error(err);
    }
  };

  const progressPercent = Math.min(100, Math.max(0, (currentEvent?.progress || 0) * 100));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header card */}
      <div className="monitor-card glass-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Live Execution Monitor
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {runId}
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Tracking pipeline stages, training loop progress, and real-time backend execution logs
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {!isFinished && !isFailed && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 px-4 py-2 text-xs font-semibold transition-all"
              >
                <StopCircle className="h-4 w-4" />
                {cancelling ? 'Cancelling...' : 'Cancel Run'}
              </button>
            )}

            {isFinished && (
              <button
                onClick={onOpenResults}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <span>View Full Results Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-2">
              {isFinished ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : isFailed ? (
                <AlertCircle className="h-4 w-4 text-rose-400" />
              ) : (
                <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
              )}
              {currentEvent?.stage || 'Initializing Execution...'}
            </span>
            <span className="font-mono font-bold text-blue-400">{progressPercent.toFixed(1)}%</span>
          </div>

          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isFailed
                  ? 'bg-rose-500'
                  : isFinished
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stage Timeline Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2">
          {STAGES.map((stg, i) => {
            const stageNum = i + 1;
            const currentStageNum = currentEvent?.stage_num || 0;
            const isDone = isFinished || currentStageNum > stageNum;
            const isCurrent = !isFinished && !isFailed && currentStageNum === stageNum;

            return (
              <div
                key={i}
                className={`rounded-lg p-2.5 text-[11px] font-medium border text-center transition-all ${
                  isDone
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : isCurrent
                    ? 'bg-blue-600/20 border-blue-500 text-white font-bold shadow-md shadow-blue-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500'
                }`}
              >
                <div className="text-[10px] opacity-70 mb-0.5">Stage {stageNum}</div>
                <div className="truncate">{stg.replace(/Stage \d: /, '')}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal Live Stream */}
      <div className="monitor-card glass-card p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-cyan-400" />
            Backend Execution Logs (SSE Stream)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {logs.length} Log Messages Received
          </span>
        </div>

        <div className="execution-log h-80 rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-1">
          {logs.length === 0 ? (
            <span className="text-slate-600 italic">Waiting for backend pipeline logs...</span>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="leading-relaxed hover:bg-slate-900/50 px-1 rounded">
                <span className="text-slate-400">{log}</span>
              </div>
            ))
          )}
          {errorMessage && (
            <div className="text-rose-400 font-bold bg-rose-500/10 p-2 rounded border border-rose-500/20 mt-2">
              [ERROR] {errorMessage}
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

    </div>
  );
};
