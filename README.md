# MIMII Pump Diagnostic Platform

Professional web dashboard for evaluating the SpecOnly CRNN acoustic anomaly detection model on the MIMII pump dataset. The platform provides test-set metrics, ROC and precision-recall curves, machine/SNR breakdowns, prediction inspection, run history, and grounded diagnostic reports with optional Groq LLM generation.

## What Is Included

- FastAPI backend with background jobs and Server-Sent Events progress
- React, TypeScript, and Vite frontend
- SpecOnlyModel CRNN inference pipeline
- Metrics, confusion matrix, subgroup analysis, and exports
- TF-IDF retrieval and optional Groq diagnostic explanations
- Notebook containing the original end-to-end research workflow

The 10+ GB precomputed feature dataset and model checkpoint are intentionally not committed to GitHub. The dataset is configured as an external directory.

## Requirements

- Windows, macOS, or Linux
- Python 3.10+
- Node.js 18+ and npm
- About 12 GB free disk space for the precomputed feature dataset
- Optional: a Groq API key for LLM-generated diagnostic text

## 1. Clone and Configure

```powershell
git clone https://github.com/VibuthiV/Pump-Fault-Diagnostics-using-MIMII.git
cd Pump-Fault-Diagnostics-using-MIMII
Copy-Item .env.example .env
```

Edit `.env` and set the external dataset directory. Use forward slashes in Windows paths:

```ini
DATASET_ROOT=C:/Users/<your-user>/datasets/mimii-pump-precomputed
OUTPUT_DIR=./artifacts
CHECKPOINT_PATH=./artifacts/spec_only_checkpoint.pt
GROQ_API_KEY=
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_URL=http://localhost:5173
```

Never commit `.env`. It is ignored by Git.

## 2. Download the Dataset

The application needs the precomputed `.npy` features referenced by `manifest.csv`. The notebook does not generate them. Download the Kaggle dataset outside this repository:

```powershell
New-Item -ItemType Directory -Force C:\Users\<your-user>\datasets\mimii-pump-precomputed
python -m pip install kagglehub
$env:KAGGLE_API_TOKEN = "YOUR_KAGGLE_TOKEN"
python -c "import kagglehub; print(kagglehub.dataset_download('pradeepp23alr067/mimii-pump-precomputed-features-v2', output_dir=r'C:\Users\<your-user>\datasets\mimii-pump-precomputed', force_download=False))"
```

The extracted directory must contain `manifest.csv` directly or in a nested folder. The backend searches recursively and rewrites the notebook's original Kaggle paths automatically.

## 3. Install Backend Dependencies

From the repository root:

```powershell
python -m pip install -r backend/requirements.txt
$env:PYTHONPATH = "backend"
python -m unittest discover -s backend/tests
```

## 4. Install Frontend Dependencies

```powershell
Push-Location frontend
npm install
Pop-Location
```

## 5. Start the Application

Open two PowerShell terminals at the repository root.

Terminal 1, backend:

```powershell
$env:PYTHONPATH = "backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2, frontend:

```powershell
Push-Location frontend
npm run dev
Pop-Location
```

Open the dashboard at `http://localhost:5173`.

API documentation is available at `http://localhost:8000/docs`.

The Vite development server proxies `/api` requests to the backend on port 8000.

## 6. Run an Evaluation

1. Open the dashboard.
2. Select **Configure & Run Evaluation**.
3. Select **Run Test Cases** to evaluate the complete test split, or select **Upload Audio and Test** to classify one PCM WAV pump-noise clip.
4. For a test-case run, confirm the test-split checkpoint evaluation.
5. Monitor the live SSE progress view for a test-case run.
6. Open the results dashboard when the run completes.

The default web workflow evaluates the `test` split with the existing checkpoint, threshold `0.5`, and Groq reports enabled when `GROQ_API_KEY` is configured.
Uploaded audio is supported as PCM WAV and is predicted immediately using the existing checkpoint; it does not create a test-case run or add run-history artifacts.

## Output Artifacts

Completed runs are written to `artifacts/runs/<run_id>/`:

- `metrics.json`
- `test_predictions.csv`
- `roc_curve.json`
- `pr_curve.json`
- `machine_breakdown.json`
- `snr_breakdown.json`
- `machine_snr_matrix.json`
- `end_to_end_reports.json`
- `summary_report.json`

Runtime run folders and local credentials are ignored by Git.

## Troubleshooting

### Dataset validation fails

Confirm `DATASET_ROOT` points to the downloaded feature dataset, not the repository containing only the manifest. The validation response reports the number of missing feature files.

### Checkpoint not found

Set `CHECKPOINT_PATH` to a valid local PyTorch checkpoint. Checkpoints are ignored by Git because they are large binary artifacts.

### Groq reports are unavailable

Set `GROQ_API_KEY` in the local `.env` and restart the backend. The pipeline still produces rule-based decisions when Groq is unavailable.

### Port already in use

Stop the process using port 8000 or 5173, or change `BACKEND_PORT` and the Vite proxy target in `frontend/vite.config.ts` together.

## Validation

The repository currently passes the backend test suite and frontend production build:

```powershell
$env:PYTHONPATH = "backend"
python -m unittest discover -s backend/tests
Push-Location frontend
npm run build
Pop-Location
```
