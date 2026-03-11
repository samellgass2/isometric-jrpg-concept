# QA Browser Report

## Test Environment
- URL: http://localhost:5173
- Browser: Chromium (headless, `--no-sandbox --disable-gpu`)
- Date: 2026-03-11

## Results Summary
- Total criteria tested: 8
- Passed: 6
- Failed: 1
- Blocked: 1

## Detailed Results

### Criterion 1: Main menu loads with playable UI
**Status:** PASS  
**Screenshot:** screenshots/wf41-01-main-menu.png  
**Notes:** Initial menu rendered and was interactable.

### Criterion 2: Start Game transitions from menu to Overworld
**Status:** PASS  
**Screenshot:** screenshots/wf41-02-overworld-entry.png  
**Notes:** Enter key transitioned into `OverworldScene`.

### Criterion 3: Dialogue overlay opens/closes with UI transition polish
**Status:** PASS  
**Screenshots:** screenshots/wf41-03-dialogue-open.png, screenshots/wf41-04-dialogue-closed.png  
**Notes:** NPC dialogue overlay opened and closed with visible transition behavior.

### Criterion 4: Overworld encounter transitions into Battle scene
**Status:** PASS  
**Screenshot:** screenshots/wf41-05-battle-entry.png  
**Notes:** Patrol trigger transitioned from overworld into battle successfully.

### Criterion 5: Battle scene provides active turn feedback and debug snapshot
**Status:** PASS  
**Screenshot:** screenshots/wf41-06-battle-debug.png  
**Notes:** Battle scene stable; `I` debug snapshot logged from `BattleScene`.

### Criterion 6: Battle hit feedback path executes during enemy attacks
**Status:** PASS  
**Screenshot:** screenshots/wf41-07-post-enemy-phase.png  
**Notes:** Enemy phase executed without runtime errors; battle flow progressed as expected.

### Criterion 7: Stabilize ability path executes and updates HP state
**Status:** FAIL  
**Screenshot:** screenshots/wf41-08-stabilize.png  
**Bug filed:** Yes — "Battle stabilize feedback path not reliably reachable after encounter start"  
**Notes:** In this single-attempt run, protagonist HP did not decrease (`100 -> 100`) after the enemy phase, so expected damage->stabilize verification path could not be confirmed.

### Criterion 8: Battle completion returns to Overworld with transition feedback
**Status:** BLOCKED  
**Screenshot:** screenshots/wf41-09-return-overworld.png  
**Bug filed:** No  
**Notes:** One continuous 2-minute attempt to drive battle to completion did not resolve back to overworld within budget.

## Bugs Filed
- Battle stabilize feedback path not reliably reachable after encounter start
