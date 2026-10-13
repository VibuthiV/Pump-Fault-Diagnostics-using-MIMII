"""
Diagnostic Reporting Module (Stage 3 & Stage 4).
Preserves TF-IDF knowledge base retrieval, rule-based decision logic,
representative case selection, and Groq LLM explanation generation.
"""
from typing import Dict, List, Tuple, Any, Optional

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

KNOWLEDGE_BASE = [
    {
        "id": "fault_types_general",
        "applies_to": "all",
        "text": (
            "The MIMII pump dataset documents four qualitative fault types across pump units: "
            "cavitation (fluid vaporization causing internal bubble implosions and structural erosion), "
            "bearing defects (frictional degradation, race cracking, structural clicking), impeller "
            "imbalance (rotational asymmetry causing harmonic vibration), and system leakage (fluid "
            "bypass, pressure loss). These are documented failure categories in the literature, not "
            "per-sample ground-truth labels in this dataset -- individual recordings are labelled only "
            "as normal or abnormal."
        )
    },
    {
        "id": "pump06_reliability",
        "applies_to": ["id_06"],
        "text": (
            "Pump ID 06 shows consistently reduced detection reliability at -6dB (heavy background "
            "noise) across every model configuration tested in this project, including the base paper's "
            "own Tiny-AST model (AUC 0.836). This project's own spec_only CRNN model reached AUC 0.944 "
            "(pooled training) and 0.884 (isolated per-pump training) on this specific pump/noise "
            "combination -- still the lowest-confidence cell in the full results table. Manual "
            "verification is recommended for Pump 06 detections under heavy noise conditions specifically."
        )
    },
    {
        "id": "snr_general_reliability",
        "applies_to": "all",
        "text": (
            "Detection reliability across all tested models degrades as SNR decreases. At +6dB and 0dB "
            "(low-to-moderate noise), all tested models in this project achieved AUC above 0.97, "
            "effectively near-ceiling performance. At -6dB (heavy noise), performance drops meaningfully "
            "and becomes pump-dependent, with Pump 06 as the weakest case and Pump 02 typically the "
            "most robust."
        )
    },
    {
        "id": "model_choice_rationale",
        "applies_to": "all",
        "text": (
            "This project's validated primary detection model is a lightweight CRNN (convolutional + "
            "bidirectional GRU) operating on log-Mel spectrograms, 308K parameters, which outperformed "
            "a faithfully reproduced Tiny-AST transformer baseline (800K-1.01M parameters) on overall "
            "accuracy and noise robustness under identical evaluation protocol."
        )
    },
    {
        "id": "domain_adaptation_finding",
        "applies_to": "all",
        "text": (
            "Domain-adversarial adaptation techniques were tested to improve robustness at -6dB, but "
            "were found to underperform plain supervised training overall in this project's controlled "
            "multi-seed study. One narrow exception: zero-shot domain generalization matched baseline "
            "performance specifically on Pump 06 at -6dB without ever training on real -6dB audio."
        )
    },
]

SNR_TO_TEXT = {
    "pump_6db": "+6dB low noise",
    "pump_0db": "0dB moderate noise",
    "pump_minus_6db": "-6dB heavy noise"
}

MACHINE_TO_TEXT = {
    "id_00": "Pump 00",
    "id_02": "Pump 02",
    "id_04": "Pump 04",
    "id_06": "Pump 06"
}


def build_retriever(kb=KNOWLEDGE_BASE):
    texts = [e["text"] for e in kb]
    vec = TfidfVectorizer(stop_words="english")
    return vec, vec.fit_transform(texts)


def retrieve_context(query: str, machine_id: str, kb=KNOWLEDGE_BASE, top_k: int = 2):
    """Metadata-filtered TF-IDF retrieval — exact logic from notebook."""
    eligible = [
        (e, i) for i, e in enumerate(kb)
        if e["applies_to"] == "all" or machine_id in e["applies_to"]
    ]
    if not eligible:
        return []

    vec, matrix = build_retriever(kb)
    indices = [i for _, i in eligible]
    sub_matrix = matrix[indices]
    scores = cosine_similarity(vec.transform([query]), sub_matrix)[0]
    ranked = sorted(zip([e for e, _ in eligible], scores), key=lambda x: x[1], reverse=True)
    return [e for e, s in ranked[:top_k] if s > 0]


def agent_decide(probability: float, snr: str, machine_id: str) -> Tuple[str, str, str]:
    """Rule-based decision logic — exact thresholds from notebook."""
    if probability >= 0.85:
        action, priority, note = "auto-flag for maintenance", "high", "High-confidence detection."
    elif probability >= 0.60:
        action, priority, note = (
            "flag for maintenance, recommend verification",
            "medium",
            "Moderate confidence -- within the range where models show more disagreement."
        )
    elif probability >= 0.40:
        action, priority, note = (
            "escalate for manual inspection, do not auto-act",
            "review-required",
            "Borderline confidence -- automated action not recommended at this probability range."
        )
    else:
        action, priority, note = "no action", "low", "Low abnormal probability."

    if machine_id == "id_06" and snr == "pump_minus_6db" and "high" in priority:
        priority = "high, manual verification recommended"
        note += " Note: this pump/noise combination is this project's documented weakest detection case."

    return action, priority, note


def select_representative_cases(df: pd.DataFrame) -> List[Tuple[str, pd.Series]]:
    """Stage 3: Auto-select representative cases from real test predictions — from notebook."""
    cases = []

    high_conf_abnormal = df[df["label"] == 1].sort_values("prob", ascending=False)
    if len(high_conf_abnormal) > 0:
        cases.append(("Highest-confidence true abnormal detection", high_conf_abnormal.iloc[0]))

    borderline = df.iloc[(df["prob"] - 0.5).abs().argsort()[:1]]
    if len(borderline) > 0:
        cases.append(("Most borderline / uncertain prediction", borderline.iloc[0]))

    confident_normal = df[df["label"] == 0].sort_values("prob")
    if len(confident_normal) > 0:
        cases.append(("Highest-confidence true normal detection", confident_normal.iloc[0]))

    return cases


def generate_groq_report(
    groq_api_key: str,
    probability: float,
    machine_id: str,
    snr: str,
    action: str,
    priority: str,
    note: str,
    context_entries: List[Dict[str, Any]]
) -> str:
    """Generate LLM diagnostic explanation via Groq API (gpt-oss-120b)."""
    if not groq_api_key or not groq_api_key.strip():
        return (
            "[Skipped Groq LLM explanation: GROQ_API_KEY is not set. "
            "Rule-based action and retrieved context are displayed below.]"
        )

    try:
        from groq import Groq
        client = Groq(api_key=groq_api_key)

        if context_entries:
            context_text = "\n\n".join(f"[{e['id']}]: {e['text']}" for e in context_entries)
        else:
            context_text = "(No specifically relevant documented findings for this pump/condition combination.)"

        prompt = f"""You are a maintenance-reporting assistant for an industrial pump monitoring system.

A trained fault-detection model has produced the following result:
- Machine: {machine_id}
- Noise condition (SNR): {snr}
- Abnormal probability: {probability:.2f}

The monitoring system's decision logic has already determined:
- Recommended action: {action}
- Priority: {priority}
- Decision note: {note}

Retrieved context from this project's documented findings (use ONLY this context,
do not introduce outside claims or invent fault diagnoses not supported here.
If the context says there are no specifically relevant findings, do not force
an irrelevant connection -- just state the result plainly):
{context_text}

Write the report using EXACTLY this structure, one short line per field
(this is a strict template -- do not add extra sections, do not use numbered
lists or bold headers beyond what is shown):

Detection Summary: <one sentence: machine, condition, probability>
Decision: <action> | Priority: <priority>
Reliability Context: <ALWAYS state the general detection reliability level for
this specific noise condition first, based on the retrieved context -- e.g.
"near-ceiling reliability (AUC > 0.97) at this noise level" for +6dB/0dB, or
"reduced and pump-dependent reliability" for -6dB. Then, ONLY IF the retrieved
context also contains a caveat specific to this exact pump, append it as a
second short sentence. Never state "no concerns documented" if a general
SNR-level reliability fact is available in the retrieved context -- that fact
itself IS the reliability context.>
Recommended Next Step: <one sentence, concrete action for the engineer>

Keep the ENTIRE response under 100 words total. Do not claim a specific fault
type unless the context explicitly supports it for this exact case."""

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            max_tokens=600,
            reasoning_effort="low",
            messages=[{"role": "user", "content": prompt}],
        )

        content = response.choices[0].message.content
        if not content or not content.strip():
            return f"[No text output returned from Groq API (finish_reason={response.choices[0].finish_reason}).]"
        return content.strip()

    except Exception as e:
        return f"[Groq API call failed: {str(e)}. Displaying rule-based decision instead.]"


def run_stage3_and_stage4(
    df: pd.DataFrame,
    groq_api_key: str = "",
    log_callback: Optional[callable] = None
) -> List[Dict[str, Any]]:
    """Execute Stage 3 (Case selection) & Stage 4 (Diagnostic reporting)."""
    def log(msg):
        if log_callback:
            log_callback(msg)
        print(msg)

    log("[Stage 3] Selecting representative cases from test predictions...")
    selected_cases = select_representative_cases(df)

    log(f"[Stage 4] Running diagnostic explanations for {len(selected_cases)} cases...")
    reports = []

    for label, row in selected_cases:
        prob = float(row["prob"])
        machine_id = str(row["machine_id"])
        snr = str(row["snr"])
        true_label = int(row["label"])

        pump_text = MACHINE_TO_TEXT.get(machine_id, machine_id)
        snr_text = SNR_TO_TEXT.get(snr, snr)
        query = f"{pump_text} {snr_text} fault detection reliability abnormal probability {prob}"

        context_entries = retrieve_context(query, machine_id=machine_id)
        action, priority, note = agent_decide(prob, snr, machine_id)

        report_text = generate_groq_report(
            groq_api_key=groq_api_key,
            probability=prob,
            machine_id=machine_id,
            snr=snr,
            action=action,
            priority=priority,
            note=note,
            context_entries=context_entries
        )

        rep_item = {
            "case_label": label,
            "machine_id": machine_id,
            "snr": snr,
            "true_label": true_label,
            "probability": round(prob, 4),
            "predicted_label": 1 if prob >= 0.5 else 0,
            "action": action,
            "priority": priority,
            "decision_note": note,
            "retrieved_context_ids": [e["id"] for e in context_entries],
            "report": report_text,
            "groq_executed": bool(groq_api_key and "Skipped" not in report_text and "failed" not in report_text)
        }
        reports.append(rep_item)
        log(f"  - Case '{label}' ({machine_id}/{snr}): Action='{action}', Priority='{priority}'")

    return reports
