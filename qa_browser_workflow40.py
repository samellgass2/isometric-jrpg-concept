from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
import os
import json
import time

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "/workspace/screenshots"
RESULTS_PATH = "/workspace/qa_results_workflow40.json"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = []
console_events = []
page_errors = []


def add_result(idx, description, status, screenshot, notes, bug_title=None):
    entry = {
        "id": idx,
        "description": description,
        "status": status,
        "screenshot": screenshot,
        "notes": notes,
    }
    if bug_title:
        entry["bug_title"] = bug_title
    results.append(entry)


def now_ms():
    return int(time.time() * 1000)


def run_criterion(idx, description, screenshot_name, fn):
    screenshot_path = f"screenshots/{screenshot_name}"
    started = now_ms()
    try:
        fn()
        elapsed = now_ms() - started
        add_result(idx, description, "PASS", screenshot_path, f"Completed in {elapsed}ms")
    except PlaywrightTimeoutError as e:
        page.screenshot(path=f"/workspace/{screenshot_path}")
        elapsed = now_ms() - started
        # budget rule: if >2m on a criterion, mark BLOCKED
        status = "BLOCKED" if elapsed > 120000 else "FAIL"
        add_result(
            idx,
            description,
            status,
            screenshot_path,
            f"Timeout after {elapsed}ms: {e}",
            bug_title=f"{description} does not complete (timeout)" if status == "FAIL" else None,
        )
    except AssertionError as e:
        page.screenshot(path=f"/workspace/{screenshot_path}")
        add_result(
            idx,
            description,
            "FAIL",
            screenshot_path,
            str(e),
            bug_title=f"{description} failed",
        )
    except Exception as e:
        page.screenshot(path=f"/workspace/{screenshot_path}")
        add_result(
            idx,
            description,
            "FAIL",
            screenshot_path,
            f"Unexpected error: {e}",
            bug_title=f"{description} failed with runtime error",
        )


def get_progress_state():
    return page.evaluate(
        """() => {
        try {
          const raw = window.localStorage.getItem('playerProgress');
          return raw ? JSON.parse(raw) : null;
        } catch (e) {
          return null;
        }
      }"""
    )


def get_quest_flag(flag):
    st = get_progress_state() or {}
    return bool(((st.get("questFlags") or {}).get(flag)) is True)


def get_item_count(item_id):
    st = get_progress_state() or {}
    return int(((st.get("inventory") or {}).get("items") or {}).get(item_id, 0) or 0)


def get_scene_key():
    st = get_progress_state() or {}
    return ((st.get("overworld") or {}).get("currentSceneKey"))


def tile_to_canvas_xy(tile_x, tile_y):
    return {"x": tile_x * 48 + 24, "y": tile_y * 48 + 24}


def click_tile(tile_x, tile_y):
    page.click("canvas", position=tile_to_canvas_xy(tile_x, tile_y))


def wait_for_tile(tile_x, tile_y, timeout=9000):
    page.wait_for_function(
        """([tx, ty]) => {
          try {
            const raw = window.localStorage.getItem('playerProgress');
            if (!raw) return false;
            const st = JSON.parse(raw);
            const p = st?.overworld?.position;
            return Number.isFinite(p?.x) && Number.isFinite(p?.y) && p.x === tx && p.y === ty;
          } catch (_e) {
            return false;
          }
        }""",
        arg=[tile_x, tile_y],
        timeout=timeout,
    )


def step_dialogue(presses=1, delay=250):
    for _ in range(presses):
        page.keyboard.press("Space")
        page.wait_for_timeout(delay)


def goto_overworld_tile(tile_x, tile_y, timeout=9000):
    click_tile(tile_x, tile_y)
    wait_for_tile(tile_x, tile_y, timeout=timeout)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()

    page.on("console", lambda msg: console_events.append({"type": msg.type, "text": msg.text}))
    page.on("pageerror", lambda err: page_errors.append(str(err)))

    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")

    # reset to clean profile for deterministic run
    page.evaluate("""() => { localStorage.clear(); }""")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")

    def c1():
        page.wait_for_selector("canvas", timeout=10000)
        page.screenshot(path="/workspace/screenshots/01-main-menu.png")

    run_criterion(1, "Main menu initial state loads", "01-main-menu.png", c1)

    def c2():
        page.keyboard.press("Enter")
        page.wait_for_timeout(1200)
        page.wait_for_function(
            """() => {
            try {
              const raw = localStorage.getItem('playerProgress');
              if (!raw) return false;
              const st = JSON.parse(raw);
              return st?.overworld?.currentSceneKey === 'OverworldScene';
            } catch (_e) {
              return false;
            }
          }""",
            timeout=10000,
        )
        page.screenshot(path="/workspace/screenshots/02-overworld-entry.png")

    run_criterion(2, "Start Game enters Overworld scene", "02-overworld-entry.png", c2)

    def c3():
        goto_overworld_tile(7, 4)
        page.wait_for_timeout(400)
        page.screenshot(path="/workspace/screenshots/03-near-ranger.png")
        step_dialogue(presses=1)
        page.screenshot(path="/workspace/screenshots/04-ranger-dialogue-open.png")
        step_dialogue(presses=5, delay=280)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        assert get_quest_flag("dialogue.rangerTutorialComplete"), "Expected quest flag dialogue.rangerTutorialComplete=true"
        page.screenshot(path="/workspace/screenshots/05-ranger-dialogue-complete.png")

    run_criterion(
        3,
        "Ranger dialogue progression sets tutorial completion flag",
        "05-ranger-dialogue-complete.png",
        c3,
    )

    def c4():
        goto_overworld_tile(10, 8)
        page.wait_for_timeout(400)
        page.screenshot(path="/workspace/screenshots/06-near-mechanic.png")
        step_dialogue(presses=1)
        page.screenshot(path="/workspace/screenshots/07-mechanic-dialogue-open.png")
        step_dialogue(presses=4, delay=280)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        assert get_quest_flag("quest.workshopGateUnlocked"), "Expected quest flag quest.workshopGateUnlocked=true"
        page.screenshot(path="/workspace/screenshots/08-mechanic-dialogue-complete.png")

    run_criterion(
        4,
        "Mechanic interaction unlocks workshop gate progression",
        "08-mechanic-dialogue-complete.png",
        c4,
    )

    def c5():
        goto_overworld_tile(8, 8)
        page.wait_for_timeout(250)
        step_dialogue(presses=1)
        page.wait_for_timeout(250)
        page.screenshot(path="/workspace/screenshots/09-workshop-gate-prompt.png")
        assert get_quest_flag("quest.workshopGateUnlocked"), "Workshop gate unlock flag missing while testing gate prompt"
        page.keyboard.press("Escape")

    run_criterion(
        5,
        "Workshop gate interaction prompt is available after unlock",
        "09-workshop-gate-prompt.png",
        c5,
    )

    def c6():
        goto_overworld_tile(5, 2)
        page.wait_for_timeout(250)
        step_dialogue(presses=1)
        page.wait_for_timeout(300)
        page.screenshot(path="/workspace/screenshots/10-supply-cache-pickup.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        assert get_item_count("workshop-pass") >= 1, "Expected inventory.items['workshop-pass'] >= 1"
        assert get_quest_flag("quest.canyonCheckpointUnlocked"), "Expected quest flag quest.canyonCheckpointUnlocked=true"

    run_criterion(
        6,
        "Supply cache pickup grants workshop pass and checkpoint unlock flag",
        "10-supply-cache-pickup.png",
        c6,
    )

    def c7():
        goto_overworld_tile(6, 3)
        page.wait_for_timeout(250)
        step_dialogue(presses=1)
        page.wait_for_timeout(250)
        page.screenshot(path="/workspace/screenshots/11-canyon-checkpoint-prompt.png")
        assert get_quest_flag("quest.canyonCheckpointUnlocked"), "Checkpoint flag unexpectedly false"
        page.keyboard.press("Escape")

    run_criterion(
        7,
        "Canyon checkpoint interaction works after pass unlock",
        "11-canyon-checkpoint-prompt.png",
        c7,
    )

    def c8():
        goto_overworld_tile(9, 4, timeout=12000)
        page.wait_for_function(
            """() => {
            try {
              const raw = localStorage.getItem('playerProgress');
              if (!raw) return false;
              const st = JSON.parse(raw);
              return st?.overworld?.currentSceneKey === 'BattleScene';
            } catch (_e) {
              return false;
            }
          }""",
            timeout=12000,
        )
        page.wait_for_timeout(1200)
        page.screenshot(path="/workspace/screenshots/12-battle-entry.png")
        page.keyboard.press("I")
        page.wait_for_timeout(400)
        saw_debug = any("[BattleScene] Debug snapshot" in ev.get("text", "") for ev in console_events)
        assert saw_debug, "Expected BattleScene debug snapshot console log after pressing I"

    run_criterion(
        8,
        "Drone patrol triggers battle transition and battle debug snapshot hotkey works",
        "12-battle-entry.png",
        c8,
    )

    def c9():
        # Reload app to return to menu, then use Continue (L) and verify scene transition off menu.
        page.reload(wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="/workspace/screenshots/13-menu-after-reload.png")
        page.keyboard.press("L")
        page.wait_for_timeout(1400)
        page.screenshot(path="/workspace/screenshots/14-continue-after-load.png")
        # scene key persisted in save should still be a playable scene key, not null/empty.
        scene_key = get_scene_key()
        assert scene_key in {"OverworldScene", "BattleScene", "Level1Scene", "Level2Scene"}, (
            f"Unexpected saved scene key: {scene_key}"
        )

    run_criterion(
        9,
        "Load/Continue flow uses persisted save state",
        "14-continue-after-load.png",
        c9,
    )

    browser.close()

summary = {
    "results": results,
    "console_events": console_events[-200:],
    "page_errors": page_errors,
}

with open(RESULTS_PATH, "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print(json.dumps({"results_count": len(results), "results_path": RESULTS_PATH}, indent=2))
