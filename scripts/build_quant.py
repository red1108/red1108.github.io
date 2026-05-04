#!/usr/bin/env python3
"""Generate quant metrics JSON, monthly table, and PNG chart."""

from __future__ import annotations

import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib import ticker as mticker
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_CSV = ROOT / "data" / "quant" / "returns.csv"
QUANT_ASSETS = ROOT / "assets" / "quant"
SITE_DATA = ROOT / "_data"


def ensure_paths() -> None:
  QUANT_ASSETS.mkdir(parents=True, exist_ok=True)
  SITE_DATA.mkdir(parents=True, exist_ok=True)


REQUIRED_COLUMNS = {
  "Timestamp",
  "ROI",
}


def load_returns() -> pd.DataFrame:
  df = pd.read_csv(DATA_CSV)
  if df.empty:
    raise ValueError("returns.csv is empty")
  missing = REQUIRED_COLUMNS - set(df.columns)
  if missing:
    raise ValueError(f"returns.csv missing columns: {sorted(missing)}")
  df["timestamp"] = pd.to_datetime(df["Timestamp"], utc=True)
  df = df.sort_values("timestamp").reset_index(drop=True)
  df["roi"] = df["ROI"].astype(float)
  df["trade"] = df.index + 1
  return df


def compute_time_spans(df: pd.DataFrame) -> tuple[float, float]:
  if len(df) == 0:
    return 0.0, 0.0
  start = df["timestamp"].iloc[0]
  end = df["timestamp"].iloc[-1]
  total_seconds = max((end - start).total_seconds(), 60.0)
  total_hours = total_seconds / 3600.0
  total_years = total_hours / (24 * 365)
  return total_hours, total_years


def compute_metrics(df: pd.DataFrame) -> tuple[pd.DataFrame, list[dict[str, str]], list[dict[str, str]], list[dict[str, float]], dict[str, object]]:
  roi = df["roi"].astype(float)
  cumulative = roi.cumsum()
  df = df.assign(
    cumulative=cumulative,
    cumulative_pct=cumulative * 100,
  )

  total_trades = len(df)
  total_return = cumulative.iloc[-1] if total_trades else 0.0
  total_hours, total_years = compute_time_spans(df)
  total_years = max(total_years, 1 / (24 * 365))
  trades_per_year = total_trades / total_years

  mean_roi = float(roi.mean()) if total_trades else 0.0
  std_roi = float(roi.std(ddof=0)) if total_trades > 1 else 0.0
  annual_return = mean_roi * trades_per_year
  monthly_return = annual_return / 12.0

  positive = roi[roi > 0].sum()
  negative = roi[roi < 0].sum()
  profit_factor = positive / abs(negative) if negative != 0 else math.inf
  win_rate = (roi > 0).mean() if total_trades else 0.0

  sharpe = math.nan
  if std_roi > 0 and trades_per_year > 0:
    sharpe = (mean_roi * math.sqrt(trades_per_year)) / std_roi

  downside = roi[roi < 0]
  downside_std = float(downside.std(ddof=0)) if len(downside) > 0 else 0.0
  sortino = math.nan
  if downside_std > 0 and trades_per_year > 0:
    sortino = (mean_roi * math.sqrt(trades_per_year)) / downside_std

  running_max = df["cumulative"].cummax()
  drawdown = df["cumulative"] - running_max
  max_drawdown = drawdown.min() if not drawdown.empty else 0.0

  metrics = [
    {"label": "Total Trades", "value": f"{total_trades:,}", "note": f"{total_hours/24:.1f}-day window"},
    {"label": "Cumulative Return", "value": f"{total_return * 100:.2f}%", "note": "Simple, non-compounded ROI"},
    {"label": "Win Rate", "value": f"{win_rate * 100:.1f}%", "note": f"{int((roi>0).sum())} wins / {int((roi<=0).sum())} losses"},
    {"label": "Profit Factor", "value": "∞" if math.isinf(profit_factor) else f"{profit_factor:.2f}", "note": "Gross profit / gross loss"},
    {"label": "Monthly Pace", "value": f"{monthly_return * 100:.2f}%", "note": "Mean trade ROI scaled by frequency"},
    {"label": "Annualized Pace", "value": f"{annual_return * 100:.2f}%", "note": "Mean trade ROI scaled by frequency"},
    {"label": "Sharpe Ratio", "value": f"{sharpe:.2f}" if not math.isnan(sharpe) else "N/A", "note": "Annualized risk-adjusted return"},
    {"label": "Sortino Ratio", "value": f"{sortino:.2f}" if not math.isnan(sortino) else "N/A", "note": "Annualized downside risk"},
    {"label": "Max Drawdown", "value": f"{max_drawdown * 100:.2f}%", "note": "Peak-to-trough decline"},
  ]

  df["month_period"] = df["timestamp"].dt.tz_convert(None).dt.to_period("M")
  monthly = [
    {
      "month": period.strftime("%b %Y"),
      "return": f"{value * 100:.2f}%",
    }
    for period, value in df.groupby("month_period", sort=True)["roi"].sum().items()
  ]

  series = [
    {
      "trade": int(trade),
      "timestamp": timestamp.isoformat(),
      "roi": float(roi_value),
      "roi_pct": float(roi_value * 100),
      "cumulative": float(cumulative_value),
      "cumulative_pct": float(cumulative_pct_value),
    }
    for trade, timestamp, roi_value, cumulative_value, cumulative_pct_value in zip(
      df["trade"],
      df["timestamp"],
      df["roi"],
      df["cumulative"],
      df["cumulative_pct"],
    )
  ]

  last_timestamp = df["timestamp"].iloc[-1].to_pydatetime() if total_trades else None
  overview = {
    "trade_count": total_trades,
    "duration_days": round(total_hours / 24, 1),
    "last_updated": last_timestamp.strftime("%Y-%m-%d") if last_timestamp is not None else "",
  }

  return df, metrics, monthly, series, overview


def save_outputs(df: pd.DataFrame, metrics: list[dict], monthly: list[dict], series: list[dict], overview: dict[str, object]) -> None:
  (SITE_DATA / "quant_metrics.json").write_text(json.dumps(metrics, indent=2))
  (SITE_DATA / "quant_monthly.json").write_text(json.dumps(monthly, indent=2))
  (QUANT_ASSETS / "returns.json").write_text(json.dumps(series, indent=2))
  (SITE_DATA / "quant_overview.json").write_text(json.dumps(overview, indent=2))

  fig, ax = plt.subplots(figsize=(9, 4.8), dpi=150)
  paper = "#f6f1e7"
  paper_2 = "#efe7d6"
  ink = "#1a1816"
  ink_2 = "#3a3631"
  ink_3 = "#6b655c"
  rule = "#d6cab0"

  fig.patch.set_facecolor(paper)
  ax.set_facecolor(paper)
  trades = df["trade"]
  cumulative_pct = df["cumulative_pct"]
  ax.plot(trades, cumulative_pct, color=ink, linewidth=1.4)
  ax.fill_between(trades, cumulative_pct, color=ink_3, alpha=0.10)
  ax.set_title("Simple cumulative ROI", color=ink, pad=14, fontfamily="serif")
  ax.set_xlabel("Trade #", color=ink_2)
  ax.set_ylabel("Cumulative ROI (%)", color=ink_2)
  ax.tick_params(colors=ink_3, labelsize=9)
  ax.yaxis.set_major_formatter(mticker.FormatStrFormatter("%.1f"))
  for spine in ax.spines.values():
    spine.set_color(rule)
  ax.grid(color=rule, alpha=1.0, linewidth=0.6)
  ax.margins(x=0)
  fig.tight_layout()
  fig.savefig(QUANT_ASSETS / "cumulative.png", facecolor=paper_2, transparent=False)
  plt.close(fig)


def main() -> None:
  ensure_paths()
  df = load_returns()
  enriched, metrics, monthly, series, overview = compute_metrics(df)
  save_outputs(enriched, metrics, monthly, series, overview)
  print("Generated quant artifacts")


if __name__ == "__main__":
  main()
