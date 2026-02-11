async function renderQuantChart() {
  const target = document.getElementById("quant-dynamic-chart");
  if (!target) return;
  try {
    const response = await fetch("/assets/quant/returns.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Unable to load returns.json");
    const series = await response.json();
    const dates = series.map((row) => row.date);
    const values = series.map((row) => row.cumulative);
    const trace = {
      x: dates,
      y: values,
      type: "scatter",
      mode: "lines",
      line: { color: "#ff6f3c", width: 3 },
      fill: "tozeroy",
      name: "Cumulative Return"
    };
    const layout = {
      margin: { l: 40, r: 20, t: 20, b: 40 },
      yaxis: { tickformat: ",.0%" },
      xaxis: { title: "Date" },
      paper_bgcolor: "#0f0f0f",
      plot_bgcolor: "#0f0f0f",
      font: { color: "#fefefe" }
    };
    Plotly.newPlot(target, [trace], layout, { responsive: true, displayModeBar: false });
  } catch (error) {
    target.innerHTML = `<p class="quant-error">${error.message}</p>`;
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
