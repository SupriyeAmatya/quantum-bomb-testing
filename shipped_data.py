"""Hands the shipped data files to the game on Qollab.

JavaScript on Qollab can't read project files, so main.js calls these functions.
The file names stay plain string literals so Qollab ships the files with the project.
"""


def load_pools():
    with open("pools.json", encoding="utf-8") as f:
        return f.read()


def load_noise():
    with open("noise_results.json", encoding="utf-8") as f:
        return f.read()
