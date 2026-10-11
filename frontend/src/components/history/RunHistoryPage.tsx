import React, { useState, useEffect } from 'react';
import type { RunStatus } from '../../types';
import { fetchRuns, compareRuns } from '../../services/api';
import { X, GitCompare } from 'lucide-react';

interface RunHistoryPageProps {
  onSelectRun: (runId: string) => void;
}

export const RunHistoryPage: React.FC<RunHistoryPageProps> = ({ onSelectRun }) => {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunStatus[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<any | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchRuns();
      setRuns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectRun = (runId: string) => {
    if (selectedRunIds.includes(runId)) {
      setSelectedRunIds(selectedRunIds.filter((id) => id !== runId));
    } else {
      if (selectedRunIds.length >= 4) return;
      setSelectedRunIds([...selectedRunIds, runId]);
    }
  };

  const handleCompare = async () => {
    if (selectedRunIds.length < 2) return;
    try {
      const res = await compareRuns(selectedRunIds);
      setComparisonResult(res.comparison);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Run History & Experiment Comparison
          </h2>
          <p className="text-xs text-slate-400">
            Persistent log of completed, active, and past model evaluation runs
          </p>
        </div>

        {selectedRunIds.length >= 2 && (
          <button
            onClick={handleCompare}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-4 py-2 text-xs font-semibold shadow-lg transition-all"
          >
            <GitCompare className="h-4 w-4" />
            Compare Selected Runs ({selectedRunIds.length})
          </button>
        )}
      </div>

      {/* History Table */}
      <div className="glass-card overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-3.5 w-10 text-center">Compare</th>
                <th className="p-3.5">Run ID</th>
                <th className="p-3.5">Date / Time</th>
                <th className="p-3.5">Mode</th>
                <th className="p-3.5">Split</th>
                <th className="p-3.5">ROC-AUC</th>
                <th className="p-3.5">Accuracy</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">Loading history...</td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">No past runs found in database.</td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.run_id} className="hover:bg-slate-900/60 transition-all">
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRunIds.includes(r.run_id)}
                        onChange={() => toggleSelectRun(r.run_id)}
                        className="accent-blue-500 h-4 w-4 rounded"
                      />
                    </td>
                    <td className="p-3.5 font-mono font-bold text-white">{r.run_id}</td>
                    <td className="p-3.5 text-slate-400">{r.created_at}</td>
                    <td className="p-3.5 font-semibold text-blue-400 uppercase">{r.execution_mode}</td>
                    <td className="p-3.5 text-slate-300 uppercase">{r.dataset_split}</td>
                    <td className="p-3.5 font-mono font-bold text-blue-400">
                      {r.metrics?.auc !== undefined && r.metrics?.auc !== null ? r.metrics.auc.toFixed(4) : 'N/A'}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400">
                      {r.metrics?.accuracy ? `${(r.metrics.accuracy * 100).toFixed(2)}%` : 'N/A'}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${
                        r.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : r.status === 'RUNNING'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onSelectRun(r.run_id)}
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-Side Comparison Modal */}
      {comparisonResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="glass-card w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Side-by-Side Experiment Comparison
              </h3>
              <button onClick={() => setComparisonResult(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-3">Metric / Field</th>
                    {comparisonResult.map((c: any) => (
                      <th key={c.run_id} className="p-3 text-white font-mono font-bold">{c.run_id}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  <tr>
                    <td className="p-3 text-slate-400">Execution Mode</td>
                    {comparisonResult.map((c: any) => (
                      <td key={c.run_id} className="p-3 font-semibold uppercase text-blue-400">{c.execution_mode}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">ROC-AUC</td>
                    {comparisonResult.map((c: any) => (
                      <td key={c.run_id} className="p-3 font-mono font-bold text-blue-400">
                        {c.metrics?.auc !== null && c.metrics?.auc !== undefined ? c.metrics.auc.toFixed(4) : 'N/A'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">Accuracy</td>
                    {comparisonResult.map((c: any) => (
                      <td key={c.run_id} className="p-3 font-mono font-bold text-emerald-400">
                        {c.metrics?.accuracy ? `${(c.metrics.accuracy * 100).toFixed(2)}%` : 'N/A'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">Precision</td>
                    {comparisonResult.map((c: any) => (
                      <td key={c.run_id} className="p-3 font-mono text-cyan-400">
                        {c.metrics?.precision ? c.metrics.precision.toFixed(4) : 'N/A'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">Recall</td>
                    {comparisonResult.map((c: any) => (
                      <td key={c.run_id} className="p-3 font-mono text-purple-400">
                        {c.metrics?.recall ? c.metrics.recall.toFixed(4) : 'N/A'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">F1 Score</td>
                    {comparisonResult.map((c: any) => (
                      <td key={c.run_id} className="p-3 font-mono text-amber-400">
                        {c.metrics?.f1_score ? c.metrics.f1_score.toFixed(4) : 'N/A'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setComparisonResult(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-xl"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
