# TRs Quantum Bomb Testing

Prove a bomb is live without letting light touch it.

TRs Quantum Bomb Testing is a game built on the **Elitzur–Vaidman bomb tester** (1993). You inspect a crate of bombs. Some are live and some are duds, and the only sensor that can tell them apart sets off a live bomb the moment light reaches it. Classically, every test of a live bomb is an explosion. With the quantum tester you can prove a bomb is live while the photon never touches it: 25% of the time with the basic setup, and over 90% with the Zeno upgrade.

Every in-game outcome is a real shot from a Qiskit circuit. Python runs the circuits and saves each shot to a pool (`pools.json`); the browser draws the next shot from the matching pool. This is the same quantum math, run on simulated qubits; the original experiments used real photons.

## The problem it explores

A live bomb acts as a measurement. The photon is one qubit: 0 is the safe path, 1 is the bomb path.

1. **H** splits the photon into both paths.
2. **The bomb**: a dud does nothing. A live bomb checks the path (a CNOT onto a bomb qubit) and explodes if it finds 1.
3. **H** recombines the paths and the detector reads 0 or 1.

With a dud the two H gates cancel and the detector always reads 0. A live bomb destroys that interference, so sometimes it reads 1. A dud can never produce a 1, so a 1 proves the bomb is live, and in that run the photon took the safe path.

| Outcome | Dud | Live bomb |
|---|---|---|
| Explosion | 0% | 50% |
| Reads 1: live, proven safely | 0% | 25% |
| Reads 0: inconclusive | 100% | 25% |

**Zeno upgrade.** Repeat N times: `ry(π/N)` on the photon, then the bomb checks. A dud lets the rotations add up to 1. A live bomb's checks keep finding 0 and snap the photon back, so it ends on 0 with no explosion. Here 0 means live and 1 means dud.

P_safe(N) = cos^(2N)(π / 2N): 25% at N = 2, 78% at N = 10, 90.6% at N = 25, 95.2% at N = 50.

## Levels

| Level | What changes | What the player learns |
|---|---|---|
| 1. Classical | Only N = 1 | Every live bomb explodes. That's the problem. |
| 2. Interferometer | Basic tester (H, check, H), with retests | You can prove a bomb is live without touching it, sometimes |
| 3. Patience | Step slider 2–15, 40 energy per crate | More checks freeze the photon (the Zeno effect) |
| 4. Real lab | Noise on (1% depolarizing per step), slider to 50, 120 energy | Too many steps let noise in, so there's a best N |

Scoring: live bomb proven safely +10, dud cleared +3, explosion −15, wrong label −20 (only possible in Level 4, scored when the crate closes). Each step costs 1 energy in Levels 3 and 4.

## Results

Share of live bombs proven safely, from `noise_study.py`: mid-circuit Zeno tester on Qiskit Aer, 4,000 shots per point, depolarizing error after every `ry`, seed 1993 so a rerun reproduces these numbers.

| Steps N | Ideal | 0.5% noise | 1% noise | 2% noise |
|---|---|---|---|---|
| 2 | 25.9% | 24.3% | 24.3% | 24.3% |
| 5 | 61.0% | 59.5% | 58.7% | 57.5% |
| 10 | 77.4% | 76.1% | 74.4% | 70.0% |
| 15 | 85.0% | 81.8% | 78.8% | 72.9% |
| 20 | 89.0% | 84.8% | 80.9% | 72.8% |
| 25 | 91.3% | 84.6% | 79.6% | 70.7% |
| 30 | 91.5% | 85.1% | 78.5% | 68.3% |
| 50 | 94.5% | 84.2% | 73.2% | 57.6% |
| 100 | 97.8% | 75.4% | 59.2% | 35.8% |
| **Best N** | 100 | ≈ 30 | ≈ 20 | ≈ 15 |
| Safe proofs at best N | 97.8% | 85.1% | 80.9% | 72.9% |
| Duds labelled live at best N | 0.0% | 6.7% | 9.2% | 12.5% |
| **Classical tester** | 0% | 0% | 0% | 0% |

The noisy curves are flat near their peaks, so the best N moves by a few steps between runs.

## How to run

**On Qollab (the full game):** upload every file below at the top level of the project, then press Run with the built-in simulator. Because the project has `index.html` and `main.js`, Qollab runs it as a JS project and shows the game above the console. `main.js` starts the game, and `shipped_data.py` reads `pools.json` and `noise_results.json` in Python and passes them to the page, since JavaScript on Qollab cannot read project files. Press Stop when you are done playing.

**The Qiskit check, in Python:** `main.py` needs only Qiskit. It prints the safe-proof rates against theory and inspects one crate with live shots. Run it with `python main.py`, or on Qollab in a Python-only copy of the project (without `index.html` and `main.js`).

**The full game, locally:**

```
pip install -r requirements.txt   # qiskit, numpy, qiskit-aer
python generate_pools.py   # writes pools.json (ideal pools for Levels 1-3, noisy pools for Level 4)
python noise_study.py      # writes noise_results.json and prints the best N per noise level
python -m http.server      # then open http://localhost:8000
```

Opening `index.html` straight from disk will not work: the browser blocks `fetch("pools.json")` on `file://`. The same files also work on GitHub Pages, where `web.js` starts the game.

## Files

```
├── README.md            project page
├── requirements.txt     dependencies: qiskit, numpy, qiskit-aer
├── LICENSE              MIT
├── index.html           game screens (Qollab uses it as the page body)
├── main.css             game styles, scoped under .trqbt
├── game.js              game logic: startGame(root, data loaders)
├── main.js              Qollab entry: gets the data from Python, starts the game
├── shipped_data.py      reads pools.json and noise_results.json for main.js
├── web.js               normal web page entry (local or GitHub Pages): fetches the JSON
├── main.py              Qiskit check: theory table plus one crate of live shots
├── bomb.py              basic_tester, zeno_tester, zeno_midcircuit, classify, noise helpers
├── generate_pools.py    runs the circuits, writes pools.json
├── noise_study.py       technical extension: best N under noise
├── pools.json           500 shots per pool (L live, D dud, B boom, U inconclusive)
└── noise_results.json   noise study output used by the project page chart
```

## Accessibility

Every result is announced in words through an `aria-live` region and shown as an icon plus text. Everything works by keyboard; the step slider is a native `<input type="range">` with a visible value. With `prefers-reduced-motion` the explosion is a static mark, and the explosion animation never flashes.

## Next steps

- Rerun the noise study on Qollab's IonQ noise models and compare the best N with this simple depolarizing model.
- Add a live mode that calls Qiskit from the browser, keeping the pools as a fallback and labelling which source each result came from.

## Credits

- A. C. Elitzur and L. Vaidman, "Quantum mechanical interaction-free measurements," *Foundations of Physics* 23, 987–997 (1993). The bomb tester idea is theirs.
- P. Kwiat, H. Weinfurter, T. Herzog, A. Zeilinger and M. A. Kasevich, "Interaction-free measurement," *Physical Review Letters* 74, 4763 (1995). First demonstration with real photons, and the Zeno version.
- P. G. Kwiat et al., "High-efficiency quantum interrogation measurements via the quantum Zeno effect," *Physical Review Letters* 83, 4725 (1999).
- Built with [Qiskit](https://www.ibm.com/quantum/qiskit) and [Qiskit Aer](https://github.com/Qiskit/qiskit-aer).
- Fonts: Big Shoulders Stencil Display, Atkinson Hyperlegible and JetBrains Mono (Google Fonts).
- AI help: the circuits and the game code were written with help from Claude (Anthropic).

This effort is supported by Qollab & IonQ
