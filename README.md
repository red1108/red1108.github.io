# Research Portfolio — username.github.io

Static site built with Jekyll + Bundler and a Python-assisted quant dashboard for publishing research, teaching, news, and shareable notes.

## Features
- **Structured content**: Home hero, Research, Publications (jekyll-scholar), Teaching, News, Projects, Shares collection with filters, Quant dashboard under `/quant/`.
- **Data-aware Shares**: Collection items expose rich front matter (tags, categories, languages, summaries) with MathJax/KaTeX support.
- **Quant pipeline**: CSV input → Python script → metrics JSON, monthly table JSON, interactive JSON, PNG chart.
- **SEO-ready**: `jekyll-seo-tag`, canonical URLs, Open Graph/Twitter, JSON-LD (Person + BlogPosting), sitemap, robots, alt text everywhere.
- **Automated deploy**: GitHub Actions builds site, runs Python script, and publishes via GitHub Pages.

## Repository layout

```
├── _config.yml                 # Site metadata, collections, plugins
├── _data/                      # Navigation, research, projects, quant metrics
├── _includes/                  # Head, navigation, footer, JSON-LD, share card
├── _layouts/                   # Base + page-specific layouts (home, shares, quant)
├── _pages/                     # Content pages (research, teaching, news, projects)
├── _shares/                    # Knowledge base entries
├── _bibliography/              # BibTeX file for jekyll-scholar
├── assets/css, js, images      # Styling, interactivity, profile SVG
├── assets/quant/               # Build artifacts (returns.json, PNG)
├── data/quant/returns.csv      # Source returns data for quant dashboard
├── scripts/build_quant.py      # Python build step
├── quant.md                    # Quant dashboard page
├── shares.md                   # Collection index page
├── .github/workflows/deploy.yml# Build + deploy pipeline
```

## Requirements
- Ruby 3.3.x (use `rbenv` or `ruby-install`)
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
1. Update `data/quant/returns.csv` (monthly `%` returns as decimals).
2. Run `python scripts/build_quant.py` locally or rely on CI.
3. Script outputs:
   - `_data/quant_metrics.json`
   - `_data/quant_monthly.json`
   - `assets/quant/returns.json`
   - `assets/quant/cumulative.png`
4. Jekyll consumes JSON data for tables; PNG is referenced for JS-off SEO.

## SEO checklist (built-in)
- Canonical URLs + meta description on every page via `head.html` + `jekyll-seo-tag`.
- JSON-LD: Person schema on home, BlogPosting schema on Shares.
- Sitemap + robots ready out-of-the-box.
- Open Graph/Twitter tags from `jekyll-seo-tag`.
- Accessible alt text for hero/profile/quant imagery.
- Clean permalinks (`/:categories/:title/`, `/shares/:title/`, `/quant/`).

## Testing
- `bundle exec jekyll build` (ensures layout + Liquid correctness).
- `python scripts/build_quant.py && bundle exec jekyll serve --unpublished` for iterative development.
- Optionally run `htmlproofer ./_site` (installed via Gemfile) after builds.
