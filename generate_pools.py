"""Run every circuit the game needs and save each shot as a pool of outcomes.

Ideal pools (Levels 1-3) come from StatevectorSampler. Level 4 pools come from
Aer with a depolarizing error after every ry step, using the mid-circuit
tester so N can go to 50. Seeded, so a rerun gives the same pools.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

from qiskit.primitives import StatevectorSampler

from bomb import (basic_tester, zeno_tester, zeno_midcircuit, classify, classify_midcircuit,
                  noisy_simulator, run_midcircuit)

HERE = Path(__file__).resolve().parent
SHOTS = 500
SEED = 1993             # the year of the Elitzur-Vaidman paper
NOISE_P = 0.01          # Level 4: 1% depolarizing error per step
NOISY_N = range(2, 51)  # Level 4 slider range
CODE = {"live": "L", "dud": "D", "boom": "B", "unknown": "U"}

# Build every ideal circuit, then run them all in one sampler call
jobs = [("basic", None, True), ("basic", None, False)]
jobs += [("zeno", n, live) for n in range(1, 16) for live in (True, False)]
circuits = [basic_tester(live) if mode == "basic" else zeno_tester(n, live)
            for mode, n, live in jobs]
results = StatevectorSampler(seed=SEED).run(circuits, shots=SHOTS).result()

pools = {"basic": {}, "zeno": {}, "noisy": {}}
for (mode, n, live), res in zip(jobs, results):
    shots = "".join(CODE[classify(b, mode)] for b in res.data.meas.get_bitstrings())
    kind = "live" if live else "dud"
    if mode == "basic":
        pools["basic"][kind] = shots
    else:
        pools["zeno"].setdefault(str(n), {})[kind] = shots

# Level 4: noisy mid-circuit runs on Aer, all in one batched job
noisy_jobs = [(n, live) for n in NOISY_N for live in (True, False)]
noisy = run_midcircuit(noisy_simulator(NOISE_P), [zeno_midcircuit(n, live) for n, live in noisy_jobs], SHOTS, SEED)
for i, (n, live) in enumerate(noisy_jobs):
    pools["noisy"].setdefault(str(n), {})["live" if live else "dud"] = \
        "".join(CODE[classify_midcircuit(b)] for b in noisy.get_memory(i))

meta = {
    "backend": "StatevectorSampler (ideal)",
    "noisy_backend": f"AerSimulator, depolarizing error p={NOISE_P} after each ry",
    "noise_p": NOISE_P,
    "shots_per_pool": SHOTS,
    "seed": SEED,
    "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
}
with open(HERE / "pools.json", "w") as f:
    json.dump({"meta": meta, "pools": pools}, f, separators=(",", ":"))
print(f"wrote {HERE / 'pools.json'}")
