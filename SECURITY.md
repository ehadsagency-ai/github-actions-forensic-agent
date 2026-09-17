# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| v1.x    | ✅ |

## Reporting a vulnerability

Please open a **private** security advisory on this repository (GitHub → Security → Advisories), or email the maintainer via the profile contact on [ehadsagency-ai](https://github.com/ehadsagency-ai).

Do **not** file public issues for unpatched secret-exposure bugs.

## Token guidance

Prefer least-privilege tokens (`actions: read`, `contents: read`, optional `checks: write` for annotations). Treat generated reports as sensitive — they may contain log snippets.
