async function renderQuantChart() {
  const target = document.getElementById("quant-dynamic-chart");
  if (!target) return;
  try {
    const response = await fetch("/assets/quant/returns.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Unable to load returns.json");
    const series = await response.json();
    if (target.firstElementChild && target.firstElementChild.tagName === "IMG") {
      target.innerHTML = "";
    }
    const trades = series.map((row) => row.trade);
    const cumulative = series.map((row) => row.cumulative_pct);
    const customData = series.map((row) => [
      new Date(row.timestamp).toLocaleString(),
      row.symbol,
      row.roi_pct
    ]);
    const trace = {
      x: trades,
      y: cumulative,
      type: "scatter",
      mode: "lines",
      line: { color: "#ff6f3c", width: 3 },
      fill: "tozeroy",
      name: "Cumulative ROI",
      customdata: customData,
      hovertemplate:
        "Trade %{x}<br>%{customdata[0]}<br>" +
        "%{customdata[1]} ROI: %{customdata[2]:.3f}%<extra></extra>"
    };
    const layout = {
      margin: { l: 50, r: 20, t: 30, b: 50 },
      yaxis: { title: "Cumulative ROI (%)", tickformat: ".1f" },
      xaxis: { title: "Trade #" },
      paper_bgcolor: "#05060a",
      plot_bgcolor: "#05060a",
      font: { color: "#f5f5f5" }
    };
    Plotly.newPlot(target, [trace], layout, { responsive: true, displayModeBar: false });
  } catch (error) {
    if (target.dataset.placeholder) {
      target.innerHTML = `<img src="${target.dataset.placeholder}" alt="Cumulative ROI fallback" />`;
    }
    target.insertAdjacentHTML("beforeend", `<p class="quant-error">${error.message}</p>`);
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
