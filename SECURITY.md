# Security Policy

## Scope

This is a **client-side-only** application. There is no backend, no API, no database, and no
account system. Nothing you enter leaves your browser — scenarios are stored in `localStorage`
and simulations run in a Web Worker on your own machine.

That shape rules out most classic web vulnerabilities, so the realistic surface is:

- **Dependency vulnerabilities** in the npm tree (React, Recharts, Vite, etc.)
- **XSS** via rendered user input (scenario names, custom labels)
- **Unintended data egress** — any change that sends user inputs off-device is a security bug,
  even if it looks like a feature (analytics, error reporting, cloud sync)
- **Supply-chain risk** in the build (`vite.config.ts`, GitHub Actions workflows)

Out of scope: the *accuracy* of tax or projection math. That's a correctness bug — please file
a regular issue using the **Calculation discrepancy** template instead.

## Supported versions

Only the current `main` branch and the deployed demo are supported. There are no long-term
support branches.

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.**

Use GitHub's private vulnerability reporting: go to the repository's **Security** tab →
**Report a vulnerability**. That opens a private advisory visible only to the maintainers.

Please include what you can:

- The kind of issue and where it lives (file, route, dependency)
- Steps to reproduce, or a proof of concept
- What an attacker could actually achieve

**Never include real financial data** in a report. Use synthetic numbers.

## What to expect

This is a small, volunteer-maintained project — there is no SLA and no bug bounty. Realistically:
an acknowledgement within about a week, and a fix or a clear explanation of why something is
working as intended. Credit in the advisory and release notes if you'd like it.
