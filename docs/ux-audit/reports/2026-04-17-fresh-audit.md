# UX/UI Audit Report

- Generated at: 2026-04-17T05:22:42.734Z
- Screenshot directory: `../artifacts/ux-audit/2026-04-17-fresh-audit`

## Findings

1. [major] [visual] `/workout` mobile active state, backed by [ActiveWorkoutControls.tsx](/Users/santa/PycharmProjects/SantaGymBot/frontend/src/components/workout/ActiveWorkoutControls.tsx:35) and [WorkoutSession.tsx](/Users/santa/PycharmProjects/SantaGymBot/frontend/src/pages/WorkoutSession.tsx:79)
Problem: Fixed CTA `Добавить упражнение` still overlaps the bottom of the content stack; on the fresh mobile screenshot it covers the lower part of the last exercise card and hides the final `Добавить подход` action.
Impact: Users can miss or struggle to reach the last interactive control in the workout, especially on shorter mobile viewports.
Fix: Reserve footer space based on the actual CTA height or move the action into a sticky layout that participates in document flow instead of floating over the final card.

2. [major] [code] `dashboard-desktop.png` capture scenario, backed by [capture-audit.mjs](/Users/santa/PycharmProjects/SantaGymBot/.agents/skills/ux-ui-audit/scripts/capture-audit.mjs:57), [capture-audit.mjs](/Users/santa/PycharmProjects/SantaGymBot/.agents/skills/ux-ui-audit/scripts/capture-audit.mjs:209), and [Dashboard.tsx](/Users/santa/PycharmProjects/SantaGymBot/frontend/src/pages/Dashboard.tsx:122)
Problem: The audit fixture always seeds an active workout session, so visiting `/` immediately redirects to `/workout`; the file named `dashboard-desktop.png` is not actually a dashboard screenshot.
Impact: The reproducible audit misses the real home screen and can produce false confidence about dashboard UX regressions.
Fix: Add a separate no-active-session fixture for dashboard capture and assert the final route before taking the screenshot.

3. [minor] [visual] `/workout` manage mode mobile, backed by [ExerciseCard.tsx](/Users/santa/PycharmProjects/SantaGymBot/frontend/src/components/workout/ExerciseCard.tsx:136)
Problem: Long exercise names collapse to a single truncated line in manage mode (`Тяга штанги в накл...`), even though reordering and deletion is the moment when users most need to disambiguate similar items.
Impact: Exercise identity becomes less clear during a destructive or ordering workflow.
Fix: Allow two lines or show the full title in manage mode while keeping compact spacing for the action buttons.

4. [minor] [visual] `/history/:id` desktop and workout/detail desktop layouts, backed by [WorkoutSession.tsx](/Users/santa/PycharmProjects/SantaGymBot/frontend/src/pages/WorkoutSession.tsx:139)
Problem: Desktop browser views remain a narrow mobile column centered inside a large empty canvas.
Impact: This does not hurt the Telegram-mobile primary context, but browser-based review and support usage still feel unfinished and information-sparse on wide screens.
Fix: Keep mobile-first sizing, but add a modest desktop presentation layer such as a broader max width, stronger page framing, or contextual side spacing.

## Screenshot Scenarios

- `dashboard-desktop.png`
- `workout-mobile.png`
- `workout-manage-mobile.png`
- `settings-mobile.png`
- `history-desktop.png`
- `auth-error-desktop.png`

## Open Questions

None.

## Suggested Next Changes

- Fix the active workout footer overlap first; it is the only remaining issue that still interferes with task completion on the primary mobile flow.
- Correct the audit fixture so `dashboard-desktop.png` really covers the dashboard; otherwise future UX reviews will keep missing that surface.
- Relax title truncation in manage mode, then decide whether desktop browser support deserves a light layout enhancement.
