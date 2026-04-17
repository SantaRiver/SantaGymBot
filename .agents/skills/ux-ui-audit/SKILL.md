---
name: ux-ui-audit
description: Project-specific UX/UI audit workflow for SantaGymBot. Use when asked to review the app UX/UI, accessibility, mobile workout flows, dialogs, empty/loading/error states, or to capture repeatable screenshots and audit reports for this repository.
---

# SantaGymBot UX/UI Audit

Use this skill for SantaGymBot-specific UX/UI reviews. Treat it as an audit workflow, not a redesign workflow.

Prefer these companion skills when needed:
- `web-design-guidelines` for code-level UI/a11y review
- `vercel-react-best-practices` for React interaction and perceived-performance issues
- `frontend-design` only after the audit, if the user asks for redesign or implementation

## Project Context

- Frontend lives in `frontend/`
- Primary app shell: `frontend/src/App.tsx`
- Main user surfaces:
  - `frontend/src/pages/Dashboard.tsx`
  - `frontend/src/pages/WorkoutSession.tsx`
  - `frontend/src/pages/SettingsPage.tsx`
- Shared workout UI:
  - `frontend/src/components/workout/`
- Theme tokens and global styles:
  - `frontend/src/index.css`

This product is mobile-first and Telegram WebApp-oriented. Treat mobile as primary, desktop as secondary.

## Standard Audit Flow

### 1. Ground In Code

Read:
- app bootstrap and routing
- visible pages
- shared workout components
- theme tokens / global CSS
- stores and hooks that shape loading, auth, error, and persistence behavior

Look especially for:
- modal/dialog accessibility
- primary action hierarchy conflicts
- fixed-bottom controls and safe-area handling
- empty/loading/error/recovery states
- labels for inputs and icon-only buttons
- long text handling on mobile

### 2. Capture Rendered UI

Use the bundled script instead of rewriting Playwright logic:

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Then in another shell:

```bash
cd frontend
npm run ux:audit:capture
```

Optional arguments:

```bash
node ../.agents/skills/ux-ui-audit/scripts/capture-audit.mjs \
  --base-url http://127.0.0.1:5173 \
  --output-dir ../artifacts/ux-audit/manual-run \
  --report ../docs/ux-audit/reports/manual-run.md
```

The script:
- injects stable localStorage fixtures
- mocks API responses for repeatable screenshots
- captures standard scenarios
- creates a report stub

Default screenshot scenarios:
- dashboard desktop
- active workout mobile
- manage exercises mobile
- settings mobile
- history detail desktop
- auth error desktop

Artifacts go to:
- screenshots: `artifacts/ux-audit/...`
- report stubs: `docs/ux-audit/reports/...`

### 3. Write Findings

Use the report shape from `references/report-template.md`.

For every finding include:
- severity
- type: `code` or `visual`
- location: file:line, route, component, or screenshot scenario
- problem
- impact
- smallest effective fix

Prioritize:
- `critical`: task blocked, data-loss risk, severe accessibility failure
- `major`: materially harms comprehension, confidence, or efficiency
- `minor`: polish, consistency, contrast, spacing, copy, affordance

## SantaGymBot-Specific Checks

Always review these flows if relevant:
- dashboard start-workout CTA
- active workout card layout and set-entry labels
- manage-exercises mode
- destructive confirmation dialog
- exercise catalog and create-exercise modal
- settings switch/input semantics
- auth failure state
- history/detail rendering

If the user later asks for fixes or redesign:
- keep the audit findings as source of truth
- separate must-fix usability/accessibility issues from purely visual upgrades
