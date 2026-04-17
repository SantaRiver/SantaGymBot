# UX/UI Audit Report Template

## Findings

List findings from highest severity to lowest severity.

For each finding, use:
- Severity: `critical` | `major` | `minor`
- Type: `code` | `visual`
- Location: file path and line, route, component name, or screenshot scenario
- Problem: one clear sentence
- Impact: why this hurts usability, accessibility, trust, or task completion
- Fix: smallest effective change

Example:

```text
1. [major] [visual] `/workout` mobile empty state
Problem: The page says the workout is empty, but the primary next action is visually detached below the fold.
Impact: Users can miss the next step and assume the screen is broken or unfinished.
Fix: Keep the primary add-exercise action adjacent to the empty-state copy.
```

## Open Questions

Include only uncertainties that block confident conclusions.

## Suggested Next Changes

Prefer a short, implementation-ready list:
- fix critical issues first
- then fix major flow and accessibility issues
- then apply visual polish or redesign work
