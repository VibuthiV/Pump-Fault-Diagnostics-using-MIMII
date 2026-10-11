import React, { useState, useEffect } from 'react';
import type {
  MetricsData, RocData, PrData, GroupBreakdown, MachineSnrMatrix
} from '../../types';
import {
  fetchRunMetrics, fetchRocCurve, fetchPrCurve,
  fetchMachineBreakdown, fetchSnrBreakdown, fetchMachineSnrMatrix,
  fetchTrainingHistory, getHtmlReportUrl
} from '../../services/api';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine
} from 'recharts';

import {
  Activity, Sliders, Download,
  AlertTriangle, Grid
} from 'lucide-react';

interface ResultsDashboardProps {
  runId: string;
  onNavigateToPredictions: (filterObj?: any) => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  runId,
  onNavigateToPredictions
}) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [threshold, setThreshold] = useState<number>(0.5);
  const [rocData, setRocData] = useState<RocData | null>(null);
  const [prData, setPrData] = useState<PrData | null>(null);
  const [machineBreakdown, setMachineBreakdown] = useState<GroupBreakdown[]>([]);
  const [snrBreakdown, setSnrBreakdown] = useState<GroupBreakdown[]>([]);
  const [matrixData, setMatrixData] = useState<MachineSnrMatrix | null>(null);
  const [trainingHistory, setTrainingHistory] = useState<any[]>([]);
  const [heatmapMetric, setHeatmapMetric] = useState<'auc' | 'accuracy' | 'recall' | 'f1_score'>('auc');

  useEffect(() => {
    loadData();
  }, [runId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, roc, pr, mach, snr, mat, trHist] = await Promise.all([
        fetchRunMetrics(runId),
        fetchRocCurve(runId),
        fetchPrCurve(runId),
        fetchMachineBreakdown(runId),
        fetchSnrBreakdown(runId),
        fetchMachineSnrMatrix(runId),
        fetchTrainingHistory(runId),
      ]);

      setMetrics(m);
      setThreshold(m.threshold);
      setRocData(roc);
      setPrData(pr);
      setMachineBreakdown(mach);
      setSnrBreakdown(snr);
      setMatrixData(mat);
      if (trHist.training_occurred) {
        setTrainingHistory(trHist.history);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdChange = async (newThresh: number) => {
    setThreshold(newThresh);
    try {
      const updatedMetrics = await fetchRunMetrics(runId, newThresh);
      setMetrics(updatedMetrics);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center space-y-3">
        <div className="text-center space-y-2">
          <Activity className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading evaluation metrics & interactive visualizations...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="glass-card p-8 text-center text-slate-400">
        <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
        <p className="text-sm font-semibold">Evaluation metrics not available for run {runId}.</p>
      </div>
    );
  }

  const cm = metrics.confusion_matrix;
  const tnPct = cm.total_normal > 0 ? (cm.tn / cm.total_normal * 100).toFixed(1) : '0';
  const fpPct = cm.total_normal > 0 ? (cm.fp / cm.total_normal * 100).toFixed(1) : '0';
  const fnPct = cm.total_abnormal > 0 ? (cm.fn / cm.total_abnormal * 100).toFixed(1) : '0';
  const tpPct = cm.total_abnormal > 0 ? (cm.tp / cm.total_abnormal * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      
      {/* Top Header & Report Download Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Results Dashboard
            <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {runId}
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Evaluated on test dataset split ({metrics.n_samples} samples) | Positive class = Abnormal (1)
          </p>
        </div>

        <a
          href={getHtmlReportUrl(runId)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 text-xs font-semibold border border-slate-700 shadow-md transition-all"
        >
          <Download className="h-4 w-4 text-cyan-400" />
          Export Printable Report (HTML)
        </a>
      </div>

      {/* 6A. Summary Metric Cards */}
      <div className="metric-grid grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
        <div className="glass-card p-4 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block">ROC-AUC</span>
          <span className="text-2xl font-extrabold text-blue-400">
            {metrics.auc !== null ? metrics.auc.toFixed(4) : 'N/A'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">Area under ROC</span>
        </div>

        <div className="glass-card p-4 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Accuracy</span>
          <span className="text-2xl font-extrabold text-emerald-400">
            {(metrics.accuracy * 100).toFixed(2)}%
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">Overall correctness</span>
        </div>

        <div className="glass-card p-4 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Precision</span>
          <span className="text-2xl font-extrabold text-cyan-400">
            {metrics.precision.toFixed(4)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">TP / (TP + FP)</span>
        </div>

        <div className="glass-card p-4 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Recall</span>
          <span className="text-2xl font-extrabold text-purple-400">
            {metrics.recall.toFixed(4)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">Sensitivity / TPR</span>
        </div>

        <div className="glass-card p-4 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block">F1 Score</span>
          <span className="text-2xl font-extrabold text-amber-400">
            {metrics.f1_score.toFixed(4)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">Harmonic mean</span>
        </div>

        <div className="glass-card p-4 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Specificity</span>
          <span className="text-2xl font-extrabold text-teal-400">
            {metrics.specificity.toFixed(4)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">TN / (TN + FP)</span>
        </div>

        <div className="glass-card p-4 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block">False Positives</span>
          <span className="text-2xl font-extrabold text-rose-400">{cm.fp}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Normal predicted abnormal</span>
        </div>

        <div className="glass-card p-4 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block">False Negatives</span>
          <span className="text-2xl font-extrabold text-rose-400">{cm.fn}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Abnormal predicted normal</span>
        </div>
      </div>

      {/* 6F. Interactive Post-Hoc Threshold Control */}
      <div className="glass-card p-5 border border-slate-800 bg-slate-900/90 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-blue-400" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Interactive Post-Hoc Threshold Analysis
              </h3>
              <p className="text-[11px] text-slate-400">
                Adjust decision threshold dynamically to see post-hoc impact on Precision, Recall, and Errors without retraining
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Threshold:</span>
            <span className="font-mono text-sm font-extrabold text-blue-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              {threshold.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <span className="text-xs font-mono text-slate-500">0.10</span>
          <input
            type="range"
            min="0.10"
            max="0.90"
            step="0.01"
            value={threshold}
            onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-2 bg-slate-950 rounded-lg cursor-pointer"
          />
          <span className="text-xs font-mono text-slate-500">0.90</span>
        </div>
      </div>

      {/* Grid: Confusion Matrix & ROC/PR Curves */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 6B. Confusion Matrix */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
            <span>Confusion Matrix</span>
            <span className="text-[11px] font-mono text-slate-400 font-normal">Threshold = {threshold.toFixed(2)}</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 pt-2 text-center text-xs">
            {/* True Negative */}
            <div
              onClick={() => onNavigateToPredictions({ actual_label: 0, predicted_label: 0 })}
              className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/50 cursor-pointer transition-all space-y-1"
            >
              <div className="text-[10px] text-slate-400 uppercase font-semibold">True Negative (TN)</div>
              <div className="text-2xl font-bold text-emerald-400">{cm.tn}</div>
              <div className="text-[10px] text-slate-500">({tnPct}% of normal)</div>
            </div>

            {/* False Positive (Clickable error cell) */}
            <div
              onClick={() => onNavigateToPredictions({ actual_label: 0, predicted_label: 1 })}
              className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:border-rose-500/60 cursor-pointer transition-all space-y-1"
            >
              <div className="text-[10px] text-rose-300 uppercase font-semibold">False Positive (FP)</div>
              <div className="text-2xl font-bold text-rose-400">{cm.fp}</div>
              <div className="text-[10px] text-rose-400/70">({fpPct}% of normal) - Inspect</div>
            </div>

            {/* False Negative (Clickable error cell) */}
            <div
              onClick={() => onNavigateToPredictions({ actual_label: 1, predicted_label: 0 })}
              className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:border-rose-500/60 cursor-pointer transition-all space-y-1"
            >
              <div className="text-[10px] text-rose-300 uppercase font-semibold">False Negative (FN)</div>
              <div className="text-2xl font-bold text-rose-400">{cm.fn}</div>
              <div className="text-[10px] text-rose-400/70">({fnPct}% of abnormal) - Inspect</div>
            </div>

            {/* True Positive */}
            <div
              onClick={() => onNavigateToPredictions({ actual_label: 1, predicted_label: 1 })}
              className="p-4 rounded-xl bg-slate-950/80 border border-blue-500/20 hover:border-blue-500/50 cursor-pointer transition-all space-y-1"
            >
              <div className="text-[10px] text-slate-400 uppercase font-semibold">True Positive (TP)</div>
              <div className="text-2xl font-bold text-blue-400">{cm.tp}</div>
              <div className="text-[10px] text-slate-500">({tpPct}% of abnormal)</div>
            </div>
          </div>
        </div>

        {/* 6C. ROC Curve */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Receiver Operating Characteristic (ROC)</h3>
            <span className="text-xs font-mono font-bold text-blue-400">
              AUC = {rocData?.auc !== null ? rocData?.auc?.toFixed(4) : 'N/A'}
            </span>
          </div>

          <div className="h-56 w-full">
            {rocData?.available && rocData.points.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rocData.points} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="fpr" type="number" domain={[0, 1]} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="tpr" type="number" domain={[0, 1]} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dbe3ef', borderRadius: '10px', fontSize: '11px', boxShadow: '0 8px 24px rgba(15,23,42,.12)' }}
                  />
                  <Line type="monotone" dataKey="tpr" stroke="#2563eb" strokeWidth={3} dot={false} name="SpecOnly Model" />
                  <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#cbd5e1" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">ROC Curve Unavailable</div>
            )}
          </div>
        </div>

        {/* 6D. Precision-Recall Curve */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Precision-Recall (PR) Curve</h3>
            <span className="text-xs font-mono font-bold text-cyan-400">
              AP = {prData?.average_precision !== null ? prData?.average_precision?.toFixed(4) : 'N/A'}
            </span>
          </div>

          <div className="h-56 w-full">
            {prData?.available && prData.points.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prData.points} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="recall" type="number" domain={[0, 1]} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="precision" type="number" domain={[0, 1]} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dbe3ef', borderRadius: '10px', fontSize: '11px', boxShadow: '0 8px 24px rgba(15,23,42,.12)' }}
                  />
                  <Line type="monotone" dataKey="precision" stroke="#0f766e" strokeWidth={3} dot={false} name="Precision" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">PR Curve Unavailable</div>
            )}
          </div>
        </div>

      </div>

      {/* Grid: Subgroup Breakdowns (Machine & SNR) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 6G. Performance by Machine */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Performance by Machine Unit</h3>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={machineBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="machine_id" stroke="#64748b" fontSize={10} />
                <YAxis domain={[0, 1]} stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="auc" fill="#3b82f6" name="ROC-AUC" radius={[4, 4, 0, 0]} />
                <Bar dataKey="accuracy" fill="#10b981" name="Accuracy" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6H. Performance by SNR Noise Condition */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Performance by SNR Noise Condition</h3>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snrBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="snr" stroke="#64748b" fontSize={10} />
                <YAxis domain={[0, 1]} stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="auc" fill="#3b82f6" name="ROC-AUC" radius={[4, 4, 0, 0]} />
                <Bar dataKey="accuracy" fill="#10b981" name="Accuracy" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 6I. Machine x SNR Heatmap Matrix */}
      {matrixData && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Grid className="h-4 w-4 text-purple-400" />
              Machine × SNR Performance Heatmap Matrix
            </h3>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Metric:</span>
              <select
                value={heatmapMetric}
                onChange={(e: any) => setHeatmapMetric(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-white rounded-lg px-2.5 py-1"
              >
                <option value="auc">ROC-AUC</option>
                <option value="accuracy">Accuracy</option>
                <option value="recall">Recall</option>
                <option value="f1_score">F1 Score</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="p-3">Machine ID</th>
                  {matrixData.snrs.map((s) => (
                    <th key={s} className="p-3 text-center uppercase">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.matrix.map((row) => (
                  <tr key={row.machine_id} className="border-b border-slate-900">
                    <td className="p-3 font-mono font-bold text-white">{row.machine_id}</td>
                    {matrixData.snrs.map((s) => {
                      const cell = row[s];
                      if (!cell) return <td key={s} className="p-3 text-center text-slate-600">-</td>;
                      
                      const val = cell[heatmapMetric];
                      const valStr = val !== null && val !== undefined ? val.toFixed(3) : 'N/A';
                      
                      const isWeakest = row.machine_id === 'id_06' && s === 'pump_minus_6db';

                      return (
                        <td key={s} className="p-2 text-center">
                          <div className={`p-3 rounded-lg border heatmap-cell font-mono font-bold ${
                            isWeakest
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : val > 0.95
                              ? 'bg-blue-600/25 border-blue-500/40 text-blue-300'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}>
                            <div>{valStr}</div>
                            <div className="text-[9px] font-normal text-slate-400">n={cell.n_samples}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6J. Training History Chart (If training occurred) */}
      {trainingHistory.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Training History (Epoch vs Train AUC / Val AUC)
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trainingHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="epoch" stroke="#64748b" fontSize={10} />
                <YAxis domain={[0.5, 1.0]} stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                <Line type="monotone" dataKey="train_auc" stroke="#3b82f6" strokeWidth={2} name="Train AUC" />
                <Line type="monotone" dataKey="val_auc" stroke="#10b981" strokeWidth={2} name="Val AUC" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
};
