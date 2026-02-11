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
      { label: "총 거래 횟수", value: "0", note: "기간 0.0일" },
      { label: "누적 수익률", value: "0.00%", note: "단리 기준" },
      { label: "승률", value: "0.0%", note: "승 0 / 패 0" },
      { label: "손익비", value: "0.00", note: "총이익 / 총손실" },
      { label: "월 수익률", value: "0.00%", note: "거래 간격 반영" },
      { label: "년 수익률", value: "0.00%", note: "거래 간격 반영" },
      { label: "Sharpe Ratio", value: "N/A", note: "연 환산" },
      { label: "Sortino Ratio", value: "N/A", note: "연 환산" },
      { label: "Max Drawdown", value: "0.00%", note: "최대 낙폭" }
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
    { label: "총 거래 횟수", value: totalTrades.toLocaleString("en-US"), note: `기간 ${(totalHours / 24).toFixed(1)}일` },
    { label: "누적 수익률", value: toPercent(totalReturn), note: "단리 기준" },
    { label: "승률", value: toPercent(winRate, 1), note: `승 ${wins} / 패 ${losses}` },
    { label: "손익비", value: Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞", note: "총이익 / 총손실" },
    { label: "월 수익률", value: toPercent(monthlyReturn), note: "거래 간격 반영" },
    { label: "년 수익률", value: toPercent(annualReturn), note: "거래 간격 반영" },
    { label: "Sharpe Ratio", value: Number.isNaN(sharpe) ? "N/A" : sharpe.toFixed(2), note: "연 환산" },
    { label: "Sortino Ratio", value: Number.isNaN(sortino) ? "N/A" : sortino.toFixed(2), note: "연 환산" },
    { label: "Max Drawdown", value: toPercent(maxDrawdown), note: "최대 낙폭" }
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
  if (!target) return;
  try {
    const response = await fetch("/assets/quant/returns.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Unable to load returns.json");
    const rawSeries = await response.json();
    const series = sortByTrade(Array.isArray(rawSeries) ? rawSeries : []);
    if (!series.length) throw new Error("No returns data available");

    const chartBackground = "#05060a";
    const trades = series.map((row) => row.trade);
    const cumulative = series.map((row) => row.cumulative_pct);
    const roiPct = series.map((row) => row.roi_pct);
    const trace = {
      x: trades,
      y: cumulative,
      type: "scatter",
      mode: "lines",
      line: { color: "#ff6f3c", width: 3 },
      fill: "tozeroy",
      name: "Simple cumulative ROI",
      customdata: roiPct,
      hovertemplate: "Trade %{x}<br>ROI %{customdata:.3f}%<extra></extra>"
    };
    const layout = {
      margin: { l: 50, r: 20, t: 30, b: 50 },
      yaxis: { title: "Cumulative ROI (%)", tickformat: ".1f", fixedrange: true },
      xaxis: { title: "Trade #" },
      dragmode: "zoom",
      paper_bgcolor: chartBackground,
      plot_bgcolor: chartBackground,
      font: { color: "#f5f5f5" }
    };
    const config = { responsive: true, displayModeBar: false, doubleClick: "reset" };

    const fullMetrics = computeMetrics(series);
    renderMetricGrid(metricGrid, fullMetrics);

    const histogramState = { initialized: false };
    const histogramConfig = { responsive: true, displayModeBar: false };
    const histogramLayoutBase = {
      margin: { l: 60, r: 20, t: 40, b: 55 },
      xaxis: {
        title: "ROI (%)",
        tickformat: ".2f"
      },
      yaxis: { title: "Density" },
      paper_bgcolor: chartBackground,
      plot_bgcolor: chartBackground,
      font: { color: "#f5f5f5" }
    };

    const updateHistogram = (rows) => {
      if (!histogramTarget) return;
      const roiValues = rows.map((row) => row.roi_pct);
      if (!roiValues.length) {
        Plotly.purge(histogramTarget);
        histogramState.initialized = false;
        clearChartContainer(histogramTarget);
        histogramTarget.insertAdjacentHTML("beforeend", '<p class="quant-error">선택된 구간 데이터가 없습니다.</p>');
        return;
      }
      const density = computeRoiDensity(roiValues);
      if (!density) return;
      const densityTrace = {
        x: density.x,
        y: density.y,
        type: "scatter",
        mode: "lines",
        line: { color: "#4db7ff", width: 3 },
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
      renderMetricGrid(metricGrid, computeMetrics(filtered));
      updateHistogram(filtered);
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
