const BLOCH_PLOTLY_CDN = "https://cdn.plot.ly/plotly-2.32.0.min.js";

const degToRad = (deg) => (deg * Math.PI) / 180;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const lerpArrays = (start, end, t) => start.map((value, index) => value + (end[index] - value) * t);

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

  const gridBlueprint = buildGridBlueprint();
  let conversionMode = false;

  const sphereTrace = buildSphereSurface();
  const gridTrace = buildGridTrace(gridBlueprint, conversionMode);
  const guideTrace = buildGuideTrace();
  const stateTrace = buildStateTrace({ x: [0], y: [0], z: [1] });

  const layout = {
    margin: { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: "#05060a",
    plot_bgcolor: "#05060a",
    scene: {
      aspectmode: "cube",
      bgcolor: "rgba(5,6,10,0)",
      camera: {
        up: { x: 0, y: 0, z: 1 },
        eye: { x: 1.6, y: 1.2, z: 0.9 }
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

  Plotly.newPlot(viewport, [sphereTrace, gridTrace, guideTrace, stateTrace], layout, config).then(() => {
    const updateUI = ({ transition = 150 } = {}) => {
      const thetaDeg = Number(thetaSlider.value);
      const phiDeg = Number(phiSlider.value);
      thetaOutput.textContent = `${thetaDeg.toFixed(0)}°`;
      phiOutput.textContent = `${phiDeg.toFixed(0)}°`;
      const state = computeState(thetaDeg, phiDeg, conversionMode);
      updateStateTrace(viewport, state, transition);
      updateAmplitudePanel({ state, amplitudeZero, amplitudeOne, phiDeg, conversionMode, expressionLabel });
    };

    thetaSlider.addEventListener("input", () => {
      updateUI();
    });
    phiSlider.addEventListener("input", () => {
      updateUI();
    });

    conversionToggle.addEventListener("click", () => {
      conversionMode = !conversionMode;
      conversionToggle.setAttribute("aria-pressed", String(conversionMode));
      conversionToggle.textContent = conversionMode ? "Conversion: θ mode" : "Conversion: θ/2 mode";
      if (expressionLabel) {
        expressionLabel.textContent = conversionMode
          ? "|ψ⟩ = cos(θ)|0⟩ + e^{iφ} sin(θ)|1⟩"
          : "|ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩";
      }
      animateGrid(viewport, gridBlueprint, conversionMode, 700);
      updateUI({ transition: 700 });
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

const mapGrid = (blueprint, conversion) => {
  const x = [];
  const y = [];
  const z = [];
  const colors = [];
  blueprint.forEach((node) => {
    const point = computeState(node.theta, node.phi, conversion);
    x.push(point.x);
    y.push(point.y);
    z.push(point.z);
    const hue = node.phi;
    colors.push(hslToHex(hue, 55, conversion ? 52 : 42));
  });
  return { x, y, z, colors };
};

const computeState = (thetaDeg, phiDeg, conversion) => {
  const thetaRad = degToRad(thetaDeg);
  const amplitudeTheta = conversion ? thetaRad : thetaRad / 2;
  const cosTerm = Math.cos(amplitudeTheta);
  const sinTerm = Math.sin(amplitudeTheta);
  const phiRad = degToRad(phiDeg);
  const betaReal = sinTerm * Math.cos(phiRad);
  const betaImag = sinTerm * Math.sin(phiRad);
  const x = 2 * cosTerm * betaReal;
  const y = 2 * cosTerm * betaImag;
  const z = cosTerm * cosTerm - (sinTerm * sinTerm);
  return {
    x,
    y,
    z,
    amplitudes: {
      alpha: cosTerm,
      betaMagnitude: sinTerm,
      betaPhase: phiDeg,
    },
    color: hslToHex(((phiDeg % 360) + 360) % 360, 70, conversion ? 68 : 60),
  };
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

const updateStateTrace = (viewport, state, duration = 150) => {
  animateTrace({
    viewport,
    traceIndex: 3,
    target: { x: [state.x], y: [state.y], z: [state.z], color: state.color },
    duration,
  });
};

const updateAmplitudePanel = ({ state, amplitudeZero, amplitudeOne, phiDeg, conversionMode, expressionLabel }) => {
  if (!amplitudeZero || !amplitudeOne) return;
  amplitudeZero.textContent = state.amplitudes.alpha.toFixed(3);
  const magnitude = state.amplitudes.betaMagnitude.toFixed(3);
  const phase = ((phiDeg % 360) + 360) % 360;
  amplitudeOne.textContent = `${magnitude}}`;
  if (expressionLabel) {
    expressionLabel.textContent = conversionMode
      ? "|ψ⟩ = cos(θ)|0⟩ + e^{iφ} sin(θ)|1⟩"
      : "|ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩";
  }
};
