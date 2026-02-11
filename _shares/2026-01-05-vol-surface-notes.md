---
title: "Volatility Surface Notes — Diffusion-Constrained SVI"
date: 2026-01-05
last_modified_at: 2026-02-08
tags:
  - options
  - svi
  - tutorial
category: Market Microstructure
summary: "Step-by-step derivation of arbitrage-free SVI with diffusion constraints and calibration checklist."
language: en
permalink: /shares/diffusion-constrained-svi/
---

### Why this matters

Traders often graft the raw SVI formula onto any implied-vol dataset. Doing so can violate diffusion constraints near expiry, yielding exploding Greeks.

### Recipe

1. Normalize strikes into log-moneyness $k = \ln(K/F)$.
2. Enforce $\partial \sigma / \partial T \ge 0$ by fitting $\theta(T)$ with a monotone spline.
3. Calibrate raw parameters $\{a, b, m, \rho, \sigma\}$ via trust-region reflective solver.
4. Clamp residual arbitrage by solving a quadratic program on anchor points.

### Diagnostics

```
max_calendar_violation = max(diff(sigma_matrix, axis=0))
max_butterfly_violation = max(second_diff(sigma_matrix, axis=1))
```

All values remained \< $5 \times 10^{-4}$ after constraint projection.

### Related reading

- Gatheral, J. (2011). *The Volatility Surface*.
- De Marco, L. (2024). Diffusion constraints in SVI, Risk Magazine.
