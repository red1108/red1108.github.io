const clearChartContainer = (node) => {
  if (!node) return;
  node.innerHTML = "";
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
      clearChartContainer(histogramTarget);
      const binSize = 0.02;
      const minRoi = Math.min(...roiPct);
      const maxRoi = Math.max(...roiPct);
      const start = Math.floor(minRoi / binSize) * binSize;
      const end = Math.ceil(maxRoi / binSize) * binSize;
      const histogramTrace = {
        x: roiPct,
        type: "histogram",
        autobinx: false,
        xbins: { start, end, size: binSize },
        marker: { color: "#4db7ff", opacity: 0.85 },
        hovertemplate: "ROI %{x:.3f}%<br>Trades %{y}<extra></extra>",
        name: "ROI Distribution"
      };
      const histogramLayout = {
        margin: { l: 60, r: 20, t: 40, b: 55 },
        bargap: 0.03,
        xaxis: {
          title: "ROI (%)",
          tickformat: ".2f",
          range: [start, end]
        },
        yaxis: { title: "Frequency" },
        paper_bgcolor: chartBackground,
        plot_bgcolor: chartBackground,
        font: { color: "#f5f5f5" }
      };
      Plotly.newPlot(histogramTarget, [histogramTrace], histogramLayout, config);
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
