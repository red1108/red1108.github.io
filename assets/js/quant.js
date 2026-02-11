const clearChartContainer = (node) => {
  if (!node) return;
  node.innerHTML = "";
};

const computeRoiDensity = (values) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const n = values.length;
  const mean = values.reduce((acc, value) => acc + value, 0) / n;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance) || 0.01;
  const bandwidth = Math.max(0.01, 1.06 * stdDev * Math.pow(n, -0.2));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(bandwidth * 3, (max - min) * 0.05 || bandwidth);
  const start = min - padding;
  const end = max + padding;
  const points = Math.min(Math.max(n * 5, 180), 600);
  const step = (end - start) / (points - 1 || 1);
  const x = [];
  const y = [];
  const normalizer = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));
  for (let i = 0; i < points; i += 1) {
    const xi = start + step * i;
    let sum = 0;
    for (let j = 0; j < n; j += 1) {
      const z = (xi - values[j]) / bandwidth;
      sum += Math.exp(-0.5 * z * z);
    }
    x.push(xi);
    y.push(sum * normalizer);
  }
  return { x, y, range: [start, end] };
};

async function renderQuantChart() {
  const target = document.getElementById("quant-dynamic-chart");
  const histogramTarget = document.getElementById("quant-roi-hist");
  if (!target) return;
  try {
    const response = await fetch("/assets/quant/returns.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Unable to load returns.json");
    const series = await response.json();
    clearChartContainer(target);
    const trades = series.map((row) => row.trade);
    const cumulative = series.map((row) => row.cumulative_pct);
    const roiPct = series.map((row) => row.roi_pct);
    const chartBackground = "#05060a";
    const trace = {
      x: trades,
      y: cumulative,
      type: "scatter",
      mode: "lines",
      line: { color: "#ff6f3c", width: 3 },
      fill: "tozeroy",
      name: "Cumulative ROI",
      customdata: roiPct,
      hovertemplate:
        "Trade %{x}<br>ROI %{customdata:.3f}%<extra></extra>"
    };
    const layout = {
      margin: { l: 50, r: 20, t: 30, b: 50 },
      yaxis: { title: "Cumulative ROI (%)", tickformat: ".1f" },
      xaxis: { title: "Trade #" },
      paper_bgcolor: chartBackground,
      plot_bgcolor: chartBackground,
      font: { color: "#f5f5f5" }
    };
    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot(target, [trace], layout, config);

    if (histogramTarget && roiPct.length > 0) {
      const density = computeRoiDensity(roiPct);
      if (density) {
        clearChartContainer(histogramTarget);
        const densityTrace = {
          x: density.x,
          y: density.y,
          type: "scatter",
          mode: "lines",
          line: { color: "#4db7ff", width: 3 },
          fill: "tozeroy",
          name: "ROI Density",
          hovertemplate: "ROI %{x:.3f}%<br>Density %{y:.4f}<extra></extra>"
        };
        const densityLayout = {
          margin: { l: 60, r: 20, t: 40, b: 55 },
          xaxis: {
            title: "ROI (%)",
            tickformat: ".2f",
            range: density.range
          },
          yaxis: { title: "Density" },
          paper_bgcolor: chartBackground,
          plot_bgcolor: chartBackground,
          font: { color: "#f5f5f5" }
        };
        Plotly.newPlot(histogramTarget, [densityTrace], densityLayout, config);
      }
    }
  } catch (error) {
    clearChartContainer(target);
    target.insertAdjacentHTML("beforeend", `<p class="quant-error">${error.message}</p>`);
    if (histogramTarget) {
      clearChartContainer(histogramTarget);
      histogramTarget.insertAdjacentHTML("beforeend", `<p class="quant-error">${error.message}</p>`);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof Plotly === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.plot.ly/plotly-2.32.0.min.js";
    script.defer = true;
    script.onload = renderQuantChart;
    document.body.appendChild(script);
  } else {
    renderQuantChart();
  }
});
