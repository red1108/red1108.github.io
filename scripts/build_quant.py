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


def load_returns() -> pd.DataFrame:
  df = pd.read_csv(DATA_CSV, parse_dates=["date"])
  if df.empty:
    raise ValueError("returns.csv is empty")
  if "return" not in df.columns:
    raise ValueError("returns.csv must contain 'return' column")
  return df.sort_values("date").reset_index(drop=True)


def compute_metrics(df: pd.DataFrame) -> tuple[pd.DataFrame, list[dict[str, str]], list[dict[str, str]], list[dict[str, float]]]:
  returns = df["return"].astype(float)
  cumulative = (1 + returns).cumprod()
  df = df.assign(cumulative=cumulative - 1)

  periods = len(df)
  years = periods / 12.0
  ending_value = cumulative.iloc[-1]
  cagr = ending_value ** (1 / years) - 1 if years > 0 else math.nan
  std = float(returns.std(ddof=0))
  annual_vol = std * math.sqrt(12)
  sharpe = (returns.mean() * 12) / (std * math.sqrt(12)) if std != 0 else math.nan
  running_max = cumulative.cummax()
  drawdown = cumulative / running_max - 1
  max_drawdown = drawdown.min()
  win_rate = (returns > 0).mean()

  metrics = [
    {"label": "CAGR", "value": f"{cagr:.2%}", "note": "Annualized"},
    {"label": "Sharpe (rf=0)", "value": f"{sharpe:.2f}", "note": "Monthly sampling"},
    {"label": "Max Drawdown", "value": f"{max_drawdown:.2%}", "note": "Peak-to-trough"},
    {"label": "Volatility", "value": f"{annual_vol:.2%}", "note": "Annualized"},
    {"label": "Win rate", "value": f"{win_rate:.1%}", "note": "Positive months"}
  ]

  records = df.to_dict(orient="records")
  monthly = [
    {
      "month": row["date"].strftime("%b %Y"),
      "return": f"{row['return']:.2%}",
    }
    for row in records
  ]

  series = [
    {
      "date": row["date"].strftime("%Y-%m-%d"),
      "return": row["return"],
      "cumulative": row["cumulative"],
    }
    for row in records
  ]

  return df, metrics, monthly, series


def save_outputs(df: pd.DataFrame, metrics: list[dict], monthly: list[dict], series: list[dict]) -> None:
  (SITE_DATA / "quant_metrics.json").write_text(json.dumps(metrics, indent=2))
  (SITE_DATA / "quant_monthly.json").write_text(json.dumps(monthly, indent=2))
  (QUANT_ASSETS / "returns.json").write_text(json.dumps(series, indent=2))

  plt.style.use("dark_background")
  fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
  ax.plot(df["date"], (1 + df["cumulative"]).values, color="#ff6f3c", linewidth=2.2)
  ax.fill_between(df["date"], (1 + df["cumulative"]).values, alpha=0.2, color="#ff6f3c")
  ax.set_title("Cumulative Returns")
  ax.set_ylabel("Growth of $1")
  ax.grid(alpha=0.3)
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
