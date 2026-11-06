"""Synthesises the film's three sound effects into sfx/: a soft click, a whoosh and a tick. Run with the voice venv."""
import numpy as np
import soundfile as sf

SR = 48000
rng = np.random.default_rng(7)


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t / decay)


n = int(0.06 * SR); t = np.arange(n) / SR
click = (0.6 * np.sin(2 * np.pi * 1800 * t) + 0.4 * rng.standard_normal(n) * np.exp(-t / 0.004)) * env(n, 0.0005, 0.012)
n = int(0.45 * SR); noise = np.convolve(rng.standard_normal(n), np.ones(40) / 40, 'same')
noise -= np.convolve(noise, np.ones(400) / 400, 'same'); t = np.arange(n) / SR
whoosh = noise * np.sin(np.pi * t / t[-1]) ** 2
n = int(0.25 * SR); t = np.arange(n) / SR
tick = (np.sin(2 * np.pi * 2400 * t) + 0.5 * np.sin(2 * np.pi * 3600 * t)) * env(n, 0.001, 0.05)
for name, x in [('click', click), ('whoosh', whoosh), ('tick', tick)]:
    sf.write(f'sfx/{name}.wav', (x / np.max(np.abs(x)) * 0.9).astype(np.float32), SR, subtype='PCM_16')
