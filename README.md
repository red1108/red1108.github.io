# Research Portfolio — username.github.io

Static site built with Jekyll + Bundler and a Python-assisted quant dashboard for publishing research, teaching, news, and shareable notes.

## Features
- **Structured content**: Home hero, Research, Publications (jekyll-scholar), Teaching, News, Projects, Shares collection with filters, and project artifact pages.
- **Data-aware Shares**: Collection items expose rich front matter (tags, categories, languages, summaries) with MathJax/KaTeX support.
- **Quant pipeline**: CSV input → Python script → metrics JSON, monthly table JSON, interactive JSON, PNG chart.
- **SEO-ready**: `jekyll-seo-tag`, canonical URLs, Open Graph/Twitter, JSON-LD (Person + BlogPosting), sitemap, robots, alt text everywhere.
- **Automated deploy**: GitHub Actions builds site, runs Python script, and publishes via GitHub Pages.

## Repository layout

```
├── _config.yml                 # Site metadata, collections, plugins
├── _data/                      # Navigation, research, projects, quant metrics
├── _includes/                  # Head, navigation, footer, JSON-LD, share card
├── _layouts/                   # Base + page-specific layouts (home, shares, quant, bloch)
├── _pages/                     # Content pages (research, teaching, news, projects)
├── _shares/                    # Knowledge base entries
├── _bibliography/              # BibTeX file for jekyll-scholar
├── assets/css, js, images      # Styling, interactivity, profile SVG
├── assets/quant/               # Build artifacts (returns.json, PNG)
├── data/quant/returns.csv      # Source returns data for quant dashboard
├── scripts/build_quant.py      # Python build step
├── shares.md                   # Collection index page
├── .github/workflows/deploy.yml# Build + deploy pipeline
```

## Requirements
- Ruby 3.3.x (repo ships `.ruby-version=3.3.10`, install via `rbenv install 3.3.10` or `asdf install ruby 3.3.10`)
- Bundler 2.5+
- Python 3.11+

## Local development
```bash
# install Ruby gems
bundle install

# install Python deps (optional: use virtualenv)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# generate quant assets before serving
python scripts/build_quant.py

# run Jekyll locally
bundle exec jekyll serve --livereload
```
Navigate to http://localhost:4000 to preview. Re-run `scripts/build_quant.py` whenever `data/quant/returns.csv` changes.

### Simulate GitHub Actions locally
Run the same sequence as `.github/workflows/deploy.yml`:

```bash
bash scripts/ci_build.sh
```

The script checks for Bundler + Python, installs gems (`bundle install`), installs Python requirements, regenerates quant assets, and runs `bundle exec jekyll build --trace`. Use this before pushing to ensure CI will pass.

## Deployment
1. Push to `main`.
2. GitHub Actions workflow `Build and Deploy Site`:
   - Checks out repo & submodules
   - Installs Ruby + Bundler deps
   - Installs Python deps + runs `scripts/build_quant.py`
   - Builds Jekyll site (`_site/`)
   - Uploads artifact + deploys to GitHub Pages
3. GitHub Pages serves directly from the action (no GitHub Pages auto-build).

Ensure repository name is `username.github.io` and GitHub Pages is set to "GitHub Actions" in repository settings.

## Quant data workflow
1. Update `data/quant/returns.csv`. Expected headers: `Timestamp`, `Long_ex`, `Short_ex`, `Total_Invested`, `Long_Net_Profit`, `Short_Net_Profit`, `Net_Profit`, `ROI`, `Rebated_Net_Profit`, `Rebated_ROI`, `Symbol`.
2. `Rebated_ROI` is the per-trade decimal return (multiply by 100 for %). The dashboard sums these linearly (no compounding) to avoid strategy leakage.
3. Run `python scripts/build_quant.py` locally or rely on CI. The script:
   - Parses timestamps, sorts trades, and computes linear cumulative ROI, Sharpe/Sortino, win rate, profit factor, and time-adjusted monthly/yearly returns using a 365×24 hour baseline.
   - Emits `_data/quant_metrics.json`, `_data/quant_monthly.json`, `assets/quant/returns.json`, and `assets/quant/cumulative.png` (trade-index chart fallback).
4. `/projects/quant-dashboard/` consumes the JSON data for the metric grid, table, and Plotly chart (x-axis is trade count, y-axis is cumulative Rebated ROI %).

## SEO checklist (built-in)
- Canonical URLs + meta description on every page via `head.html` + `jekyll-seo-tag`.
- JSON-LD: Person schema on home, BlogPosting schema on Shares.
- Sitemap + robots ready out-of-the-box.
- Open Graph/Twitter tags from `jekyll-seo-tag`.
- Accessible alt text for hero/profile/quant imagery.
- Clean permalinks (`/:categories/:title/`, `/shares/:title/`, `/projects/:title/`).

## Quantum Complexity Zoo

The atlas lives at `/projects/quantum-complexity-zoo/`. Its curated publication
timeline and definitions are in `_data/complexity_zoo.yml`; the DOM-free model
and membrane simulator are in `assets/js/complexity-zoo-engine.js`. The browser
controller and canvas renderer are in `assets/js/complexity-zoo.js`.

Run `node scripts/tests/complexity-zoo.cjs` to exercise timeline replay, equality
fusion and reversal, unknown versus negative membership, rapid dragging,
resizing, and geometry acceptance. Ruby is used only to parse the Jekyll YAML.
Then build with `bundle exec jekyll build --trace` and inspect the page locally.

New timeline facts need a source, a date, and a `date_basis` (`publication`,
`preprint`, or `derived`). Explicit negative membership uses `nonmembership`;
absence of positive evidence must never become an exclusion constraint.
Promise problems are identified and listed separately from language markers.
Oracle events annotate comparisons without changing unconditional strictness.

The simulator limits growth per substep and resolves membrane self-contact so
new births and shrinking shapes do not jam the safety guard. Rewinds initialize
a feasible layout; forward steps retain existing shapes when feasible.
If proposed motion remains blocked for 18 frames with no active drag, the
simulator restores a validated layout instead of leaving the scene frozen.
It proposes PBD displacements, limits them with continuous moving
edge contact checks, and validates containment and self-intersection before
acceptance. Invalid proposals fall back to the last valid geometry. Draw the
validated polygons directly: smoothing splines can overshoot their boundaries.
The renderer additionally clips child fills and strokes to their known parents.
The regression suite establishes the checked cases, not a formal numerical
proof for arbitrary datasets or floating-point inputs.

## Testing
- `bundle exec jekyll build` (ensures layout + Liquid correctness).
- `python scripts/build_quant.py && bundle exec jekyll serve --unpublished` for iterative development.
- Optionally run `htmlproofer ./_site` (installed via Gemfile) after builds.
