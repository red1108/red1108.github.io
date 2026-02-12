const BLOCH_PLOTLY_CDN = "https://cdn.plot.ly/plotly-2.32.0.min.js";

const degToRad = (deg) => (deg * Math.PI) / 180;
const radToDeg = (rad) => (rad * 180) / Math.PI;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const lerpArrays = (start, end, t) => start.map((value, index) => value + (end[index] - value) * t);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeVector = (vec) => {
  const mag = Math.hypot(vec[0], vec[1], vec[2]) || 1;
  return [vec[0] / mag, vec[1] / mag, vec[2] / mag];
};

const complex = (re, im = 0) => ({ re, im });

const complexAdd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });

const complexMul = (a, b) => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

const complexScale = (value, scalar) => ({ re: value.re * scalar, im: value.im * scalar });

const complexConjugate = (value) => ({ re: value.re, im: -value.im });

const complexMagnitude = (value) => Math.hypot(value.re, value.im);

const normalizeStateVector = (state) => {
  const alphaMag = complexMagnitude(state.alpha);
  const betaMag = complexMagnitude(state.beta);
  const norm = Math.hypot(alphaMag, betaMag) || 1;
  return {
    alpha: complexScale(state.alpha, 1 / norm),
    beta: complexScale(state.beta, 1 / norm),
  };
};

const amplitudeThetaFromSlider = (thetaDeg, conversion) =>
  conversion ? degToRad(thetaDeg) : degToRad(thetaDeg) / 2;

const stateFromAngles = (thetaDeg, phiDeg, conversion) => {
  const amplitudeTheta = amplitudeThetaFromSlider(thetaDeg, conversion);
  const alpha = complex(Math.cos(amplitudeTheta), 0);
  const betaMagnitude = Math.sin(amplitudeTheta);
  const phiRad = degToRad(phiDeg);
  const beta = complex(betaMagnitude * Math.cos(phiRad), betaMagnitude * Math.sin(phiRad));
  return normalizeStateVector({ alpha, beta });
};

const wrapDegrees = (deg) => ((deg % 360) + 360) % 360;

const formatThetaForSlider = (value) => clamp(Math.round(value), 0, 180);
const formatPhiForSlider = (value) => Math.round(wrapDegrees(value));

const stateToAngles = (state) => {
  const point = blochPointFromState(state);
  const theta = radToDeg(Math.acos(clamp(point.z, -1, 1)));
  const phi = wrapDegrees(radToDeg(Math.atan2(point.y, point.x || 0)));
  return { theta, phi };
};

const blochPointFromState = (state) => {
  const alpha = state.alpha;
  const beta = state.beta;
  const alphaBetaConj = complexMul(alpha, complexConjugate(beta));
  const x = 2 * alphaBetaConj.re;
  const y = 2 * alphaBetaConj.im;
  const alphaMag2 = complexMagnitude(alpha) ** 2;
  const betaMag2 = complexMagnitude(beta) ** 2;
  const z = alphaMag2 - betaMag2;
  return { x, y, z };
};

const applyGateMatrix = (state, matrix) => normalizeStateVector({
  alpha: complexAdd(
    complexMul(matrix[0][0], state.alpha),
    complexMul(matrix[0][1], state.beta)
  ),
  beta: complexAdd(
    complexMul(matrix[1][0], state.alpha),
    complexMul(matrix[1][1], state.beta)
  ),
});

const SQRT_HALF = 1 / Math.sqrt(2);

const GATE_MATRICES = {
  X: [
    [complex(0, 0), complex(1, 0)],
    [complex(1, 0), complex(0, 0)],
  ],
  Y: [
    [complex(0, 0), complex(0, -1)],
    [complex(0, 1), complex(0, 0)],
  ],
  Z: [
    [complex(1, 0), complex(0, 0)],
    [complex(0, 0), complex(-1, 0)],
  ],
  H: [
    [complex(SQRT_HALF, 0), complex(SQRT_HALF, 0)],
    [complex(SQRT_HALF, 0), complex(-SQRT_HALF, 0)],
  ],
  S: [
    [complex(1, 0), complex(0, 0)],
    [complex(0, 0), complex(0, 1)],
  ],
  T: [
    [complex(1, 0), complex(0, 0)],
    [complex(0, 0), complex(SQRT_HALF, SQRT_HALF)],
  ],
};

const getTraceData = (viewport, index) => {
  const trace = viewport.data?.[index];
  if (!trace) return null;
  return {
    x: Array.isArray(trace.x) ? trace.x.slice() : [],
    y: Array.isArray(trace.y) ? trace.y.slice() : [],
    z: Array.isArray(trace.z) ? trace.z.slice() : [],
    color: trace.marker?.color,
  };
};

const animateTrace = ({ viewport, traceIndex, target, duration = 600 }) => {
  if (!viewport) return;
  viewport.__blochAnimations = viewport.__blochAnimations || {};
  const store = viewport.__blochAnimations;
  if (store[traceIndex]) {
    cancelAnimationFrame(store[traceIndex]);
  }
  const start = getTraceData(viewport, traceIndex);
  if (!start) return;
  const startTime = performance.now();
  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = easeInOutCubic(progress);
    const currentX = lerpArrays(start.x, target.x, eased);
    const currentY = lerpArrays(start.y, target.y, eased);
    const currentZ = lerpArrays(start.z, target.z, eased);
    const restylePayload = {
      x: [currentX],
      y: [currentY],
      z: [currentZ],
    };
    if (target.color) {
      restylePayload["marker.color"] = [[target.color]];
    }
    Plotly.restyle(viewport, restylePayload, [traceIndex]);
    if (progress < 1) {
      store[traceIndex] = requestAnimationFrame(step);
    }
  };
  store[traceIndex] = requestAnimationFrame(step);
};

const sampleGreatCircle = (startVec, endVec, steps = 24) => {
  const start = normalizeVector(startVec);
  const end = normalizeVector(endVec);
  const dot = clamp(start[0] * end[0] + start[1] * end[1] + start[2] * end[2], -1, 1);
  const x = [];
  const y = [];
  const z = [];

  if (dot < -0.9995) {
    const ref = Math.abs(start[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const axis = normalizeVector([
      start[1] * ref[2] - start[2] * ref[1],
      start[2] * ref[0] - start[0] * ref[2],
      start[0] * ref[1] - start[1] * ref[0],
    ]);
    for (let i = 0; i <= steps; i += 1) {
      const angle = Math.PI * (i / steps);
      const cosAngle = Math.cos(angle);
      const sinAngle = Math.sin(angle);
      const axisDotStart = axis[0] * start[0] + axis[1] * start[1] + axis[2] * start[2];
      const cross = [
        axis[1] * start[2] - axis[2] * start[1],
        axis[2] * start[0] - axis[0] * start[2],
        axis[0] * start[1] - axis[1] * start[0],
      ];
      const rotated = [
        start[0] * cosAngle + cross[0] * sinAngle + axis[0] * axisDotStart * (1 - cosAngle),
        start[1] * cosAngle + cross[1] * sinAngle + axis[1] * axisDotStart * (1 - cosAngle),
        start[2] * cosAngle + cross[2] * sinAngle + axis[2] * axisDotStart * (1 - cosAngle),
      ];
      x.push(rotated[0]);
      y.push(rotated[1]);
      z.push(rotated[2]);
    }
    return { x, y, z };
  }

  if (dot > 0.9995) {
    x.push(start[0], end[0]);
    y.push(start[1], end[1]);
    z.push(start[2], end[2]);
    return { x, y, z };
  }

  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const scale0 = Math.sin((1 - t) * omega) / sinOmega;
    const scale1 = Math.sin(t * omega) / sinOmega;
    const point = [
      scale0 * start[0] + scale1 * end[0],
      scale0 * start[1] + scale1 * end[1],
      scale0 * start[2] + scale1 * end[2],
    ];
    const normalized = normalizeVector(point);
    x.push(normalized[0]);
    y.push(normalized[1]);
    z.push(normalized[2]);
  }
  return { x, y, z };
};

const hslToHex = (h, s, l) => {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const loadPlotlyIfNeeded = (callback) => {
  if (typeof Plotly !== "undefined") {
    callback();
    return;
  }
  const script = document.createElement("script");
  script.src = BLOCH_PLOTLY_CDN;
  script.defer = true;
  script.onload = callback;
  document.body.appendChild(script);
};

document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.getElementById("bloch-viewport");
  if (!viewport) return;
  loadPlotlyIfNeeded(initBlochVisualizer);
});

function initBlochVisualizer() {
  const viewport = document.getElementById("bloch-viewport");
  if (!viewport) return;

  const thetaSlider = document.getElementById("theta-slider");
  const phiSlider = document.getElementById("phi-slider");
  const thetaOutput = document.getElementById("theta-output");
  const phiOutput = document.getElementById("phi-output");
  const conversionToggle = document.getElementById("conversion-toggle");
  const amplitudeZero = document.getElementById("amplitude-zero");
  const amplitudeOne = document.getElementById("amplitude-one");
  const expressionLabel = document.getElementById("bloch-state-expression");
  const resetTrajectoryButton = document.getElementById("reset-trajectory");
  const trajectoryCountLabel = document.getElementById("trajectory-count");
  const gateButtons = document.querySelectorAll("[data-gate]");

  const gridBlueprint = buildGridBlueprint();
  const trajectory = [];
  let conversionMode = false;
  let currentState = stateFromAngles(Number(thetaSlider.value), Number(phiSlider.value), conversionMode);
  let currentPoint = blochPointFromState(currentState);

  const sphereTrace = buildSphereSurface();
  const gridTrace = buildGridTrace(gridBlueprint, conversionMode);
  const guideTrace = buildGuideTrace();
  const stateTrace = buildStateTrace({ x: [currentPoint.x], y: [currentPoint.y], z: [currentPoint.z] });
  const trajectoryTrace = buildTrajectoryTrace();

  const layout = {
    margin: { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: "#05060a",
    plot_bgcolor: "#05060a",
    scene: {
      aspectmode: "cube",
      bgcolor: "rgba(5,6,10,0)",
      camera: {
        up: { x: 0, y: 0, z: 1 },
        eye: { x: 1.05, y: 0.8, z: 0.6 }
      },
      xaxis: axisDefinition(),
      yaxis: axisDefinition(),
      zaxis: axisDefinition({ title: "" })
    },
    showlegend: false,
  };

  const config = {
    responsive: true,
    displayModeBar: false,
    scrollZoom: true,
  };

  Plotly.newPlot(viewport, [sphereTrace, gridTrace, guideTrace, stateTrace, trajectoryTrace], layout, config).then(() => {
    const updateTrajectoryTrace = () => {
      const coords = buildTrajectoryCoordinates(trajectory);
      Plotly.restyle(viewport, {
        x: [coords.x],
        y: [coords.y],
        z: [coords.z],
      }, [4]);
      if (trajectoryCountLabel) {
        trajectoryCountLabel.textContent = trajectory.length.toString();
      }
    };

    const resetTrajectory = (point) => {
      trajectory.length = 0;
      trajectory.push({ ...point });
      updateTrajectoryTrace();
    };

    const appendTrajectory = (point) => {
      const last = trajectory[trajectory.length - 1];
      if (
        last &&
        Math.abs(last.x - point.x) < 1e-4 &&
        Math.abs(last.y - point.y) < 1e-4 &&
        Math.abs(last.z - point.z) < 1e-4
      ) {
        return;
      }
      trajectory.push({ ...point });
      updateTrajectoryTrace();
    };

    resetTrajectory(currentPoint);

    const updateUI = ({ animateState = false, duration = 150, stateOverride = null } = {}) => {
      const thetaDeg = Number(thetaSlider.value);
      const phiDeg = Number(phiSlider.value);
      thetaOutput.textContent = `${thetaDeg.toFixed(0)}°`;
      phiOutput.textContent = `${phiDeg.toFixed(0)}°`;
      const nextState = stateOverride || stateFromAngles(thetaDeg, phiDeg, conversionMode);
      const nextPoint = blochPointFromState(nextState);
      updateStateTrace(viewport, nextPoint, { animate: animateState, duration, from: animateState ? currentPoint : null });
      currentState = nextState;
      currentPoint = nextPoint;
      updateAmplitudePanel({ state: currentState, amplitudeZero, amplitudeOne });
    };

    thetaSlider.addEventListener("input", () => {
      updateUI();
    });
    phiSlider.addEventListener("input", () => {
      updateUI();
    });

    const snapshot = () => {
      appendTrajectory(currentPoint);
    };

    thetaSlider.addEventListener("change", snapshot);
    phiSlider.addEventListener("change", snapshot);

    if (resetTrajectoryButton) {
      resetTrajectoryButton.addEventListener("click", () => {
        resetTrajectory(currentPoint);
      });
    }

    conversionToggle.addEventListener("click", () => {
      conversionMode = !conversionMode;
      conversionToggle.setAttribute("aria-pressed", String(conversionMode));
      conversionToggle.textContent = conversionMode ? "Conversion: θ mode" : "Conversion: θ/2 mode";
      if (expressionLabel) {
        expressionLabel.textContent = conversionMode
          ? "|ψ⟩ = cos(θ)|0⟩ + e^{iφ} sin(θ)|1⟩"
          : "|ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩";
      }
      const { theta, phi } = stateToAngles(currentState);
      thetaSlider.value = formatThetaForSlider(theta).toString();
      phiSlider.value = formatPhiForSlider(phi).toString();
      animateGrid(viewport, gridBlueprint, conversionMode, 700);
      updateUI({ animateState: true, duration: 700, stateOverride: currentState });
    });

    const handleGate = (gateKey) => {
      const matrix = GATE_MATRICES[gateKey];
      if (!matrix) return;
      const nextState = applyGateMatrix(currentState, matrix);
      const { theta, phi } = stateToAngles(nextState);
      thetaSlider.value = formatThetaForSlider(theta).toString();
      phiSlider.value = formatPhiForSlider(phi).toString();
      const duration = 800;
      updateUI({ animateState: true, duration, stateOverride: nextState });
      setTimeout(() => {
        appendTrajectory(currentPoint);
      }, duration + 20);
    };

    gateButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const gateKey = button.dataset.gate;
        handleGate(gateKey);
      });
    });

    updateUI();
  });
}

const axisDefinition = (overrides = {}) => ({
  title: "",
  range: [-1.2, 1.2],
  zeroline: false,
  showgrid: false,
  showbackground: false,
  tickvals: [],
  ...overrides,
});

const buildSphereSurface = () => {
  const thetaSteps = 40;
  const phiSteps = 40;
  const theta = [];
  const phi = [];
  for (let i = 0; i <= thetaSteps; i += 1) {
    theta.push((Math.PI * i) / thetaSteps);
  }
  for (let j = 0; j <= phiSteps; j += 1) {
    phi.push((2 * Math.PI * j) / phiSteps);
  }
  const x = [];
  const y = [];
  const z = [];
  theta.forEach((t) => {
    const rowX = [];
    const rowY = [];
    const rowZ = [];
    phi.forEach((p) => {
      rowX.push(Math.sin(t) * Math.cos(p));
      rowY.push(Math.sin(t) * Math.sin(p));
      rowZ.push(Math.cos(t));
    });
    x.push(rowX);
    y.push(rowY);
    z.push(rowZ);
  });
  return {
    type: "surface",
    x,
    y,
    z,
    opacity: 0.16,
    showscale: false,
    colorscale: [
      [0, "rgba(255,255,255,0.12)"],
      [1, "rgba(77,183,255,0.25)"]
    ],
  };
};

const buildGridBlueprint = () => {
  const blueprint = [];
  for (let theta = 10; theta <= 170; theta += 20) {
    for (let phi = 0; phi < 360; phi += 20) {
      blueprint.push({ theta, phi });
    }
  }
  return blueprint;
};

const buildGridTrace = (blueprint, conversion) => {
  const mapped = mapGrid(blueprint, conversion);
  return {
    type: "scatter3d",
    mode: "markers",
    x: mapped.x,
    y: mapped.y,
    z: mapped.z,
    marker: {
      size: 3.5,
      color: mapped.colors,
      line: { width: 0.2, color: "rgba(255,255,255,0.6)" },
    },
  };
};

const buildGuideTrace = () => {
  const axisPoints = {
    x: [-1, 1, null, 0, 0, null, 0, 0],
    y: [0, 0, null, -1, 1, null, 0, 0],
    z: [0, 0, null, 0, 0, null, -1, 1],
  };

  const equator = [];
  for (let phi = 0; phi <= 360; phi += 5) {
    equator.push({
      x: Math.cos(degToRad(phi)),
      y: Math.sin(degToRad(phi)),
      z: 0,
    });
  }

  const meridian = [];
  for (let theta = 0; theta <= 180; theta += 5) {
    meridian.push({
      x: Math.sin(degToRad(theta)),
      y: 0,
      z: Math.cos(degToRad(theta)),
    });
  }

  const guideX = [...axisPoints.x, null, ...equator.map((p) => p.x), null, ...meridian.map((p) => p.x)];
  const guideY = [...axisPoints.y, null, ...equator.map((p) => p.y), null, ...meridian.map((p) => p.y)];
  const guideZ = [...axisPoints.z, null, ...equator.map((p) => p.z), null, ...meridian.map((p) => p.z)];

  return {
    type: "scatter3d",
    mode: "lines",
    x: guideX,
    y: guideY,
    z: guideZ,
    line: { color: "rgba(255,255,255,0.18)", width: 2 },
  };
};

const buildStateTrace = (coords) => ({
  type: "scatter3d",
  mode: "markers",
  x: coords.x,
  y: coords.y,
  z: coords.z,
  marker: {
    size: 10,
    color: "#ff6f3c",
    line: { width: 2, color: "rgba(255,255,255,0.8)" },
    opacity: 1,
  },
});

const buildTrajectoryTrace = () => ({
  type: "scatter3d",
  mode: "lines",
  x: [],
  y: [],
  z: [],
  line: { color: "#ff6f3c", width: 4 },
  opacity: 0.85,
});

const pointFromAngles = (theta, phi, conversion) => {
  const state = stateFromAngles(theta, phi, conversion);
  return blochPointFromState(state);
};

const mapGrid = (blueprint, conversion) => {
  const x = [];
  const y = [];
  const z = [];
  const colors = [];
  blueprint.forEach((node) => {
    const point = pointFromAngles(node.theta, node.phi, conversion);
    x.push(point.x);
    y.push(point.y);
    z.push(point.z);
    const hue = node.phi;
    colors.push(hslToHex(hue, 55, conversion ? 52 : 42));
  });
  return { x, y, z, colors };
};

const buildTrajectoryCoordinates = (trajectory) => {
  if (trajectory.length < 2) {
    return { x: [], y: [], z: [] };
  }
  const x = [];
  const y = [];
  const z = [];
  for (let i = 1; i < trajectory.length; i += 1) {
    const startVec = [trajectory[i - 1].x, trajectory[i - 1].y, trajectory[i - 1].z];
    const endVec = [trajectory[i].x, trajectory[i].y, trajectory[i].z];
    const segment = sampleGreatCircle(startVec, endVec, 48);
    x.push(...segment.x, null);
    y.push(...segment.y, null);
    z.push(...segment.z, null);
  }
  if (x[x.length - 1] === null) x.pop();
  if (y[y.length - 1] === null) y.pop();
  if (z[z.length - 1] === null) z.pop();
  return { x, y, z };
};


const animateGrid = (viewport, blueprint, conversion, duration = 600) => {
  const mapped = mapGrid(blueprint, conversion);
  animateTrace({
    viewport,
    traceIndex: 1,
    target: { x: mapped.x, y: mapped.y, z: mapped.z },
    duration,
  });
  Plotly.restyle(viewport, { "marker.color": [mapped.colors] }, [1]);
};

const animateStateMarker = (viewport, fromPoint, toPoint, duration = 600) => {
  const path = sampleGreatCircle([fromPoint.x, fromPoint.y, fromPoint.z], [toPoint.x, toPoint.y, toPoint.z], 60);
  const frames = path.x.length;
  const start = performance.now();
  const step = (now) => {
    const progress = clamp((now - start) / duration, 0, 1);
    const index = Math.min(Math.floor(progress * (frames - 1)), frames - 1);
    Plotly.restyle(
      viewport,
      {
        x: [[path.x[index]]],
        y: [[path.y[index]]],
        z: [[path.z[index]]],
        "marker.color": [["#ff6f3c"]],
      },
      [3]
    );
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
};

const updateStateTrace = (viewport, point, { animate = false, duration = 150, from = null } = {}) => {
  if (animate && from) {
    animateStateMarker(viewport, from, point, duration);
    return;
  }
  Plotly.restyle(
    viewport,
    {
      x: [[point.x]],
      y: [[point.y]],
      z: [[point.z]],
      "marker.color": [["#ff6f3c"]],
    },
    [3]
  );
};

const updateAmplitudePanel = ({ state, amplitudeZero, amplitudeOne }) => {
  if (!amplitudeZero || !amplitudeOne || !state) return;
  const alphaMag = complexMagnitude(state.alpha);
  const betaMag = complexMagnitude(state.beta);
  const betaPhase = wrapDegrees(radToDeg(Math.atan2(state.beta.im, state.beta.re)));
  amplitudeZero.textContent = alphaMag.toFixed(3);
  amplitudeOne.textContent = `${betaMag.toFixed(3)} · e^{i${betaPhase.toFixed(0)}°}`;
};
