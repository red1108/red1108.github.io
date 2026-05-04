---
layout: page
title: AutoVQE
permalink: /projects/autovqe/
description: A minimal harness for hardware-aware VQE under a fixed wall-clock budget.
eyebrow: Projects · Hardware-aware VQE
---

<div class="case-grid">
  <aside class="case-meta">
    <dl>
      <dt>Status</dt><dd>In progress · 2026</dd>
      <dt>Role</dt><dd>Sole author</dd>
      <dt>Methods</dt><dd>VQE · Qiskit · transpilation</dd>
      <dt>Budget</dt><dd><span class="mono">2^(n−2)</span> seconds</dd>
    </dl>
  </aside>

  <div class="case-content">
    <h2>Problem</h2>
    <p>VQE benchmarks are usually iteration-bound. That hides the real cost: gradient evaluation, transpilation, optimizer overhead, and hardware-noise stochasticity.</p>

    <h2>Contribution</h2>
    <p>A single-file research harness that fixes wall-clock budget per problem size, hands the experimenter one editable <span class="mono">train.py</span>, and logs every run as a row in <span class="mono">results.tsv</span>.</p>

    <div class="eq">
      $$ \min_{\boldsymbol{\theta}} \; \langle \psi(\boldsymbol{\theta}) | \hat{H} | \psi(\boldsymbol{\theta}) \rangle \quad \text{s.t.} \quad t_{\text{run}} \le 2^{n-2} \text{ s} $$
      <span class="caption">Eq. 1 — VQE under a fixed wall-clock budget.</span>
    </div>

    <h2>Status</h2>
    <p>Feature-complete on synthetic Hamiltonians; current work is on noise-aware extensions and agent-driven search loops.</p>
  </div>
</div>
