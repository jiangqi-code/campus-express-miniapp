# Debug Session: h5-frozen-input

Status: [OPEN]
Debug Server: `pending`
Log File: `pending`

## Symptom
- H5 login/register page renders visually, but phone inputs cannot receive focus or text entry.
- Buttons and tabs also cannot be clicked.
- No visible runtime error or toast appears during interaction.

## Scope
- Platform: uni-app H5
- Route: `#/pages/auth/index`

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | A full-page overlay or element with higher stacking context is covering the login form and swallowing pointer events. | High | Low | Pending |
| B | The page DOM renders, but the effective target/container has `pointer-events: none` or related CSS that blocks focus/clicks. | High | Low | Pending |
| C | uni-app H5 mounted the page, but auth page event bindings are not active because the interactive subtree is not the live event root. | Medium | Medium | Pending |
| D | A global listener or script is preventing default pointer/focus behavior before the input/button handlers run. | Medium | Medium | Pending |
| E | The login UI is visually from one file tree, but the running H5 bundle is actually using another duplicate page/entry tree. | Medium | Low | Pending |

## Evidence Plan
- Start Debug Server and collect browser-side events through HTTP reporting.
- Instrument app startup and auth page mount to capture DOM structure, computed styles, hit-testing, focus attempts, and click propagation.
- Compare pre-fix and post-fix evidence before changing logic.

## Instrumentation
- Pending

## Progress Log
- Session initialized.
