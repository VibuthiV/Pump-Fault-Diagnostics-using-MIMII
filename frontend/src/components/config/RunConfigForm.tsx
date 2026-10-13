import React, { useState } from 'react';
import type { RunConfig, ValidateResponse, AudioPrediction } from '../../types';
import { predictUploadedAudio, validateRunConfig } from '../../services/api';
import { AudioLines, PlayCircle, ShieldAlert, X } from 'lucide-react';

interface RunConfigFormProps {
  onValidateSuccess: (config: RunConfig, validation: ValidateResponse) => void;
  onClose: () => void;
}

export const RunConfigForm: React.FC<RunConfigFormProps> = ({
  onValidateSuccess,
  onClose
}) => {
  const config: RunConfig = {
    dataset_root: '.',
    execution_mode: 'checkpoint_only',
    split: 'test',
    quick_demo: true,
    skip_training_if_checkpoint_exists: true,
    threshold: 0.5,
    enable_groq: true,
  };

  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPrediction, setAudioPrediction] = useState<AudioPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const validation = await validateRunConfig(config);
      if (!validation.valid) {
        setError(validation.error || 'Test-case validation failed');
        return;
      }
      onValidateSuccess(config, validation);
    } catch (err: any) {
      setError(err.message || 'Failed to validate test cases');
    } finally {
      setLoading(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAudioLoading(true);
    setError(null);
    setAudioPrediction(null);
    try {
      setAudioPrediction(await predictUploadedAudio(file, config.threshold));
    } catch (err: any) {
      setError(err.message || 'Failed to predict uploaded audio');
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="glass-card w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Run Test Cases</h3>
            <p className="text-xs text-slate-400">Evaluate the existing checkpoint on the test split and generate diagnostic reports.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/10 p-4 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-400 flex-shrink-0" />
            <div>
              <p className="font-semibold">Configuration Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-slate-400">Dataset</span><strong className="text-white">MIMII pump test cases</strong></div>
          <div className="flex justify-between"><span className="text-slate-400">Model</span><strong className="text-white">Existing checkpoint</strong></div>
          <div className="flex justify-between"><span className="text-slate-400">Reports</span><strong className="text-emerald-400">Groq enabled</strong></div>
        </div>

        {audioPrediction && (
          <div className={`rounded-xl p-4 border ${audioPrediction.predicted_label ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
            <p className="text-xs text-slate-400">Uploaded audio prediction</p>
            <p className={`text-lg font-bold ${audioPrediction.predicted_label ? 'text-rose-300' : 'text-emerald-300'}`}>
              {audioPrediction.predicted_status.toUpperCase()}
            </p>
            <p className="text-xs text-slate-300">
              Abnormal probability: {(audioPrediction.abnormal_probability * 100).toFixed(1)}%
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('audio-upload')?.click()}
              disabled={audioLoading}
              className="flex items-center gap-2 rounded-xl border border-cyan-500/40 px-4 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 transition-all disabled:opacity-50"
            >
              <AudioLines className="h-4 w-4" />
              <span>{audioLoading ? 'Testing Audio...' : 'Upload Audio and Test'}</span>
            </button>
            <input id="audio-upload" type="file" accept=".wav,audio/wav" className="hidden" onChange={handleAudioUpload} />
            <button
              type="submit"
              disabled={loading || audioLoading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
            >
              {loading ? (
                <span>Checking Test Cases...</span>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  <span>Run Test Cases</span>
                </>
              )}
            </button>
        </form>

      </div>
    </div>
  );
};
