# QA Browser Report

## Test Environment
- URL: http://localhost:5173
- Browser: Chromium (headless)
- Date: 2026-03-11
- Method: One-pass Playwright script (`/workspace/qa_browser_workflow40.py`), no retries

## Results Summary
- Total criteria tested: 9
- Passed: 3
- Failed: 1
- Blocked: 5

## Detailed Results

### Criterion 1: Main menu initial state loads
**Status:** PASS  
**Screenshot:** `screenshots/01-main-menu.png`  
**Notes:** Canvas and menu UI rendered.

### Criterion 2: Start Game enters Overworld scene
**Status:** PASS  
**Screenshot:** `screenshots/02-overworld-entry.png`  
**Notes:** Enter key transitioned from menu to Overworld.

### Criterion 3: Ranger dialogue progression sets tutorial completion flag
**Status:** BLOCKED  
**Screenshot:** `screenshots/05-ranger-dialogue-complete.png`  
**Bug filed:** Yes — "Overworld click-to-move does not move player"  
**Notes:** Player did not move from spawn when clicking destination tiles, so Ranger interaction path could not be reached in this one-attempt run.

### Criterion 4: Mechanic interaction unlocks workshop gate progression
**Status:** BLOCKED  
**Screenshot:** `screenshots/08-mechanic-dialogue-complete.png`  
**Bug filed:** Yes — "Overworld click-to-move does not move player"  
**Notes:** Dependent on overworld movement; blocked by same navigation defect.

### Criterion 5: Workshop gate interaction prompt is available after unlock
**Status:** BLOCKED  
**Screenshot:** `screenshots/09-workshop-gate-prompt.png`  
**Bug filed:** Yes — "Overworld click-to-move does not move player"  
**Notes:** Could not reliably position player for gate interaction due movement defect.

### Criterion 6: Supply cache pickup grants workshop pass and checkpoint unlock flag
**Status:** BLOCKED  
**Screenshot:** `screenshots/10-supply-cache-pickup.png`  
**Bug filed:** Yes — "Overworld click-to-move does not move player"  
**Notes:** Could not complete pickup route because click navigation failed.

### Criterion 7: Canyon checkpoint interaction works after pass unlock
**Status:** BLOCKED  
**Screenshot:** `screenshots/11-canyon-checkpoint-prompt.png`  
**Bug filed:** Yes — "Overworld click-to-move does not move player"  
**Notes:** Blocked by navigation defect and dependency on criterion 6.

### Criterion 8: Drone patrol triggers battle transition and battle debug snapshot hotkey works
**Status:** FAIL  
**Screenshot:** `screenshots/12-battle-entry.png`  
**Bug filed:** Yes — "Drone patrol battle transition renders black screen with runtime error"  
**Notes:** Transition resulted in black screen. Captured page errors: `Cannot read properties of undefined (reading 'setText')`.

### Criterion 9: Load/Continue flow uses persisted save state
**Status:** PASS  
**Screenshot:** `screenshots/14-continue-after-load.png`  
**Notes:** Continue flow executed and persisted scene key remained valid.

## Bugs Filed
1. Overworld click-to-move does not move player
2. Drone patrol battle transition renders black screen with runtime error

## Artifacts
- Script: `/workspace/qa_browser_workflow40.py`
- Raw results: `/workspace/qa_results_workflow40.json`
- Screenshots: `/workspace/screenshots/`
