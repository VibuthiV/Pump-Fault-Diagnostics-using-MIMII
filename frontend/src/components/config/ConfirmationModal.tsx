import React, { useState } from 'react';
import type { RunConfig, ValidateResponse } from '../../types';
import { AlertTriangle, PlayCircle, Clock, X } from 'lucide-react';

interface ConfirmationModalProps {
  config: RunConfig;
  validation: ValidateResponse;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  config,
  validation,
  onConfirm,
  onCancel
}) => {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmClick = () => {
    if (submitting) return;
    setSubmitting(true);
    onConfirm();
  };

  const willTrain = config.execution_mode !== 'checkpoint_only' && !validation.warnings.some(w => w.includes('reused'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="glass-card w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Explicit Run Confirmation</h3>
              <p className="text-xs text-slate-400">Review planned pipeline execution parameters before launch</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Confirmation Details Summary */}
        <div className="space-y-4 text-xs">
          
          <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block text-[11px] uppercase tracking-wider">Target Dataset Split</span>
                <span className="font-bold text-white uppercase">{config.split} Split</span>
                <span className="text-[11px] text-slate-400 block">
                  ({validation.dataset_info.eval_split_count || 1266} evaluated samples)
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] uppercase tracking-wider">Execution Mode</span>
                <span className="font-bold text-blue-400 uppercase">{config.execution_mode}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] uppercase tracking-wider">Model Training</span>
                <span className={`font-bold ${willTrain ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {willTrain ? `Yes (${config.epochs} Epochs)` : 'Skipped (Reusing Checkpoint)'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] uppercase tracking-wider">Groq LLM Reports</span>
                <span className={`font-bold ${validation.groq_available ? 'text-purple-400' : 'text-slate-400'}`}>
                  {validation.groq_available ? 'Enabled (gpt-oss-120b)' : 'Disabled / Rule-Based'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-slate-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                Est. Duration: <strong className="text-white">{validation.estimated_duration}</strong>
              </span>
              <span>Decision Threshold: <strong className="text-blue-400">{config.threshold}</strong></span>
            </div>
          </div>

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20 text-amber-300 text-[11px] space-y-1">
              <span className="font-bold block">Execution Notes:</span>
              {validation.warnings.map((w, i) => (
                <p key={i} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {w}
                </p>
              ))}
            </div>
          )}

          {willTrain && (
            <p className="text-[11px] text-amber-400 italic">
              * Note: Full model training will run PyTorch backpropagation across epochs before evaluating test set.
            </p>
          )}

          {/* Output Artifacts Disclosed */}
          <div className="space-y-1 text-slate-400 text-[11px]">
            <span className="font-bold text-slate-300 block">Expected Run Artifacts:</span>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded bg-slate-800 px-2 py-1 text-slate-300 border border-slate-700">test_predictions.csv</span>
              <span className="rounded bg-slate-800 px-2 py-1 text-slate-300 border border-slate-700">metrics.json</span>
              <span className="rounded bg-slate-800 px-2 py-1 text-slate-300 border border-slate-700">end_to_end_reports.json</span>
              <span className="rounded bg-slate-800 px-2 py-1 text-slate-300 border border-slate-700">spec_only_checkpoint.pt</span>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-all"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={submitting}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-all ${
              submitting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-emerald-500/20 active:scale-95'
            }`}
          >
            {submitting ? (
              <span>Submitting Backend Job...</span>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Confirm and Run
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
