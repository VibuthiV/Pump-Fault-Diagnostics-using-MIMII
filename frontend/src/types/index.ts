export interface HealthData {
  status: string;
  version: string;
  device: string;
  gpu_name?: string;
  dataset_root_exists: boolean;
  checkpoint_exists: boolean;
  groq_key_configured: boolean;
}

export interface CapabilitiesData {
  execution_modes: string[];
  splits: string[];
  default_threshold: number;
  device: string;
  supported_models: string[];
}

export interface RunConfig {
  dataset_root?: string;
  execution_mode: 'checkpoint_only' | 'train_and_eval' | 'full_pipeline';
  split: string;
  quick_demo: boolean;
  skip_training_if_checkpoint_exists: boolean;
  threshold: number;
  enable_groq: boolean;
  groq_api_key?: string;
  epochs?: number;
  batch_size?: number;
  lr?: number;
  seed?: number;
}

export interface AudioPrediction {
  filename: string;
  predicted_label: number;
  predicted_status: 'normal' | 'abnormal';
  abnormal_probability: number;
  threshold: number;
}

export interface ValidateResponse {
  valid: boolean;
  warnings: string[];
  error?: string;
  dataset_info: {
    total_samples?: number;
    split_counts?: Record<string, number>;
    machines?: string[];
    snrs?: string[];
    eval_split_count?: number;
  };
  checkpoint_found: boolean;
  checkpoint_path: string;
  groq_available: boolean;
  estimated_duration: string;
}

export interface ConfusionMatrix {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
  total_normal: number;
  total_abnormal: number;
}

export interface MetricsData {
  n_samples: number;
  auc: number | null;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  specificity: number;
  threshold: number;
  confusion_matrix: ConfusionMatrix;
  positive_count: number;
  negative_count: number;
}

export interface RocPoint {
  fpr: number;
  tpr: number;
  threshold: number;
}

export interface RocData {
  available: boolean;
  auc: number | null;
  points: RocPoint[];
}

export interface PrPoint {
  precision: number;
  recall: number;
  threshold: number;
}

export interface PrData {
  available: boolean;
  average_precision: number | null;
  points: PrPoint[];
}

export interface GroupBreakdown {
  machine_id?: string;
  snr?: string;
  n_samples: number;
  auc: number | null;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  specificity: number;
  confusion_matrix: ConfusionMatrix;
}

export interface MatrixCell {
  n_samples: number;
  auc: number | null;
  accuracy: number;
  recall: number;
  f1_score: number;
}

export interface MachineSnrMatrix {
  machines: string[];
  snrs: string[];
  matrix: Record<string, any>[];
}

export interface PredictionRecord {
  machine_id: string;
  snr: string;
  label: number;
  prob: number;
  pred: number;
  correct: boolean;
}

export interface DiagnosticReport {
  case_label: string;
  machine_id: string;
  snr: string;
  true_label: number;
  probability: number;
  predicted_label: number;
  action: string;
  priority: string;
  decision_note: string;
  retrieved_context_ids: string[];
  report: string;
  groq_executed: boolean;
}

export interface RunStatus {
  run_id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  created_at: string;
  completed_at?: string;
  duration_seconds?: number;
  execution_mode: string;
  dataset_split: string;
  device?: string;
  error_message?: string;
  metrics?: MetricsData;
  config?: RunConfig;
}

export interface ProgressEvent {
  run_id: string;
  stage: string;
  stage_num: number;
  total_stages: number;
  message: string;
  progress: number;
  elapsed_seconds?: number;
  timestamp?: string;
  error?: string;
}
