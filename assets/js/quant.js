const clearChartContainer = (node) => {
  if (!node) return;
  node.innerHTML = "";
};

const readCssVar = (name, fallback) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const withAlpha = (color, alpha) => {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const getQuantTheme = () => {
  const serif = readCssVar("--serif", "Georgia, serif");
  const sans = readCssVar("--sans", "system-ui, sans-serif");
  return {
    paper: readCssVar("--paper", "#f6f1e7"),
    paper2: readCssVar("--paper-2", "#efe7d6"),
    ink: readCssVar("--ink", "#1a1816"),
    ink2: readCssVar("--ink-2", "#3a3631"),
    ink3: readCssVar("--ink-3", "#6b655c"),
    rule: readCssVar("--rule", "#d6cab0"),
    serif,
    sans,
  };
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

const sortByTrade = (rows) => [...rows].sort((a, b) => a.trade - b.trade);

const computeStandardDeviation = (values, mean) => {
  if (!values.length) return 0;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const computeMetrics = (rows) => {
  const sorted = sortByTrade(rows);
  if (sorted.length === 0) {
    return [
      { label: "Total Trades", value: "0", note: "0.0-day window" },
      { label: "Cumulative Return", value: "0.00%", note: "Simple, non-compounded ROI" },
      { label: "Win Rate", value: "0.0%", note: "0 wins / 0 losses" },
      { label: "Profit Factor", value: "0.00", note: "Gross profit / gross loss" },
      { label: "Monthly Pace", value: "0.00%", note: "Mean trade ROI scaled by frequency" },
      { label: "Annualized Pace", value: "0.00%", note: "Mean trade ROI scaled by frequency" },
      { label: "Sharpe Ratio", value: "N/A", note: "Annualized risk-adjusted return" },
      { label: "Sortino Ratio", value: "N/A", note: "Annualized downside risk" },
      { label: "Max Drawdown", value: "0.00%", note: "Peak-to-trough decline" }
    ];
  }

  const roi = sorted.map((row) => row.roi);
  const totalTrades = sorted.length;
  const totalReturn = roi.reduce((acc, value) => acc + value, 0);
  const wins = roi.filter((value) => value > 0).length;
  const losses = totalTrades - wins;
  const timestamps = sorted.map((row) => new Date(row.timestamp));
  const start = timestamps[0];
  const end = timestamps[timestamps.length - 1];
  const totalSeconds = Math.max((end - start) / 1000, 60);
  const totalHours = totalSeconds / 3600;
  const minYears = 1 / (24 * 365);
  const totalYears = Math.max(totalHours / (24 * 365), minYears);
  const tradesPerYear = totalTrades / totalYears;
  const meanRoi = totalReturn / totalTrades;
  const stdRoi = totalTrades > 1 ? computeStandardDeviation(roi, meanRoi) : 0;
  const annualReturn = meanRoi * tradesPerYear;
  const monthlyReturn = annualReturn / 12;

  const positiveSum = roi.filter((value) => value > 0).reduce((acc, value) => acc + value, 0);
  const negativeValues = roi.filter((value) => value < 0);
  const negativeSum = negativeValues.reduce((acc, value) => acc + value, 0);
  const profitFactor = negativeSum !== 0 ? positiveSum / Math.abs(negativeSum) : Number.POSITIVE_INFINITY;
  const winRate = totalTrades ? wins / totalTrades : 0;

  const downsideMean = negativeValues.length ? negativeValues.reduce((acc, value) => acc + value, 0) / negativeValues.length : 0;
  const downsideStd = negativeValues.length ? computeStandardDeviation(negativeValues, downsideMean) : 0;
  const sharpe = stdRoi > 0 ? (meanRoi * Math.sqrt(tradesPerYear)) / stdRoi : Number.NaN;
  const sortino = downsideStd > 0 ? (meanRoi * Math.sqrt(tradesPerYear)) / downsideStd : Number.NaN;

  let runningCumulative = 0;
  let runningMax = -Infinity;
  let maxDrawdown = 0;
  roi.forEach((value) => {
    runningCumulative += value;
    runningMax = Math.max(runningMax, runningCumulative);
    const drawdown = runningCumulative - runningMax;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  const toPercent = (value, digits = 2) => `${(value * 100).toFixed(digits)}%`;

  return [
    { label: "Total Trades", value: totalTrades.toLocaleString("en-US"), note: `${(totalHours / 24).toFixed(1)}-day window` },
    { label: "Cumulative Return", value: toPercent(totalReturn), note: "Simple, non-compounded ROI" },
    { label: "Win Rate", value: toPercent(winRate, 1), note: `${wins} wins / ${losses} losses` },
    { label: "Profit Factor", value: Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞", note: "Gross profit / gross loss" },
    { label: "Monthly Pace", value: toPercent(monthlyReturn), note: "Mean trade ROI scaled by frequency" },
    { label: "Annualized Pace", value: toPercent(annualReturn), note: "Mean trade ROI scaled by frequency" },
    { label: "Sharpe Ratio", value: Number.isNaN(sharpe) ? "N/A" : sharpe.toFixed(2), note: "Annualized risk-adjusted return" },
    { label: "Sortino Ratio", value: Number.isNaN(sortino) ? "N/A" : sortino.toFixed(2), note: "Annualized downside risk" },
    { label: "Max Drawdown", value: toPercent(maxDrawdown), note: "Peak-to-trough decline" }
  ];
};

const renderMetricGrid = (container, metrics) => {
  if (!container || !Array.isArray(metrics)) return;
  container.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric-card">
          <p class="metric-label">${metric.label}</p>
          <p class="metric-value">${metric.value}</p>
          ${metric.note ? `<p class="metric-note">${metric.note}</p>` : ""}
        </article>
      `
    )
    .join("");
};

const filterSeriesByTradeRange = (rows, minTrade, maxTrade) =>
  rows.filter((row) => row.trade >= minTrade && row.trade <= maxTrade);

const extractRangeFromEvent = (eventData) => {
  if (!eventData) return null;
  const rawMin = eventData["xaxis.range[0]"];
  const rawMax = eventData["xaxis.range[1]"];
  if (typeof rawMin === "undefined" || typeof rawMax === "undefined") {
    return null;
  }
  const min = Number(rawMin);
  const max = Number(rawMax);
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return null;
  }
  return [min, max];
};

async function renderQuantChart() {
  const target = document.getElementById("quant-dynamic-chart");
  const histogramTarget = document.getElementById("quant-roi-hist");
  const metricGrid = document.querySelector(".metric-grid");
  const metricHeading = document.getElementById("strategy-performance-heading");
  const zoomHint = document.getElementById("quant-zoom-hint");
  if (!target) return;
  try {
    const response = await fetch("/assets/quant/returns.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Unable to load returns.json");
    const rawSeries = await response.json();
    const series = sortByTrade(Array.isArray(rawSeries) ? rawSeries : []);
    if (!series.length) throw new Error("No returns data available");

    const theme = getQuantTheme();
    const trades = series.map((row) => row.trade);
    const cumulative = series.map((row) => row.cumulative_pct);
    const roiPct = series.map((row) => row.roi_pct);
    const trace = {
      x: trades,
      y: cumulative,
      type: "scatter",
      mode: "lines",
      line: { color: theme.ink, width: 1.6 },
      fillcolor: withAlpha(theme.ink, 0.06),
      fill: "tozeroy",
      name: "Simple cumulative ROI",
      customdata: roiPct,
      hovertemplate: "Trade %{x}<br>ROI %{customdata:.3f}%<extra></extra>"
    };
    const layout = {
      margin: { l: 54, r: 18, t: 20, b: 48 },
      yaxis: {
        title: "Cumulative ROI (%)",
        tickformat: ".1f",
        fixedrange: true,
        gridcolor: theme.rule,
        zerolinecolor: theme.rule,
        linecolor: theme.rule,
        tickfont: { family: theme.sans, color: theme.ink3 }
      },
      xaxis: {
        title: "Trade #",
        gridcolor: theme.rule,
        zerolinecolor: theme.rule,
        linecolor: theme.rule,
        tickfont: { family: theme.sans, color: theme.ink3 }
      },
      dragmode: "zoom",
      paper_bgcolor: theme.paper,
      plot_bgcolor: theme.paper,
      font: { color: theme.ink2, family: theme.serif },
      hoverlabel: {
        bgcolor: theme.paper2,
        bordercolor: theme.rule,
        font: { color: theme.ink, family: theme.sans }
      }
    };
    const config = { responsive: true, displayModeBar: false, doubleClick: "reset" };

    const fullMetrics = computeMetrics(series);
    renderMetricGrid(metricGrid, fullMetrics);

    const defaultHeadingText = metricHeading?.textContent?.trim() || "Strategy Performance";
    const updateHeading = (selected) => {
      if (!metricHeading) return;
      metricHeading.textContent = selected
        ? `${defaultHeadingText} (Selected Period)`
        : defaultHeadingText;
    };
    const updateZoomHint = (selected) => {
      if (!zoomHint) return;
      zoomHint.hidden = !selected;
    };
    updateHeading(false);
    updateZoomHint(false);

    const histogramState = { initialized: false };
    const histogramConfig = { responsive: true, displayModeBar: false };
    const histogramLayoutBase = {
      margin: { l: 54, r: 18, t: 20, b: 48 },
      xaxis: {
        title: "ROI (%)",
        tickformat: ".2f",
        gridcolor: theme.rule,
        zerolinecolor: theme.rule,
        linecolor: theme.rule,
        tickfont: { family: theme.sans, color: theme.ink3 }
      },
      yaxis: {
        title: "Density",
        gridcolor: theme.rule,
        zerolinecolor: theme.rule,
        linecolor: theme.rule,
        tickfont: { family: theme.sans, color: theme.ink3 }
      },
      paper_bgcolor: theme.paper,
      plot_bgcolor: theme.paper,
      font: { color: theme.ink2, family: theme.serif },
      hoverlabel: {
        bgcolor: theme.paper2,
        bordercolor: theme.rule,
        font: { color: theme.ink, family: theme.sans }
      }
    };

    const updateHistogram = (rows) => {
      if (!histogramTarget) return;
      const roiValues = rows.map((row) => row.roi_pct);
      if (!roiValues.length) {
        Plotly.purge(histogramTarget);
        histogramState.initialized = false;
        clearChartContainer(histogramTarget);
        histogramTarget.insertAdjacentHTML("beforeend", '<p class="quant-error">No data in the selected range.</p>');
        return;
      }
      const density = computeRoiDensity(roiValues);
      if (!density) return;
      const densityTrace = {
        x: density.x,
        y: density.y,
        type: "scatter",
        mode: "lines",
        line: { color: theme.ink2, width: 1.4 },
        fillcolor: withAlpha(theme.ink2, 0.05),
        fill: "tozeroy",
        name: "ROI distribution per each trade",
        hovertemplate: "ROI %{x:.3f}%<br>Density %{y:.4f}<extra></extra>"
      };
      const densityLayout = {
        ...histogramLayoutBase,
        xaxis: { ...histogramLayoutBase.xaxis, range: density.range }
      };
      if (!histogramState.initialized) {
        clearChartContainer(histogramTarget);
        Plotly.newPlot(histogramTarget, [densityTrace], densityLayout, histogramConfig);
        histogramState.initialized = true;
      } else {
        Plotly.react(histogramTarget, [densityTrace], densityLayout, histogramConfig);
      }
    };

    updateHistogram(series);

    const fullBounds = {
      min: series[0].trade,
      max: series[series.length - 1].trade
    };

    const resetRange = () => {
      renderMetricGrid(metricGrid, fullMetrics);
      updateHistogram(series);
      updateHeading(false);
      updateZoomHint(false);
    };

    const applyRange = (startValue, endValue) => {
      let min = Math.min(startValue, endValue);
      let max = Math.max(startValue, endValue);
      min = Math.max(fullBounds.min, Math.floor(min));
      max = Math.min(fullBounds.max, Math.ceil(max));
      if (min > max) {
        resetRange();
        return;
      }
      const filtered = filterSeriesByTradeRange(series, min, max);
      if (!filtered.length) {
        resetRange();
        return;
      }
      const selectedSubset = min > fullBounds.min || max < fullBounds.max;
      renderMetricGrid(metricGrid, computeMetrics(filtered));
      updateHistogram(filtered);
      updateHeading(selectedSubset);
      updateZoomHint(selectedSubset);
    };

    clearChartContainer(target);
    await Plotly.newPlot(target, [trace], layout, config);

    target.on("plotly_relayout", (eventData) => {
      if (eventData && eventData["xaxis.autorange"]) {
        resetRange();
        return;
      }
      const range = extractRangeFromEvent(eventData);
      if (!range) return;
      applyRange(range[0], range[1]);
    });

    target.on("plotly_doubleclick", () => {
      resetRange();
    });
  } catch (error) {
    clearChartContainer(target);
    target.insertAdjacentHTML("beforeend", `<p class="quant-error">${error.message}</p>`);
    if (histogramTarget) {
      clearChartContainer(histogramTarget);
      histogramTarget.insertAdjacentHTML("beforeend", `<p class="quant-error">${error.message}</p>`);
    }
    if (metricGrid) {
      metricGrid.innerHTML = `<p class="quant-error">${error.message}</p>`;
    }
    if (zoomHint) {
      zoomHint.hidden = true;
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
