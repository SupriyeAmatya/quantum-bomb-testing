"""Technical extension: find the best number of steps N under noise.

Runs the mid-circuit Zeno tester on Aer with a depolarizing error after each ry
step and records, per N, the share of live bombs proven safely and the share of
duds mislabelled live. Writes noise_results.json for the project page chart.
"""
import json
from pathlib import Path

from bomb import zeno_midcircuit, noisy_simulator, run_midcircuit

HERE = Path(__file__).resolve().parent
SHOTS = 4000
SEED = 1993
NOISE_LEVELS = (0.0, 0.005, 0.01, 0.02)
STEPS = (2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 70, 100)

out = {"shots": SHOTS, "seed": SEED, "steps": list(STEPS), "curves": []}
for p in NOISE_LEVELS:
    circuits = [zeno_midcircuit(n, live) for n in STEPS for live in (True, False)]
    res = run_midcircuit(noisy_simulator(p), circuits, SHOTS, SEED)
    rates = {}
    for j, n in enumerate(STEPS):
        live, dud = res.get_counts(2 * j), res.get_counts(2 * j + 1)
        safe = sum(c for bits, c in live.items() if set(bits) == {"0"}) / SHOTS   # no boom, reads 0
        dud_wrong = sum(c for bits, c in dud.items() if bits[0] == "0") / SHOTS   # dud labelled live
        rates[n] = (safe, dud_wrong)

    best = max(rates, key=lambda n: rates[n][0])
    print(f"p={p}: best N={best}, safe={rates[best][0]:.1%}, duds mislabelled={rates[best][1]:.1%}")
    out["curves"].append({
        "p": p, "best_n": best,
        "safe": [round(rates[n][0], 4) for n in STEPS],
        "dud_wrong": [round(rates[n][1], 4) for n in STEPS],
    })

with open(HERE / "noise_results.json", "w") as f:
    json.dump(out, f, indent=1)
