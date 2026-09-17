# GitHub Actions Forensic Agent

[![Release](https://img.shields.io/github/v/release/ehadsagency-ai/github-actions-forensic-agent)](https://github.com/ehadsagency-ai/github-actions-forensic-agent/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Runs on](https://img.shields.io/badge/runs-node20-green.svg)](action.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/ehadsagency-ai/github-actions-forensic-agent/releases/tag/v1.0.0)

> GitHub Action that scans workflow runs for **hidden failures**, **secret-like log smells**, **dangerous shell patterns**, and **over-broad permissions**, then writes a Markdown/JSON forensic report.

**Honest metrics (2026-09-17T15:10:00CEST):** ★0 · forks 0 · 1 author · 0 commits/7d · Release **v1.0.0** · GitHub Marketplace **not submitted** · Hype Score **7/25**.

---

## What it detects

Aligned with live README + `action.yml` intent:

| Severity band (docs) | Examples |
|----------------------|----------|
| Critical | Secret-like strings in logs; `curl \| bash` / `wget \| sh`; overly broad permissions (`write-all`) |
| High | Jobs failing under `continue-on-error`; unpinned actions; unaudited self-hosted runners |
| Medium | Runtime degradation / frequent timeouts; skipped tests without justification |
| Low | Ignored warnings; optional performance suggestions |

Also documented: risk score summarization, Markdown + JSON reports, optional GitHub annotations.

---

## Quick start

```yaml
name: Forensic audit

on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  forensic-analysis:
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      checks: write   # optional — annotations
    steps:
      - name: Forensic audit
        id: forensic
        uses: ehadsagency-ai/github-actions-forensic-agent@v1.0.0
        with:
          repository: ${{ github.repository }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deep-scan: 'true'
          output-format: 'both'

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: forensic-report
          path: ${{ steps.forensic.outputs.report-path }}
```

Pin to **`@v1.0.0`** (or a commit SHA) rather than a floating branch.

---

## Action inputs & outputs

From live `action.yml`:

### Inputs

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `repository` | yes | — | Target repo `owner/repo` |
| `github-token` | yes | — | Token for GitHub API |
| `deep-scan` | no | `false` | Deeper log analysis |
| `max-runs` | no | `50` | Max workflow runs to inspect |
| `output-format` | no | `both` | `json` · `markdown` · `both` |

### Outputs

| Name | Description |
|------|-------------|
| `hidden-failures` | Count of hidden failures detected |
| `critical-issues` | JSON list of critical findings |
| `report-path` | Path to generated report file |
| `success` | Whether the analysis completed successfully |

**Runtime:** `node20` · entry `src/main.js`

---

## Architecture (one-liner)

Composite Node 20 action: GitHub API client → forensic analyzer → reporter (`src/github-api.js`, `analyzer.js`, `reporter.js` per live tree docs).

---

## Limitations & threat honesty

- **Not a substitute** for secret scanning products, SCA, or a full red-team of your CI. Heuristics can **false-positive** (benign tokens in logs) or **miss** obfuscated leaks.
- Needs a token that can **read** Actions / workflow data; over-privileged tokens increase blast radius — prefer least privilege.
- Deep scans on large repos may **rate-limit** or timeout — lower `max-runs` or disable `deep-scan`.
- Reports may contain sensitive snippets — treat artifacts as **restricted**.
- Marketplace listing, third-party audits, and SLA numbers: **none verified** — do not claim them.
- Upstream README language is primarily **French**; this draft is EN for portfolio clarity.

---

## Local development

```bash
git clone https://github.com/ehadsagency-ai/github-actions-forensic-agent.git
cd github-actions-forensic-agent
npm install
npm test
npm run lint
```

Requires Node.js 20+.

---

## Status

| Item | State |
|------|-------|
| Release | ✅ **v1.0.0** (2025-09-14) |
| `action.yml` | ✅ present |
| Marketplace | ❌ not submitted (planned if approved) |
| Stars / forks | 0 / 0 |
| Owner / `uses:` examples | `ehadsagency-ai` |

---

## Contributing

PRs welcome: new detectors, EN/FR docs parity, tests, and permission-scope docs.

1. Fork → feature branch  
2. `npm test` / `npm run lint`  
3. Open a PR against `ehadsagency-ai/github-actions-forensic-agent`

---

## License

MIT · © ehadsagency-ai
