#!/usr/bin/env python3
"""Generate quant metrics JSON, monthly table, and PNG chart."""

from __future__ import annotations

import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
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
  "Rebated_ROI",
  "Rebated_Net_Profit",
  "Symbol",
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
  df["rebated_roi"] = df["Rebated_ROI"].astype(float)
  df["rebated_net_profit"] = df["Rebated_Net_Profit"].astype(float)
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


def compute_metrics(df: pd.DataFrame) -> tuple[pd.DataFrame, list[dict[str, str]], list[dict[str, str]], list[dict[str, float]]]:
  roi = df["rebated_roi"].astype(float)
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
    {"label": "총 거래 횟수", "value": f"{total_trades:,}", "note": f"기간 {total_hours/24:.1f}일"},
    {"label": "누적 수익률", "value": f"{total_return * 100:.2f}%", "note": "단리"},
    {"label": "승률", "value": f"{win_rate * 100:.1f}%", "note": f"승 {int((roi>0).sum())} / 패 {int((roi<=0).sum())}"},
    {"label": "손익비", "value": "∞" if math.isinf(profit_factor) else f"{profit_factor:.2f}", "note": "총이익 / 총손실"},
    {"label": "월 수익률", "value": f"{monthly_return * 100:.2f}%", "note": "거래 간격 반영"},
    {"label": "년 수익률", "value": f"{annual_return * 100:.2f}%", "note": "거래 간격 반영"},
    {"label": "Sharpe Ratio", "value": f"{sharpe:.2f}" if not math.isnan(sharpe) else "N/A", "note": "연간 환산"},
    {"label": "Sortino Ratio", "value": f"{sortino:.2f}" if not math.isnan(sortino) else "N/A", "note": "하방 변동성"},
    {"label": "Max Drawdown", "value": f"{max_drawdown * 100:.2f}%", "note": "단리 곡선"},
  ]

  df["month_key"] = df["timestamp"].dt.to_period("M")
  monthly = [
    {
      "month": period.strftime("%b %Y"),
      "return": f"{value * 100:.2f}%",
    }
    for period, value in df.groupby("month_key")["rebated_roi"].sum().items()
  ]

  series = [
    {
      "trade": int(row.trade),
      "timestamp": row.timestamp.isoformat(),
      "symbol": row.Symbol,
      "roi": row.rebated_roi,
      "roi_pct": row.rebated_roi * 100,
      "cumulative": row.cumulative,
      "cumulative_pct": row.cumulative_pct,
    }
    for row in df.itertuples()
  ]

  return df, metrics, monthly, series


def save_outputs(df: pd.DataFrame, metrics: list[dict], monthly: list[dict], series: list[dict]) -> None:
  (SITE_DATA / "quant_metrics.json").write_text(json.dumps(metrics, indent=2))
  (SITE_DATA / "quant_monthly.json").write_text(json.dumps(monthly, indent=2))
  (QUANT_ASSETS / "returns.json").write_text(json.dumps(series, indent=2))

  plt.style.use("dark_background")
  fig, ax = plt.subplots(figsize=(9, 4.8), dpi=150)
  ax.plot(df["trade"], df["cumulative_pct"], color="#ff6f3c", linewidth=2.2)
  ax.fill_between(df["trade"], df["cumulative_pct"], alpha=0.18, color="#ff6f3c")
  ax.set_title("Cumulative Rebated ROI (Simple)")
  ax.set_xlabel("Trade #")
  ax.set_ylabel("Cumulative ROI (%)")
  ax.grid(alpha=0.25)
  fig.tight_layout()
  fig.savefig(QUANT_ASSETS / "cumulative.png", transparent=True)
  plt.close(fig)


def main() -> None:
  ensure_paths()
  df = load_returns()
  enriched, metrics, monthly, series = compute_metrics(df)
  save_outputs(enriched, metrics, monthly, series)
  print("Generated quant artifacts")


if __name__ == "__main__":
  main()
