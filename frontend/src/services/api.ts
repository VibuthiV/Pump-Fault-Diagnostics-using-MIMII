import type {
  HealthData, CapabilitiesData, RunConfig, ValidateResponse,
  RunStatus, MetricsData, RocData, PrData, GroupBreakdown,
  MachineSnrMatrix, DiagnosticReport
} from '../types';

const API_BASE = '/api/v1';

export async function fetchHealth(): Promise<HealthData> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch backend health status');
  return res.json();
}

export async function fetchCapabilities(): Promise<CapabilitiesData> {
  const res = await fetch(`${API_BASE}/capabilities`);
  if (!res.ok) throw new Error('Failed to fetch capabilities');
  return res.json();
}

export async function validateRunConfig(config: RunConfig): Promise<ValidateResponse> {
  const res = await fetch(`${API_BASE}/runs/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Validation request failed');
  return res.json();
}

export async function createRun(config: RunConfig): Promise<RunStatus> {
  const res = await fetch(`${API_BASE}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to start evaluation run');
  }
  return res.json();
}

export async function fetchRuns(): Promise<RunStatus[]> {
  const res = await fetch(`${API_BASE}/runs`);
  if (!res.ok) throw new Error('Failed to fetch run history');
  return res.json();
}

export async function fetchRun(runId: string): Promise<RunStatus> {
  const res = await fetch(`${API_BASE}/runs/${runId}`);
  if (!res.ok) throw new Error(`Failed to fetch run ${runId}`);
  return res.json();
}

export async function cancelRun(runId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/runs/${runId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to request cancellation');
}

export async function fetchRunMetrics(runId: string, threshold?: number): Promise<MetricsData> {
  const url = threshold !== undefined 
    ? `${API_BASE}/runs/${runId}/metrics?threshold=${threshold}`
    : `${API_BASE}/runs/${runId}/metrics`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function fetchRocCurve(runId: string): Promise<RocData> {
  const res = await fetch(`${API_BASE}/runs/${runId}/curves/roc`);
  if (!res.ok) throw new Error('Failed to fetch ROC curve');
  return res.json();
}

export async function fetchPrCurve(runId: string): Promise<PrData> {
  const res = await fetch(`${API_BASE}/runs/${runId}/curves/precision-recall`);
  if (!res.ok) throw new Error('Failed to fetch PR curve');
  return res.json();
}

export async function fetchMachineBreakdown(runId: string): Promise<GroupBreakdown[]> {
  const res = await fetch(`${API_BASE}/runs/${runId}/breakdown/machine`);
  if (!res.ok) throw new Error('Failed to fetch machine breakdown');
  return res.json();
}

export async function fetchSnrBreakdown(runId: string): Promise<GroupBreakdown[]> {
  const res = await fetch(`${API_BASE}/runs/${runId}/breakdown/snr`);
  if (!res.ok) throw new Error('Failed to fetch SNR breakdown');
  return res.json();
}

export async function fetchMachineSnrMatrix(runId: string): Promise<MachineSnrMatrix> {
  const res = await fetch(`${API_BASE}/runs/${runId}/breakdown/machine-snr`);
  if (!res.ok) throw new Error('Failed to fetch Machine x SNR matrix');
  return res.json();
}

export async function fetchTrainingHistory(runId: string): Promise<{ training_occurred: boolean; history: any[] }> {
  const res = await fetch(`${API_BASE}/runs/${runId}/training-history`);
  if (!res.ok) throw new Error('Failed to fetch training history');
  return res.json();
}

export async function fetchPredictions(
  runId: string,
  params: {
    page?: number;
    page_size?: number;
    machine_id?: string;
    snr?: string;
    actual_label?: number;
    predicted_label?: number;
    correct_only?: boolean;
    search?: string;
    threshold?: number;
  }
) {
  const q = new URLSearchParams();
  if (params.page) q.append('page', params.page.toString());
  if (params.page_size) q.append('page_size', params.page_size.toString());
  if (params.machine_id) q.append('machine_id', params.machine_id);
  if (params.snr) q.append('snr', params.snr);
  if (params.actual_label !== undefined) q.append('actual_label', params.actual_label.toString());
  if (params.predicted_label !== undefined) q.append('predicted_label', params.predicted_label.toString());
  if (params.correct_only !== undefined) q.append('correct_only', params.correct_only.toString());
  if (params.search) q.append('search', params.search);
  if (params.threshold !== undefined) q.append('threshold', params.threshold.toString());

  const res = await fetch(`${API_BASE}/runs/${runId}/predictions?${q.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch predictions');
  return res.json();
}

export async function fetchDiagnosticReports(runId: string): Promise<{ reports: DiagnosticReport[] }> {
  const res = await fetch(`${API_BASE}/runs/${runId}/reports`);
  if (!res.ok) throw new Error('Failed to fetch diagnostic reports');
  return res.json();
}

export function getPredictionsExportUrl(runId: string): string {
  return `${API_BASE}/runs/${runId}/predictions/export`;
}

export function getHtmlReportUrl(runId: string): string {
  return `${API_BASE}/runs/${runId}/report/html`;
}

export async function compareRuns(runIds: string[]) {
  const q = new URLSearchParams();
  runIds.forEach(id => q.append('run_ids', id));
  const res = await fetch(`${API_BASE}/runs/compare?${q.toString()}`);
  if (!res.ok) throw new Error('Failed to compare runs');
  return res.json();
}
