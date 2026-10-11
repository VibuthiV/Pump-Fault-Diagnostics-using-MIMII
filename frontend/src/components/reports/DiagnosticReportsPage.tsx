import React, { useState, useEffect } from 'react';
import type { DiagnosticReport } from '../../types';
import { fetchDiagnosticReports, getHtmlReportUrl } from '../../services/api';
import {
  FileText, Download,
  Database, HelpCircle, Sparkles
} from 'lucide-react';

interface DiagnosticReportsPageProps {
  runId: string;
}

export const DiagnosticReportsPage: React.FC<DiagnosticReportsPageProps> = ({ runId }) => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<DiagnosticReport[]>([]);

  useEffect(() => {
    loadReports();
  }, [runId]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fetchDiagnosticReports(runId);
      setReports(data.reports);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reports, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `end_to_end_reports_${runId}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const getPriorityBadge = (priority: string) => {
    if (priority.includes('high')) {
      return (
        <span className="rounded bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-400 border border-rose-500/20 uppercase tracking-wider">
          Priority: {priority}
        </span>
      );
    }
    if (priority.includes('medium') || priority.includes('review')) {
      return (
        <span className="rounded bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400 border border-amber-500/20 uppercase tracking-wider">
          Priority: {priority}
        </span>
      );
    }
    return (
      <span className="rounded bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
        Priority: {priority}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-xs text-slate-400">Loading Stage 4 diagnostic reports...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Stage 4 Diagnostic Reports & Explainability
            <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              RAG + Agent Layer
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Automatically selected representative cases grounded in documented project findings and rule-based decision logic
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={downloadJson}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 text-xs font-semibold border border-slate-700 shadow-md transition-all"
          >
            <Download className="h-4 w-4 text-purple-400" />
            Export Reports (JSON)
          </button>

          <a
            href={getHtmlReportUrl(runId)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-4 py-2 text-xs font-semibold shadow-md transition-all"
          >
            <FileText className="h-4 w-4" />
            View Printable HTML Report
          </a>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="glass-card p-8 text-center text-slate-400 space-y-3">
          <HelpCircle className="h-8 w-8 text-slate-500 mx-auto" />
          <h4 className="text-sm font-semibold text-white">No Representative Case Reports Generated</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Diagnostic report generation runs automatically in Stage 4. Run an evaluation pipeline with diagnostic reports enabled to generate reports.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((rep, idx) => (
            <div key={idx} className="glass-card p-6 border border-slate-800 space-y-4 relative overflow-hidden">
              
              {/* Category Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-bold text-white">{rep.case_label}</span>
                </div>
                {getPriorityBadge(rep.priority)}
              </div>

              {/* Prediction Metadata Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Machine Unit</span>
                  <span className="font-mono font-bold text-white">{rep.machine_id}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Noise Condition (SNR)</span>
                  <span className="font-mono font-bold text-white">{rep.snr}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Abnormal Probability</span>
                  <span className="font-mono font-bold text-blue-400">{rep.probability.toFixed(4)}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Recommended Action</span>
                  <span className="font-bold text-amber-300 capitalize">{rep.action}</span>
                </div>
              </div>

              {/* Retrieved Context Entries */}
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-slate-300 block flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-cyan-400" />
                  Retrieved Knowledge Base Document Entries (TF-IDF Similarity):
                </span>
                <div className="flex flex-wrap gap-2">
                  {rep.retrieved_context_ids.map((id) => (
                    <span key={id} className="rounded bg-slate-950 px-2.5 py-1 font-mono text-[11px] text-slate-300 border border-slate-800">
                      [{id}]
                    </span>
                  ))}
                </div>
              </div>

              {/* Generated LLM Report Box */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 block">
                  Diagnostic Report Summary:
                </span>
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {rep.report}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
