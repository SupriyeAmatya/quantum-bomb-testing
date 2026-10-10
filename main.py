"""TRs Quantum Bomb Testing on Qollab: press Run.

Runs the Elitzur-Vaidman bomb tester circuits from bomb.py on the simulator,
checks the safe-proof rates against theory, then inspects one crate of five
bombs with live shots. Needs only Qiskit, so it runs in the browser playground.
"""
import random

import numpy as np
from qiskit.primitives import StatevectorSampler

from bomb import basic_tester, zeno_tester, classify

SHOTS = 1000
STEPS = (2, 5, 10, 15)


def theory(n):
    return np.cos(np.pi / (2 * n)) ** (2 * n)


def rate(circuit, mode, label):
    bits = StatevectorSampler().run([circuit], shots=SHOTS).result()[0].data.meas.get_bitstrings()
    return sum(classify(b, mode) == label for b in bits) / SHOTS


def main():
    print("Can you prove a bomb is live without touching it?\n")
    print(f"{'tester':<14}{'live bombs proven safely':>26}{'theory':>9}{'duds mislabelled':>18}")
    print(f"{'classical':<14}{'0.0%':>26}{'0.0%':>9}{'0.0%':>18}")
    print(f"{'basic (H,H)':<14}{rate(basic_tester(True), 'basic', 'live'):>26.1%}{0.25:>9.1%}"
          f"{rate(basic_tester(False), 'basic', 'live'):>18.1%}")
    for n in STEPS:
        print(f"{'Zeno N=' + str(n):<14}{rate(zeno_tester(n, True), 'zeno', 'live'):>26.1%}{theory(n):>9.1%}"
              f"{rate(zeno_tester(n, False), 'zeno', 'live'):>18.1%}")

    # One crate: five bombs, each tested once with the Zeno tester at N = 10
    N = 10
    crate = [random.random() < 0.5 for _ in range(5)]
    result = StatevectorSampler().run([zeno_tester(N, live) for live in crate], shots=1).result()
    print(f"\nInspecting a crate of 5 bombs with N = {N} steps (one real shot each):")
    names = {"live": "LIVE, proven without touching it", "dud": "dud, cleared", "boom": "BOOM"}
    for i, (live, res) in enumerate(zip(crate, result), start=1):
        outcome = classify(res.data.meas.get_bitstrings()[0], "zeno")
        print(f"  bomb {i}: {names[outcome]:<34} (it was {'live' if live else 'a dud'})")

    print("\nPlay the full game, with levels and the noise study: see the project page.")


if __name__ == "__main__":
    main()
