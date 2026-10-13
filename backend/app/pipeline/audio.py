"""Audio decoding and feature preparation for single-clip inference."""
import struct
from functools import lru_cache
from pathlib import Path

import numpy as np
import torch


TARGET_SAMPLE_RATE = 16_000
N_FFT = 1024
WIN_LENGTH = 400
HOP_LENGTH = 160
N_MELS = 128


def _decode_pcm_audio(contents: bytes) -> tuple[np.ndarray, int]:
    """Decode PCM, IEEE-float, and extensible WAV files into mono audio."""
    if len(contents) < 12 or contents[:4] != b"RIFF" or contents[8:12] != b"WAVE":
        raise ValueError("Upload a valid WAV audio file.")

    format_data = None
    audio_data = None
    offset = 12
    while offset + 8 <= len(contents):
        chunk_id = contents[offset:offset + 4]
        chunk_size = struct.unpack_from("<I", contents, offset + 4)[0]
        chunk_start = offset + 8
        chunk_end = chunk_start + chunk_size
        if chunk_end > len(contents):
            raise ValueError("The WAV file contains a truncated chunk.")
        if chunk_id == b"fmt ":
            format_data = contents[chunk_start:chunk_end]
        elif chunk_id == b"data":
            audio_data = contents[chunk_start:chunk_end]
        offset = chunk_end + (chunk_size & 1)

    if format_data is None or audio_data is None or len(format_data) < 16:
        raise ValueError("The WAV file is missing audio format or sample data.")

    audio_format, channels, sample_rate, _, block_align, bits_per_sample = struct.unpack_from(
        "<HHIIHH", format_data
    )
    if audio_format == 0xFFFE:
        if len(format_data) < 40:
            raise ValueError("The WAV extensible format header is incomplete.")
        audio_format = struct.unpack_from("<H", format_data, 24)[0]

    if channels < 1 or sample_rate <= 0 or not audio_data:
        raise ValueError("The uploaded WAV file does not contain audio samples.")
    if block_align <= 0 or bits_per_sample not in {8, 16, 24, 32}:
        raise ValueError("The WAV sample width is not supported.")

    if audio_format == 3 and bits_per_sample == 32:
        samples = np.frombuffer(audio_data, dtype="<f4").astype(np.float32)
        samples = samples.reshape(-1, channels)
    elif audio_format == 1 and bits_per_sample == 8:
        samples = np.frombuffer(audio_data, dtype=np.uint8).astype(np.float32)
        samples = (samples.reshape(-1, channels) - 128.0) / 128.0
    elif audio_format == 1 and bits_per_sample == 16:
        samples = np.frombuffer(audio_data, dtype="<i2").astype(np.float32)
        samples = samples.reshape(-1, channels) / 32768.0
    elif audio_format == 1 and bits_per_sample == 24:
        raw = np.frombuffer(audio_data, dtype=np.uint8).reshape(-1, 3)
        values = (
            raw[:, 0].astype(np.int32)
            | (raw[:, 1].astype(np.int32) << 8)
            | (raw[:, 2].astype(np.int32) << 16)
        )
        values[values & 0x800000 != 0] -= 1 << 24
        samples = (values.astype(np.float32) / 8388608.0).reshape(-1, channels)
    elif audio_format == 1 and bits_per_sample == 32:
        samples = np.frombuffer(audio_data, dtype="<i4").astype(np.float32)
        samples = samples.reshape(-1, channels) / 2147483648.0
    else:
        raise ValueError("The WAV encoding is not supported. Use PCM or 32-bit float WAV.")

    samples = samples.mean(axis=1)
    if sample_rate != TARGET_SAMPLE_RATE:
        target_length = max(1, round(len(samples) * TARGET_SAMPLE_RATE / sample_rate))
        source_positions = np.linspace(0, len(samples) - 1, num=len(samples))
        target_positions = np.linspace(0, len(samples) - 1, num=target_length)
        samples = np.interp(target_positions, source_positions, samples).astype(np.float32)
    # The precomputed MIMII waveform features are standardized per clip.
    samples = samples - samples.mean()
    samples_std = samples.std()
    if samples_std > 1e-8:
        samples = samples / samples_std
    return samples, TARGET_SAMPLE_RATE


def _mel_filterbank(sample_rate: int) -> torch.Tensor:
    """Create the triangular filterbank used to project STFT bins to Mel bins."""
    def hz_to_mel(hz: np.ndarray) -> np.ndarray:
        return 1127.01048 * np.log1p(hz / 700.0)

    def mel_to_hz(mel: np.ndarray) -> np.ndarray:
        return 700.0 * np.expm1(mel / 1127.01048)

    min_mel = hz_to_mel(np.array([0.0]))[0]
    max_mel = hz_to_mel(np.array([sample_rate / 2]))[0]
    mel_points = mel_to_hz(np.linspace(min_mel, max_mel, N_MELS + 2))
    bins = np.floor((N_FFT + 1) * mel_points / sample_rate).astype(int)
    filters = np.zeros((N_MELS, N_FFT // 2 + 1), dtype=np.float32)

    for index in range(1, N_MELS + 1):
        left, center, right = bins[index - 1:index + 2]
        if center > left:
            filters[index - 1, left:center] = np.arange(left, center) - left
            filters[index - 1, left:center] /= center - left
        if right > center:
            filters[index - 1, center:right] = (right - np.arange(center, right))
            filters[index - 1, center:right] /= right - center
        # Match librosa's default Slaney normalization used by common
        # precomputed MIMII log-Mel features.
        filters[index - 1] *= 2.0 / (mel_points[index + 1] - mel_points[index - 1])
    return torch.from_numpy(filters)


def _raw_log_mel(waveform: np.ndarray, sample_rate: int) -> np.ndarray:
    waveform_tensor = torch.from_numpy(waveform)
    if waveform_tensor.numel() < WIN_LENGTH:
        waveform_tensor = torch.nn.functional.pad(
            waveform_tensor, (0, WIN_LENGTH - waveform_tensor.numel())
        )

    window = torch.hann_window(WIN_LENGTH)
    stft = torch.stft(
        waveform_tensor,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        win_length=WIN_LENGTH,
        window=window,
        center=True,
        return_complex=True,
    )
    power = stft.abs().pow(2)
    mel = _mel_filterbank(sample_rate).matmul(power)
    return torch.log(mel.clamp_min(1e-10)).numpy().astype(np.float32)


@lru_cache(maxsize=4)
def _feature_calibration(dataset_root: str) -> tuple[np.ndarray, np.ndarray] | None:
    """Fit the deployed dataset's per-Mel-band feature transform once."""
    root = Path(dataset_root)
    pairs = []
    for waveform_path in root.rglob("*_1d.npy"):
        feature_path = waveform_path.with_name(waveform_path.name.replace("_1d.npy", "_2d.npy"))
        if feature_path.exists():
            pairs.append((waveform_path, feature_path))
        if len(pairs) >= 64:
            break
    if len(pairs) < 8:
        return None

    raw_features = []
    stored_features = []
    for waveform_path, feature_path in pairs:
        waveform = np.load(waveform_path).astype(np.float32).squeeze()
        stored = np.load(feature_path).astype(np.float32).squeeze()
        raw = _raw_log_mel(waveform, TARGET_SAMPLE_RATE)
        if raw.shape == stored.shape:
            raw_features.append(raw)
            stored_features.append(stored)
    if len(raw_features) < 8:
        return None

    raw_values = np.concatenate(raw_features, axis=1)
    stored_values = np.concatenate(stored_features, axis=1)
    slopes = np.empty(N_MELS, dtype=np.float32)
    offsets = np.empty(N_MELS, dtype=np.float32)
    for mel_index in range(N_MELS):
        x = raw_values[mel_index]
        y = stored_values[mel_index]
        variance = np.var(x)
        slopes[mel_index] = np.cov(x, y, bias=True)[0, 1] / variance if variance > 1e-8 else 1.0
        offsets[mel_index] = np.mean(y) - slopes[mel_index] * np.mean(x)
    return slopes, offsets


def audio_to_log_mel(contents: bytes, dataset_root: str | None = None) -> torch.Tensor:
    """Convert uploaded WAV bytes into a model-ready [1, 1, n_mels, time] tensor."""
    waveform, sample_rate = _decode_pcm_audio(contents)
    raw_log_mel = _raw_log_mel(waveform, sample_rate)

    if dataset_root is None:
        from app.config import settings
        dataset_root = str(settings.get_dataset_root())
    calibration = _feature_calibration(dataset_root)
    if calibration is not None:
        slopes, offsets = calibration
        raw_log_mel = raw_log_mel * slopes[:, None] + offsets[:, None]

    return torch.from_numpy(raw_log_mel).unsqueeze(0).unsqueeze(0).float()
