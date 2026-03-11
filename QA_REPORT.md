# QA Browser Report

## Test Environment
- URL: http://localhost:5173
- Browser: Chromium (headless)
- Date: 2026-03-11 (UTC)
- Method: One-pass Playwright script (`/workspace/qa_browser_workflow40.py`), no retries

## Results Summary
- Total criteria tested: 9
- Passed: 4
- Failed: 5
- Blocked: 0
- Flaky: 0

## Detailed Results

### Criterion 1: Main menu initial state loads
**Status:** PASS
**Screenshot:** screenshots/01-main-menu.png
**Notes:** Main menu loaded and rendered successfully.

### Criterion 2: Start Game enters Overworld scene
**Status:** PASS
**Screenshot:** screenshots/02-overworld-entry.png
**Notes:** Start flow transitioned from menu to Overworld and persisted scene key.

### Criterion 3: Ranger dialogue progression sets tutorial completion flag
**Status:** FAIL
**Screenshot:** screenshots/05-ranger-dialogue-complete.png
**Bug filed:** Yes — "Overworld movement click to tile (7,4) times out, blocking Ranger progression"
**Notes:** Movement/state wait timed out before interaction path completed.

### Criterion 4: Mechanic interaction unlocks workshop gate progression
**Status:** FAIL
**Screenshot:** screenshots/08-mechanic-dialogue-complete.png
**Bug filed:** Yes — "Overworld movement to Mechanic area (10,8) times out and progression cannot be verified"
**Notes:** Could not reliably reach/confirm mechanic progression due to movement timeout.

### Criterion 5: Workshop gate interaction prompt is available after unlock
**Status:** FAIL
**Screenshot:** screenshots/09-workshop-gate-prompt.png
**Bug filed:** Yes — "Workshop gate prompt path is blocked by position-update timeout at tile (9,8)"
**Notes:** Gate prompt check blocked by movement persistence timeout.

### Criterion 6: Supply cache pickup grants workshop pass and checkpoint unlock flag
**Status:** FAIL
**Screenshot:** screenshots/10-supply-cache-pickup.png
**Bug filed:** Yes — "Supply cache route to tile (5,2) times out; workshop pass and checkpoint flag cannot be obtained"
**Notes:** Supply cache route timed out before flag/item assertions could pass.

### Criterion 7: Canyon checkpoint interaction works after pass unlock
**Status:** FAIL
**Screenshot:** screenshots/11-canyon-checkpoint-prompt.png
**Bug filed:** Yes — "Canyon checkpoint interaction blocked by movement timeout at tile (6,3)"
**Notes:** Checkpoint interaction blocked by movement timeout.

### Criterion 8: Drone patrol triggers battle transition and battle debug snapshot hotkey works
**Status:** PASS
**Screenshot:** screenshots/12-battle-entry.png
**Notes:** Battle transition succeeded and debug snapshot log was captured from `I` hotkey.

### Criterion 9: Load/Continue flow uses persisted save state
**Status:** PASS
**Screenshot:** screenshots/14-continue-after-load.png
**Notes:** Reload to menu and continue/load flow worked with valid persisted scene key.

## Artifacts
- Script: `/workspace/qa_browser_workflow40.py`
- Raw results: `/workspace/qa_results_workflow40.json`
- Screenshots directory: `/workspace/screenshots`
