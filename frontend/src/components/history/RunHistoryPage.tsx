import React, { useEffect, useState } from 'react';
import type { RunStatus } from '../../types';
import { deleteRun, fetchRuns } from '../../services/api';
import { CheckSquare, Trash2 } from 'lucide-react';

interface RunHistoryPageProps {
  onSelectRun: (runId: string) => void;
}

export const RunHistoryPage: React.FC<RunHistoryPageProps> = ({ onSelectRun }) => {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunStatus[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      setRuns(await fetchRuns());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load run history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const toggleSelectRun = (runId: string) => {
    setSelectedRunIds((current) => current.includes(runId)
      ? current.filter((id) => id !== runId)
      : [...current, runId]);
  };

  const handleDelete = async () => {
    if (!selectedRunIds.length || deleting) return;
    if (!window.confirm(`Delete ${selectedRunIds.length} selected run${selectedRunIds.length === 1 ? '' : 's'} and its artifacts?`)) return;

    setDeleting(true);
    try {
      for (const runId of selectedRunIds) await deleteRun(runId);
      setSelectedRunIds([]);
      await loadHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to delete selected runs');
    } finally {
      setDeleting(false);
    }
  };

  const toggleAll = () => {
    setSelectedRunIds(selectedRunIds.length === runs.length ? [] : runs.map((run) => run.run_id));
  };

  return (
    <div className="space-y-6">
      <div className="page-heading flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Operations</p>
          <h2 className="text-2xl font-bold">Run history</h2>
          <p className="text-sm text-slate-500 mt-1">Review past evaluations and remove runs you no longer need.</p>
        </div>
        <button
          onClick={handleDelete}
          disabled={!selectedRunIds.length || deleting}
          className="history-delete inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? 'Deleting...' : `Delete selected${selectedRunIds.length ? ` (${selectedRunIds.length})` : ''}`}
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CheckSquare className="h-4 w-4 text-blue-600" />
            Evaluation runs
          </div>
          <button onClick={toggleAll} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            {selectedRunIds.length === runs.length && runs.length ? 'Clear selection' : 'Select all'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 w-12" aria-label="Select" />
                <th className="px-5 py-3">Run</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Mode</th>
                <th className="px-5 py-3">Split</th>
                <th className="px-5 py-3">ROC-AUC</th>
                <th className="px-5 py-3">Accuracy</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-500">Loading run history...</td></tr>
              ) : runs.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-500">No evaluation runs found.</td></tr>
              ) : runs.map((run) => (
                <tr key={run.run_id} className="history-row">
                  <td className="px-5 py-4">
                    <input type="checkbox" checked={selectedRunIds.includes(run.run_id)} onChange={() => toggleSelectRun(run.run_id)} className="h-4 w-4 accent-blue-600" />
                  </td>
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-700">{run.run_id}</td>
                  <td className="px-5 py-4 text-slate-500">{run.created_at}</td>
                  <td className="px-5 py-4 text-xs font-semibold uppercase text-blue-700">{run.execution_mode}</td>
                  <td className="px-5 py-4 text-xs uppercase text-slate-600">{run.dataset_split}</td>
                  <td className="px-5 py-4 font-mono font-semibold text-slate-700">{run.metrics?.auc != null ? run.metrics.auc.toFixed(4) : 'N/A'}</td>
                  <td className="px-5 py-4 font-mono font-semibold text-slate-700">{run.metrics?.accuracy != null ? `${(run.metrics.accuracy * 100).toFixed(2)}%` : 'N/A'}</td>
                  <td className="px-5 py-4"><span className={`run-status run-status-${run.status.toLowerCase()}`}>{run.status}</span></td>
                  <td className="px-5 py-4 text-right"><button onClick={() => onSelectRun(run.run_id)} className="font-semibold text-blue-600 hover:text-blue-800">Inspect</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
