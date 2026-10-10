"""Elitzur–Vaidman bomb tester circuits for TRs Quantum Bomb Testing.

q0 is the photon: 0 = safe path, 1 = bomb path. A live bomb is modelled as a
CNOT that records the photon's path on a bomb qubit (or, for large N, a
mid-circuit measurement of the photon). A 1 on any bomb check is an explosion.
"""
import numpy as np
from qiskit import QuantumCircuit


def basic_tester(live):
    qc = QuantumCircuit(2)      # q0 = photon, q1 = bomb
    qc.h(0)                     # split into both paths
    if live:
        qc.cx(0, 1)             # bomb checks the path
    qc.h(0)                     # recombine
    qc.measure_all()
    return qc


def zeno_tester(n_steps, live):
    qc = QuantumCircuit(n_steps + 1)  # q0 = photon, q1..qN = bomb's record of each check
    for k in range(n_steps):
        qc.ry(np.pi / n_steps, 0)     # small rotation toward the bomb path
        if live:
            qc.cx(0, k + 1)           # bomb checks after every step
    qc.measure_all()
    return qc


def zeno_midcircuit(n_steps, live):
    qc = QuantumCircuit(1, n_steps + 1)
    for k in range(n_steps):
        qc.ry(np.pi / n_steps, 0)
        if live:
            qc.measure(0, k)          # the bomb's check
    qc.measure(0, n_steps)            # final detector
    return qc


def noisy_simulator(p):
    """AerSimulator with a depolarizing error of strength p after every ry step.

    Shared by generate_pools.py (Level 4 pools) and noise_study.py so both model
    the same noise. Aer is imported here so the rest of this module runs where
    only Qiskit is available (for example Qollab's in-browser playground).
    """
    from qiskit_aer import AerSimulator
    from qiskit_aer.noise import NoiseModel, depolarizing_error
    if not p:
        return AerSimulator()
    noise = NoiseModel()
    noise.add_all_qubit_quantum_error(depolarizing_error(p, 1), ["ry"])
    return AerSimulator(noise_model=noise)


def run_midcircuit(sim, circuits, shots, seed):
    """Run mid-circuit testers as one batched job; optimization_level=0 keeps every ry separate."""
    from qiskit import transpile
    tqc = transpile(circuits, sim, optimization_level=0)
    return sim.run(tqc, shots=shots, memory=True, seed_simulator=seed).result()


def classify(bits, mode):
    """bits as Qiskit prints them: qubit/clbit 0 is the rightmost character."""
    photon, bombs = bits[-1], bits[:-1]
    if "1" in bombs:
        return "boom"
    if mode == "basic":
        return "live" if photon == "1" else "unknown"
    return "live" if photon == "0" else "dud"   # Zeno: 0 = live, 1 = dud


def classify_midcircuit(bits):
    """Mid-circuit strings have the final detector leftmost; reverse first."""
    return classify(bits[::-1], "zeno")
