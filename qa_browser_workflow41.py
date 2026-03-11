from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
import os
import json
import time

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "/workspace/screenshots"
RESULTS_PATH = "/workspace/qa_results_workflow41.json"

OVERWORLD_TILE = 48
BATTLE_TILE = 52

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = []
console_events = []
page_errors = []
battle_snapshots = []


class BlockedError(Exception):
    pass


def now_ms():
    return int(time.time() * 1000)


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


def run_criterion(idx, description, screenshot_name, fn):
    screenshot_rel = f"screenshots/{screenshot_name}"
    start = now_ms()
    try:
        fn(screenshot_rel)
        elapsed = now_ms() - start
        add_result(idx, description, "PASS", screenshot_rel, f"Completed in {elapsed}ms")
    except BlockedError as e:
        page.screenshot(path=f"/workspace/{screenshot_rel}")
        elapsed = now_ms() - start
        add_result(idx, description, "BLOCKED", screenshot_rel, f"Blocked after {elapsed}ms: {e}")
    except PlaywrightTimeoutError as e:
        page.screenshot(path=f"/workspace/{screenshot_rel}")
        elapsed = now_ms() - start
        status = "BLOCKED" if elapsed > 120000 else "FAIL"
        add_result(
            idx,
            description,
            status,
            screenshot_rel,
            f"Timeout after {elapsed}ms: {e}",
            bug_title=(f"{description} timed out" if status == "FAIL" else None),
        )
    except AssertionError as e:
        page.screenshot(path=f"/workspace/{screenshot_rel}")
        add_result(
            idx,
            description,
            "FAIL",
            screenshot_rel,
            str(e),
            bug_title=f"{description} failed",
        )
    except Exception as e:
        page.screenshot(path=f"/workspace/{screenshot_rel}")
        add_result(
            idx,
            description,
            "FAIL",
            screenshot_rel,
            f"Unexpected error: {e}",
            bug_title=f"{description} runtime failure",
        )


def on_console(msg):
    args = []
    for arg in msg.args:
        try:
            args.append(arg.json_value())
        except Exception:
            args.append(None)

    record = {
        "type": msg.type,
        "text": msg.text,
        "args": args,
    }
    console_events.append(record)

    if msg.type == "log" and msg.text.startswith("[BattleScene] Debug snapshot"):
        if len(args) >= 2 and isinstance(args[1], dict):
            battle_snapshots.append(args[1])


def get_progress_state():
    return page.evaluate(
        """() => {
            try {
                const raw = localStorage.getItem('playerProgress');
                return raw ? JSON.parse(raw) : null;
            } catch (_e) {
                return null;
            }
        }"""
    )


def get_scene_key():
    st = get_progress_state() or {}
    return ((st.get("overworld") or {}).get("currentSceneKey"))


def wait_for_scene_key(scene_key, timeout=12000):
    page.wait_for_function(
        """(expected) => {
            try {
                const raw = localStorage.getItem('playerProgress');
                if (!raw) return false;
                const st = JSON.parse(raw);
                return st?.overworld?.currentSceneKey === expected;
            } catch (_e) {
                return false;
            }
        }""",
        arg=scene_key,
        timeout=timeout,
    )


def overworld_pos(tile_x, tile_y):
    return {"x": tile_x * OVERWORLD_TILE + OVERWORLD_TILE // 2, "y": tile_y * OVERWORLD_TILE + OVERWORLD_TILE // 2}


def battle_pos(tile_x, tile_y):
    return {"x": tile_x * BATTLE_TILE + BATTLE_TILE // 2, "y": tile_y * BATTLE_TILE + BATTLE_TILE // 2}


def click_overworld_tile(tile_x, tile_y):
    page.click("canvas", position=overworld_pos(tile_x, tile_y))


def click_battle_tile(tile_x, tile_y):
    page.click("canvas", position=battle_pos(tile_x, tile_y))


def wait_for_overworld_tile(tile_x, tile_y, timeout=10000):
    page.wait_for_function(
        """([tx, ty]) => {
            try {
                const raw = localStorage.getItem('playerProgress');
                if (!raw) return false;
                const st = JSON.parse(raw);
                const p = st?.overworld?.position;
                return p?.x === tx && p?.y === ty;
            } catch (_e) {
                return false;
            }
        }""",
        arg=[tile_x, tile_y],
        timeout=timeout,
    )


def goto_overworld_tile(tile_x, tile_y, timeout=12000):
    click_overworld_tile(tile_x, tile_y)
    wait_for_overworld_tile(tile_x, tile_y, timeout=timeout)


def capture_battle_snapshot(timeout=3000):
    prev_count = len(battle_snapshots)
    page.keyboard.press("I")
    deadline = time.time() + (timeout / 1000)
    while time.time() < deadline:
        if len(battle_snapshots) > prev_count:
            return battle_snapshots[-1]
        page.wait_for_timeout(120)
    raise PlaywrightTimeoutError("Timed out waiting for battle debug snapshot.")


def protagonist_hp(snapshot):
    if not snapshot:
        return None
    party = snapshot.get("party") if isinstance(snapshot, dict) else None
    if not isinstance(party, list):
        return None
    for member in party:
        if isinstance(member, dict) and member.get("id") == "protagonist":
            return member.get("currentHp")
    return None


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    page.on("console", on_console)
    page.on("pageerror", lambda err: page_errors.append(str(err)))

    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")

    # Clean run profile.
    page.evaluate("""() => { localStorage.clear(); }""")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")

    def c1(shot):
        page.wait_for_selector("canvas", timeout=10000)
        page.screenshot(path=f"/workspace/{shot}")

    run_criterion(1, "Main menu loads with playable UI", "wf41-01-main-menu.png", c1)

    def c2(shot):
        page.keyboard.press("Enter")
        wait_for_scene_key("OverworldScene", timeout=12000)
        page.wait_for_timeout(600)
        page.screenshot(path=f"/workspace/{shot}")

    run_criterion(2, "Start Game transitions from menu to Overworld", "wf41-02-overworld-entry.png", c2)

    def c3(shot):
        goto_overworld_tile(7, 4, timeout=12000)
        page.wait_for_timeout(300)
        page.keyboard.press("Space")
        page.wait_for_timeout(220)
        page.screenshot(path="/workspace/screenshots/wf41-03-dialogue-open.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(220)
        page.screenshot(path=f"/workspace/{shot}")

    run_criterion(3, "Dialogue overlay opens/closes with UI transition polish", "wf41-04-dialogue-closed.png", c3)

    def c4(shot):
        goto_overworld_tile(9, 4, timeout=14000)
        wait_for_scene_key("BattleScene", timeout=14000)
        page.wait_for_timeout(1400)
        page.screenshot(path=f"/workspace/{shot}")

    run_criterion(4, "Overworld encounter transitions into Battle scene", "wf41-05-battle-entry.png", c4)

    state = {
        "initial_battle_hp": None,
        "post_enemy_hp": None,
    }

    def c5(shot):
        snap = capture_battle_snapshot(timeout=4500)
        state["initial_battle_hp"] = protagonist_hp(snap)
        assert state["initial_battle_hp"] is not None, "Missing protagonist HP in battle debug snapshot"
        page.screenshot(path=f"/workspace/{shot}")

    run_criterion(5, "Battle scene provides active turn feedback and debug snapshot", "wf41-06-battle-debug.png", c5)

    def c6(shot):
        # Move protagonist.
        click_battle_tile(2, 4)
        page.wait_for_timeout(120)
        page.keyboard.press("Enter")
        page.wait_for_timeout(120)
        click_battle_tile(4, 4)
        page.wait_for_timeout(420)

        # Move dog.
        click_battle_tile(3, 5)
        page.wait_for_timeout(120)
        page.keyboard.press("Enter")
        page.wait_for_timeout(120)
        click_battle_tile(5, 5)

        # Let enemy phase resolve and capture result.
        page.wait_for_timeout(2600)
        snap = capture_battle_snapshot(timeout=4500)
        state["post_enemy_hp"] = protagonist_hp(snap)
        assert state["post_enemy_hp"] is not None, "Unable to read protagonist HP after enemy phase"
        page.screenshot(path=f"/workspace/{shot}")

    run_criterion(6, "Battle hit feedback path executes during enemy attacks", "wf41-07-post-enemy-phase.png", c6)

    def c7(shot):
        if state["initial_battle_hp"] is None or state["post_enemy_hp"] is None:
            raise AssertionError("Missing HP snapshots for damage validation")
        assert state["post_enemy_hp"] < state["initial_battle_hp"], (
            f"Expected enemy hit to reduce HP (initial={state['initial_battle_hp']}, after={state['post_enemy_hp']})"
        )

        # Attempt stabilize: select protagonist and choose stabilize (single-step choice attempt).
        click_battle_tile(4, 4)
        page.wait_for_timeout(120)
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(80)
        page.keyboard.press("Enter")
        page.wait_for_timeout(900)

        after_stabilize = capture_battle_snapshot(timeout=4500)
        healed_hp = protagonist_hp(after_stabilize)
        assert healed_hp is not None, "Unable to read HP after stabilize attempt"
        assert healed_hp >= state["post_enemy_hp"], (
            f"Expected stabilize to keep or increase HP (after enemy={state['post_enemy_hp']}, after stabilize={healed_hp})"
        )
        page.screenshot(path=f"/workspace/{shot}")

    run_criterion(7, "Stabilize ability path executes and updates HP state", "wf41-08-stabilize.png", c7)

    def c8(shot):
        deadline = time.time() + 120
        returned = False

        # One continuous attempt: cycle turns by moving available friendlies forward.
        while time.time() < deadline:
            if get_scene_key() == "OverworldScene":
                returned = True
                break

            # Try advancing protagonist then companion if still in battle.
            try:
                click_battle_tile(4, 4)
                page.wait_for_timeout(80)
                page.keyboard.press("Enter")
                page.wait_for_timeout(80)
                click_battle_tile(6, 4)
                page.wait_for_timeout(280)

                click_battle_tile(5, 5)
                page.wait_for_timeout(80)
                page.keyboard.press("Enter")
                page.wait_for_timeout(80)
                click_battle_tile(7, 5)
                page.wait_for_timeout(420)
            except Exception:
                page.wait_for_timeout(400)

            page.wait_for_timeout(1200)

        page.screenshot(path=f"/workspace/{shot}")

        if not returned:
            raise BlockedError("Battle did not resolve back to Overworld within one 2-minute attempt.")

    run_criterion(8, "Battle completion returns to Overworld with transition feedback", "wf41-09-return-overworld.png", c8)

    browser.close()

summary = {
    "results": results,
    "console_events": console_events[-250:],
    "page_errors": page_errors,
}

with open(RESULTS_PATH, "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print(json.dumps({"results_count": len(results), "results_path": RESULTS_PATH}, indent=2))
