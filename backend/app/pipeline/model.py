"""
ML Model definitions — extracted directly from the notebook.
Preserves the exact SpecOnlyModel / CRNNEncoder architecture.
"""
import torch.nn as nn


class CRNNEncoder(nn.Module):
    """CNN + Bidirectional GRU encoder for log-Mel spectrograms.

    Architecture from the notebook:
    - 4 Conv2d layers (1→16→32→64→64) each with BatchNorm, ReLU, MaxPool
    - Bidirectional GRU (64 hidden, 1 layer)
    - Linear projection to embed_dim
    """

    def __init__(self, embed_dim=96, n_mels=128, gru_hidden=64, gru_layers=1):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1), nn.BatchNorm2d(16), nn.ReLU(inplace=True), nn.MaxPool2d((2, 2)),
            nn.Conv2d(16, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(inplace=True), nn.MaxPool2d((2, 2)),
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(inplace=True), nn.MaxPool2d((2, 2)),
            nn.Conv2d(64, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(inplace=True), nn.MaxPool2d((2, 1)),
        )
        freq_after = n_mels // 16
        self.gru = nn.GRU(64 * freq_after, gru_hidden, gru_layers, batch_first=True, bidirectional=True)
        self.proj = nn.Linear(gru_hidden * 2, embed_dim)

    def forward(self, x):
        x = self.cnn(x)
        b, c, f, t = x.shape
        x = x.permute(0, 3, 1, 2).reshape(b, t, c * f)
        out, _ = self.gru(x)
        return self.proj(out.mean(dim=1))


class SpecOnlyModel(nn.Module):
    """Spectrogram-only anomaly detection model.

    Architecture from the notebook:
    - CRNNEncoder → Linear(embed_dim, fused_dim) → ReLU → Dropout(0.3) → Linear(fused_dim, 2)
    """

    def __init__(self, config):
        super().__init__()
        self.encoder = CRNNEncoder(
            embed_dim=config.get("embed_dim_spec", 96),
            n_mels=config.get("n_mels", 128)
        )
        self.head = nn.Sequential(
            nn.Linear(config.get("embed_dim_spec", 96), config.get("fused_dim", 128)),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(config.get("fused_dim", 128), 2),
        )

    def forward(self, spec):
        return self.head(self.encoder(spec))
