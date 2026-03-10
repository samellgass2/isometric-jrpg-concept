# Task Report

- Task ID: 350
- Run ID: 634
- Title: Profile current Phaser game performance
- Status: Completed

## Summary
Captured baseline performance profiles for exploration and battle gameplay using Chrome DevTools Protocol against two Chromium-based browsers (Chrome-for-Testing and Playwright Chromium), identified entrypoints and primary scenes, documented frame-time/FPS/input-latency observations, and recorded Firefox profiling limitations.

## What Was Profiled
- Local run command: `npm run dev` (`scripts/dev-server.mjs`, `http://127.0.0.1:5173`)
- Entrypoints:
  - `src/main.js`
  - `src/gameConfig.js`
- Primary gameplay scenes:
  - Overworld exploration: `src/scenes/OverworldScene.js`
  - Battle/high-action: `src/scenes/BattleScene.js`

## Tooling Used
- Chrome DevTools performance sampling via CDP (headless capture workflow)
- Browser 1: Chrome-for-Testing `146.0.7680.72`
- Browser 2: Playwright Chromium `136.0.7103.25`

## Baseline Results (Recorded)
- Idle/Overworld:
  - Chrome-for-Testing: ~57.2 FPS average, ~16.8 ms p95 frame time, 100 ms worst frame
  - Playwright Chromium: ~6.3 FPS average, ~383.3 ms p95 frame time, 433.2 ms worst frame
- Battle/High-action:
  - Chrome-for-Testing: ~60.0 FPS average, ~16.7 ms p95 frame time
  - Playwright Chromium: ~57.9 FPS average, ~16.8 ms p95 frame time, 133.4 ms worst frame

## Main Hotspots Observed
1. `OverworldScene.update` (`src/scenes/OverworldScene.js:1048`) as the continuous frame loop, including HUD/progress persistence calls.
2. `OverworldScene.findTilePath` (`src/scenes/OverworldScene.js:712`) BFS queue/neighbor traversal on pointer pathing.
3. `BattleScene.handleInputAction` / `handleConfirmAction` (`src/scenes/BattleScene.js:498`, `:583`) under high input rate.
4. `BattleScene.showHighlights` / `clearHighlights` (`src/scenes/BattleScene.js:829`, `:823`) object churn with GC samples during battle input bursts.

## Cross-Browser / Compatibility Notes
- Both Chromium-based runs were functional and battle stayed near 60 FPS average.
- Idle/exploration diverged materially in this environment (Chrome-for-Testing much faster than Playwright Chromium).
- Firefox profiling was not executed: Firefox runtime unavailable in the runner (`firefox: command not found`), so Firefox behavior/performance remains unvalidated and should be tested in a suitable environment.

## Validation
- Ran: `npm test`
- Result: PASS
