#!/usr/bin/env bash
set -euo pipefail

echo "[ci-build] Ensuring dependencies..."
if ! command -v bundle >/dev/null 2>&1; then
  echo "bundle command not found. Install Bundler (gem install bundler) and retry." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 command not found. Install Python 3.11+ and retry." >&2
  exit 1
fi

if ! ruby -e 'exit(Gem::Version.new(RUBY_VERSION) >= Gem::Version.new("3.3.0") ? 0 : 1)'; then
  echo "Ruby $(ruby -v) detected. Please install Ruby >= 3.3 (see README) to match GitHub Actions." >&2
  exit 1
fi

echo "[ci-build] Installing Ruby gems"
bundle install --quiet

echo "[ci-build] Installing Python requirements"
python3 -m pip install --user -r requirements.txt >/dev/null

echo "[ci-build] Generating quant artifacts"
python3 scripts/build_quant.py

echo "[ci-build] Building Jekyll site"
bundle exec jekyll build --trace

echo "[ci-build] Success — artifacts available in _site/"
