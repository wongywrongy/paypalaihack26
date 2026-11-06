"""Speaks each line with Kokoro, locally, into its own trimmed mono WAV.

Reads {"voice", "lines": [{"text", "out"}]} on stdin; prints each line's spoken length in seconds as JSON.
A WAV that already exists is measured, not spoken again. Needs `pip install kokoro-onnx soundfile` and
models/kokoro-v1.0.onnx, models/voices-v1.0.bin.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile

ROOT = Path(__file__).resolve().parent.parent
job = json.load(sys.stdin)
kokoro = None
spoken = []
for line in job["lines"]:
    out = Path(line["out"])
    if not out.exists():
        if kokoro is None:
            from kokoro_onnx import Kokoro
            kokoro = Kokoro(str(ROOT / "models/kokoro-v1.0.onnx"), str(ROOT / "models/voices-v1.0.bin"))
        samples, rate = kokoro.create(line["text"], voice=job["voice"], speed=1.0, lang="en-us")
        # Trim the model's leading and trailing silence so the measured length is the speech itself.
        loud = np.flatnonzero(np.abs(samples) > 0.01)
        samples = samples[loud[0]: loud[-1] + 1] if len(loud) else samples
        peak = float(np.max(np.abs(samples))) or 1.0
        soundfile.write(out, samples * (0.89 / peak), rate, subtype="PCM_16")
    info = soundfile.info(out)
    spoken.append(round(info.frames / info.samplerate, 3))
print(json.dumps(spoken))
