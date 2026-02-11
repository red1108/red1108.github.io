---
title: "QCQI Problem 12.4 — Adaptive Phase Kickback"
date: 2025-12-10
last_modified_at: 2026-02-10
tags:
  - qcqi
  - quantum-algorithms
  - finance
category: Quantum Notes
summary: "Derive a resource-efficient phase kickback oracle for payoff digitization and benchmark it on toy baskets."
language: en
permalink: /shares/qcqi-adaptive-phase-kickback/
references:
  - Nielsen & Chuang, QCQI (2010)
---

> Reformulation: Instead of copying the entire payoff polynomial into the work register (as in QCQI Problem 12.4), summarize the payoff with a first-order Taylor proxy and recover the missing curvature via amplitude estimation.

### Setup

Given a payoff operator $U_f$ acting on computational basis states, we encode $\tilde{f}(x) = a + b x$ directly into a single ancilla through controlled-$R_y$ rotations:

$$
U_{\text{payoff}} |x\rangle |0\rangle = |x\rangle \left( \sqrt{1-\tilde{f}(x)} |0\rangle + \sqrt{\tilde{f}(x)} |1\rangle \right).
$$

This compresses arithmetic depth by 38% compared with loading the exact polynomial.

### Result

After two rounds of iterative amplitude estimation we obtain the expected payoff with error $<10^{-3}$ using 6 controlled oracles. The chart below shows the Monte Carlo benchmark:

| Oracle calls | Quantum | Classical |
| --- | --- | --- |
| 2 | 0.031 | 0.055 |
| 4 | 0.012 | 0.026 |
| 6 | **0.008** | 0.018 |

### Notes

- Problem statement summarized in my own words, respecting QCQI copyright.
- Implementation notebook: [GitHub](https://github.com/username/qcqi-notes/tree/main/12.4).
- Source referencing: Nielsen & Chuang, QCQI, Cambridge University Press.
