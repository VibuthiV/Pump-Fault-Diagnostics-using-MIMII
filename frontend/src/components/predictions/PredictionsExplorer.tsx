import React, { useState, useEffect } from 'react';
import type { PredictionRecord } from '../../types';
import { fetchPredictions, getPredictionsExportUrl } from '../../services/api';
import {
  Search, Download, CheckCircle2, AlertTriangle, ChevronLeft,
  ChevronRight, X
} from 'lucide-react';

interface PredictionsExplorerProps {
  runId: string;
  initialFilter?: any;
}

export const PredictionsExplorer: React.FC<PredictionsExplorerProps> = ({
  runId,
  initialFilter
}) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<PredictionRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [machineId, setMachineId] = useState<string>(initialFilter?.machine_id || '');
  const [snr, setSnr] = useState<string>(initialFilter?.snr || '');
  const [actualLabel, setActualLabel] = useState<number | undefined>(initialFilter?.actual_label);
  const [predictedLabel, setPredictedLabel] = useState<number | undefined>(initialFilter?.predicted_label);
  const [selectedRecord, setSelectedRecord] = useState<PredictionRecord | null>(null);

  useEffect(() => {
    loadPredictions();
  }, [runId, page, pageSize, machineId, snr, actualLabel, predictedLabel, search]);

  const loadPredictions = async () => {
    setLoading(true);
    try {
      const data = await fetchPredictions(runId, {
        page,
        page_size: pageSize,
        machine_id: machineId || undefined,
        snr: snr || undefined,
        actual_label: actualLabel,
        predicted_label: predictedLabel,
        search: search || undefined,
      });

      setRecords(data.records);
      setTotalRecords(data.total_records);
      setTotalPages(data.total_pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setMachineId('');
    setSnr('');
    setActualLabel(undefined);
    setPredictedLabel(undefined);
    setPage(1);
  };

  const getStatusBadge = (rec: PredictionRecord) => {
    if (rec.label === 0 && rec.pred === 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" /> Normal (Correct)
        </span>
      );
    }
    if (rec.label === 1 && rec.pred === 1) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
          <CheckCircle2 className="h-3 w-3" /> Abnormal (Correct)
        </span>
      );
    }
    if (rec.label === 0 && rec.pred === 1) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
          <AlertTriangle className="h-3 w-3" /> False Positive
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
        <AlertTriangle className="h-3 w-3" /> False Negative
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Export Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Per-Sample Predictions Explorer
            <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {totalRecords} Filtered Samples
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Search, filter, and inspect individual recording predictions, abnormal probabilities, and error cases
          </p>
        </div>

        <a
          href={getPredictionsExportUrl(runId)}
          download
          className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 text-xs font-semibold border border-slate-700 shadow-md transition-all"
        >
          <Download className="h-4 w-4 text-cyan-400" />
          Export Predictions CSV
        </a>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search machine or SNR..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Machine Filter */}
          <select
            value={machineId}
            onChange={(e) => { setMachineId(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Machines (id_00, 02, 04, 06)</option>
            <option value="id_00">Pump 00 (id_00)</option>
            <option value="id_02">Pump 02 (id_02)</option>
            <option value="id_04">Pump 04 (id_04)</option>
            <option value="id_06">Pump 06 (id_06)</option>
          </select>

          {/* SNR Filter */}
          <select
            value={snr}
            onChange={(e) => { setSnr(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Noise Levels (SNR)</option>
            <option value="pump_6db">+6dB Low Noise</option>
            <option value="pump_0db">0dB Moderate Noise</option>
            <option value="pump_minus_6db">-6dB Heavy Noise</option>
          </select>

          {/* Actual Label Filter */}
          <select
            value={actualLabel !== undefined ? actualLabel : ''}
            onChange={(e) => {
              const val = e.target.value === '' ? undefined : parseInt(e.target.value);
              setActualLabel(val);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Ground Truth Labels</option>
            <option value="0">Normal (0)</option>
            <option value="1">Abnormal (1)</option>
          </select>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 font-semibold transition-all"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Predictions Table */}
      <div className="glass-card overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Machine ID</th>
                <th className="p-3.5">Noise Condition (SNR)</th>
                <th className="p-3.5">Ground Truth</th>
                <th className="p-3.5">Abnormal Prob</th>
                <th className="p-3.5">Model Pred</th>
                <th className="p-3.5">Classification Status</th>
                <th className="p-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Loading predictions table...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No prediction records matched the filter criteria.
                  </td>
                </tr>
              ) : (
                records.map((rec, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedRecord(rec)}
                    className="hover:bg-slate-900/60 cursor-pointer transition-all"
                  >
                    <td className="p-3.5 font-mono font-bold text-white">{rec.machine_id}</td>
                    <td className="p-3.5 text-slate-300 font-mono">{rec.snr}</td>
                    <td className="p-3.5">
                      <span className={`font-semibold ${rec.label === 1 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {rec.label === 1 ? 'Abnormal (1)' : 'Normal (0)'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-950 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${rec.prob >= 0.5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${rec.prob * 100}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-200">{rec.prob.toFixed(4)}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={`font-mono font-bold ${rec.pred === 1 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {rec.pred === 1 ? 'Abnormal (1)' : 'Normal (0)'}
                      </span>
                    </td>
                    <td className="p-3.5">{getStatusBadge(rec)}</td>
                    <td className="p-3.5 text-right font-semibold text-blue-400">Inspect →</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-4 bg-slate-950/80 border-t border-slate-800 text-xs">
          <span className="text-slate-400">
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalRecords} records)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Drawer Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-card w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Sample Prediction Detail
              </h3>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Machine Identifier</span>
                  <span className="font-mono font-bold text-white text-sm">{selectedRecord.machine_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Noise Condition (SNR)</span>
                  <span className="font-mono font-bold text-white text-sm">{selectedRecord.snr}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Ground Truth Label</span>
                  <span className="font-bold text-white">{selectedRecord.label === 1 ? 'Abnormal (1)' : 'Normal (0)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Abnormal Probability</span>
                  <span className="font-mono font-bold text-blue-400">{selectedRecord.prob.toFixed(4)}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-bold text-slate-300 block">System Decision Logic Preview:</span>
                <p className="text-slate-400">
                  {selectedRecord.prob >= 0.85
                    ? 'High-confidence abnormal detection → Auto-flag for maintenance.'
                    : selectedRecord.prob >= 0.60
                    ? 'Moderate confidence → Flag for maintenance, recommend engineering verification.'
                    : selectedRecord.prob >= 0.40
                    ? 'Borderline probability → Escalate for manual inspection, do not auto-act.'
                    : 'Low abnormal probability → Routine monitoring.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-xl"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
