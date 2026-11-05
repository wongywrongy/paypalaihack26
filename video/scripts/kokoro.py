"""Speaks each cue with Kokoro, locally, and places it at its start second in one mono WAV.

Reads {"voice", "seconds", "out", "cues": [{"start", "text"}]} on stdin; prints the spoken length of each cue as JSON.
Needs `pip install kokoro-onnx soundfile` and models/kokoro-v1.0.onnx, models/voices-v1.0.bin.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
job = json.load(sys.stdin)
kokoro = Kokoro(str(ROOT / "models/kokoro-v1.0.onnx"), str(ROOT / "models/voices-v1.0.bin"))
rate = 24000
track = np.zeros(int(job["seconds"] * rate), dtype=np.float32)
spoken = []
for cue in job["cues"]:
    samples, rate = kokoro.create(cue["text"], voice=job["voice"], speed=1.0, lang="en-us")
    # Trim the model's leading and trailing silence so the measured length is the speech itself.
    loud = np.flatnonzero(np.abs(samples) > 0.01)
    samples = samples[loud[0]: loud[-1] + 1] if len(loud) else samples
    at = int(cue["start"] * rate)
    end = min(len(track), at + len(samples))
    track[at:end] += samples[: end - at]
    spoken.append(round(len(samples) / rate, 3))
peak = float(np.max(np.abs(track))) or 1.0
soundfile.write(job["out"], track * (0.89 / peak), rate, subtype="PCM_16")
print(json.dumps(spoken))
