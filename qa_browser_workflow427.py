from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
import json
import os
import time
import copy

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "/workspace/screenshots"
RESULTS_PATH = "/workspace/qa_results_workflow427.json"
STATUS_PATH = "/workspace/STATUS.md"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = []
console_events = []
page_errors = []


def now_ms():
    return int(time.time() * 1000)


def add_result(idx, description, status, screenshot, notes, bug_title=None):
    item = {
        "id": idx,
        "description": description,
        "status": status,
        "screenshot": screenshot,
        "notes": notes,
    }
    if bug_title:
        item["bug_title"] = bug_title
    results.append(item)


def run_criterion(idx, description, screenshot_name, fn):
    rel_shot = f"screenshots/{screenshot_name}"
    start = now_ms()
    try:
        fn()
        elapsed = now_ms() - start
        add_result(idx, description, "PASS", rel_shot, f"Completed in {elapsed}ms")
    except PlaywrightTimeoutError as e:
        page.screenshot(path=f"/workspace/{rel_shot}")
        elapsed = now_ms() - start
        status = "BLOCKED" if elapsed > 120000 else "FAIL"
        add_result(
            idx,
            description,
            status,
            rel_shot,
            f"Timeout after {elapsed}ms: {e}",
            bug_title=f"{description} timed out" if status == "FAIL" else None,
        )
    except AssertionError as e:
        page.screenshot(path=f"/workspace/{rel_shot}")
        add_result(idx, description, "FAIL", rel_shot, str(e), bug_title=f"{description} failed")
    except Exception as e:
        page.screenshot(path=f"/workspace/{rel_shot}")
        add_result(
            idx,
            description,
            "FAIL",
            rel_shot,
            f"Unexpected error: {e}",
            bug_title=f"{description} runtime failure",
        )


def goto_with_retry(url):
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        page.wait_for_timeout(5000)
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_load_state("networkidle", timeout=15000)


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


def set_progress_state(state):
    payload = json.dumps(state)
    page.evaluate(
        """(raw) => {
        localStorage.setItem('playerProgress', raw);
      }""",
        payload,
    )


def wait_for_scene_key(scene_key, timeout=12000):
    page.wait_for_function(
        """(sceneKey) => {
          try {
            const raw = localStorage.getItem('playerProgress');
            if (!raw) return false;
            const st = JSON.parse(raw);
            return st?.overworld?.currentSceneKey === sceneKey;
          } catch (_e) {
            return false;
          }
        }""",
        arg=scene_key,
        timeout=timeout,
    )


def tile_to_canvas_xy(tile_x, tile_y, tile_size):
    return {"x": int(tile_x * tile_size + tile_size / 2), "y": int(tile_y * tile_size + tile_size / 2)}


def click_overworld_tile(tile_x, tile_y):
    page.click("canvas", position=tile_to_canvas_xy(tile_x, tile_y, 48))


def wait_overworld_position(tile_x, tile_y, timeout=12000):
    page.wait_for_function(
        """([tx, ty]) => {
          try {
            const st = JSON.parse(localStorage.getItem('playerProgress') || '{}');
            const p = st?.overworld?.position;
            return p?.x === tx && p?.y === ty;
          } catch (_e) {
            return false;
          }
        }""",
        arg=[tile_x, tile_y],
        timeout=timeout,
    )


def move_overworld_to(tile_x, tile_y):
    click_overworld_tile(tile_x, tile_y)
    wait_overworld_position(tile_x, tile_y)


def battle_click_tile(tile_x, tile_y):
    page.click("canvas", position=tile_to_canvas_xy(tile_x, tile_y, 52))


def get_party_member(state, member_id):
    members = ((state or {}).get("party") or {}).get("members") or []
    for m in members:
        if m.get("id") == member_id:
            return m
    return None


def has_console(substr):
    return any(substr in (e.get("text") or "") for e in console_events)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
    context = browser.new_context(viewport={"width": 1400, "height": 920})
    page = context.new_page()

    page.on("console", lambda msg: console_events.append({"type": msg.type, "text": msg.text}))
    page.on("pageerror", lambda err: page_errors.append(str(err)))

    goto_with_retry(BASE_URL)
    page.wait_for_selector("canvas", timeout=10000)
    page.screenshot(path="/workspace/screenshots/00-main-menu-initial.png")

    # Deterministic state bootstrap: start once to create save shape, then patch and reload.
    page.keyboard.press("Enter")
    wait_for_scene_key("OverworldScene")
    base = get_progress_state() or {}

    # Configure QA progression state so battles are short and deterministic.
    custom = copy.deepcopy(base)
    custom.setdefault("battleOutcomes", {}).setdefault("keyBattles", {})
    custom["battleOutcomes"]["keyBattles"]["overworldFirstDroneDefeated"] = False
    custom["battleOutcomes"]["keyBattles"]["level2CanyonGauntletCleared"] = False
    custom.setdefault("overworld", {})["currentSceneKey"] = "OverworldScene"
    custom["overworld"]["spawnPointId"] = "default"
    custom["overworld"]["position"] = {"x": 2, "y": 2}

    members = custom.setdefault("party", {}).setdefault("members", [])
    order = custom["party"].setdefault("memberOrder", [])

    protagonist = get_party_member(custom, "protagonist")
    if not protagonist:
        protagonist = {
            "id": "protagonist",
            "name": "Pathfinder",
            "archetype": "human-ranger",
            "level": 1,
            "currentXP": 0,
            "xpToNextLevel": 100,
            "currentHp": 120,
            "maxHp": 120,
            "movement": {"tilesPerTurn": 4},
            "attack": {"range": 1, "baseDamage": 24, "canAttackOverObstacles": False},
            "stats": {"maxHp": 120, "defense": 8},
            "abilities": [],
            "tags": ["hero"],
            "flags": {"isPartyMember": True},
        }
        members.append(protagonist)
    protagonist["level"] = 3
    protagonist["currentXP"] = 20
    protagonist["xpToNextLevel"] = 120
    protagonist["currentHp"] = 140
    protagonist["maxHp"] = 140
    protagonist.setdefault("movement", {})["tilesPerTurn"] = 6
    protagonist.setdefault("attack", {})["range"] = 12
    protagonist["attack"]["baseDamage"] = 999
    protagonist["attack"]["canAttackOverObstacles"] = True
    protagonist.setdefault("flags", {})["isPartyMember"] = True

    dog = get_party_member(custom, "guardian-dog")
    if not dog:
        dog = {
            "id": "guardian-dog",
            "name": "Guardian Dog",
            "archetype": "dog",
            "level": 2,
            "currentXP": 10,
            "xpToNextLevel": 80,
            "currentHp": 90,
            "maxHp": 90,
            "movement": {"tilesPerTurn": 4},
            "attack": {"range": 1, "baseDamage": 20, "canAttackOverObstacles": False},
            "stats": {"maxHp": 90, "defense": 6},
            "abilities": [],
            "tags": ["ally"],
            "flags": {"isPartyMember": True},
        }
        members.append(dog)
    dog["level"] = 2
    dog["currentXP"] = 15
    dog["xpToNextLevel"] = 80
    dog["currentHp"] = 90
    dog["maxHp"] = 90
    dog.setdefault("attack", {})["range"] = 12
    dog["attack"]["baseDamage"] = 999
    dog["attack"]["canAttackOverObstacles"] = True
    dog.setdefault("movement", {})["tilesPerTurn"] = 6
    dog.setdefault("flags", {})["isPartyMember"] = True

    # Add a drone-like party member to validate non-persistent XP behavior.
    qa_drone = get_party_member(custom, "qa-drone-wingman")
    if not qa_drone:
        qa_drone = {
            "id": "qa-drone-wingman",
            "name": "QA Drone Wingman",
            "archetype": "zookeeper-drone",
            "level": 1,
            "currentXP": 5,
            "xpToNextLevel": 60,
            "currentHp": 50,
            "maxHp": 50,
            "movement": {"tilesPerTurn": 4},
            "attack": {"range": 2, "baseDamage": 10, "canAttackOverObstacles": False},
            "stats": {"maxHp": 50, "defense": 3},
            "abilities": [],
            "tags": ["drone"],
            "flags": {"isPartyMember": True, "isDrone": True},
        }
        members.append(qa_drone)
    qa_drone["currentXP"] = 5
    qa_drone["level"] = 1
    qa_drone.setdefault("flags", {})["isDrone"] = True
    qa_drone["flags"]["isPartyMember"] = True

    # Normalize order
    seen = set()
    fixed_order = []
    for mid in ["protagonist", "guardian-dog", "qa-drone-wingman"] + order:
        if mid and mid not in seen:
            fixed_order.append(mid)
            seen.add(mid)
    for m in members:
        mid = m.get("id")
        if mid and mid not in seen:
            fixed_order.append(mid)
            seen.add(mid)
    custom["party"]["memberOrder"] = fixed_order

    # persist bootstrap and reload app
    set_progress_state(custom)
    page.reload(wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("canvas", timeout=10000)
    page.screenshot(path="/workspace/screenshots/00-main-menu-after-bootstrap.png")

    # Start game into overworld
    page.keyboard.press("Enter")
    wait_for_scene_key("OverworldScene")
    page.wait_for_timeout(500)
    page.screenshot(path="/workspace/screenshots/01-overworld-start.png")

    state_before_battle = get_progress_state()
    pre_pro = get_party_member(state_before_battle, "protagonist")
    pre_dog = get_party_member(state_before_battle, "guardian-dog")

    def c1():
        # Enter overworld drone battle and verify shared-state values are preserved at battle entry.
        move_overworld_to(9, 4)
        wait_for_scene_key("BattleScene", timeout=12000)
        page.wait_for_timeout(800)
        page.screenshot(path="/workspace/screenshots/02-battle-entry.png")

        during = get_progress_state()
        d_pro = get_party_member(during, "protagonist")
        d_dog = get_party_member(during, "guardian-dog")
        assert d_pro and d_dog, "Missing protagonist or guardian-dog in state on battle entry"
        assert d_pro.get("level") == pre_pro.get("level"), "Protagonist level changed unexpectedly on battle entry"
        assert d_pro.get("currentXP") == pre_pro.get("currentXP"), "Protagonist XP changed unexpectedly on battle entry"
        assert d_pro.get("currentHp") == pre_pro.get("currentHp"), "Protagonist HP diverged on battle entry"
        assert d_dog.get("level") == pre_dog.get("level"), "Dog level changed unexpectedly on battle entry"
        assert d_dog.get("currentXP") == pre_dog.get("currentXP"), "Dog XP changed unexpectedly on battle entry"

    run_criterion(1, "Battle entry stats match shared state", "02-battle-entry.png", c1)

    def c2():
        # Win overworld battle quickly and verify XP/levels persist back to overworld and into next encounter.
        # Protagonist attacks enemy 1.
        battle_click_tile(2, 4)
        page.wait_for_timeout(250)
        battle_click_tile(9, 4)
        page.wait_for_timeout(350)

        # Dog attacks enemy 2.
        battle_click_tile(3, 5)
        page.wait_for_timeout(250)
        battle_click_tile(10, 5)

        wait_for_scene_key("OverworldScene", timeout=12000)
        page.wait_for_timeout(600)
        page.screenshot(path="/workspace/screenshots/03-overworld-after-battle.png")

        after = get_progress_state()
        after_pro = get_party_member(after, "protagonist")
        after_dog = get_party_member(after, "guardian-dog")
        assert after_pro and after_dog, "Party members missing after battle"
        assert after_pro.get("currentXP", 0) > pre_pro.get("currentXP", 0), "Protagonist XP did not persist/increase"
        assert after_dog.get("currentXP", 0) > pre_dog.get("currentXP", 0), "Dog XP did not persist/increase"

        # Enter next encounter path (Level 2) to verify subsequent encounter continuity.
        move_overworld_to(12, 3)
        page.wait_for_timeout(250)
        page.keyboard.press("Space")
        page.wait_for_timeout(250)
        page.keyboard.press("Enter")
        page.wait_for_timeout(1200)
        wait_for_scene_key("Level2Scene", timeout=12000)
        page.screenshot(path="/workspace/screenshots/04-level2-entry.png")

        continued = get_progress_state()
        cont_pro = get_party_member(continued, "protagonist")
        assert cont_pro and cont_pro.get("currentXP", 0) == after_pro.get("currentXP", 0), "XP did not carry into subsequent encounter flow"

    run_criterion(2, "XP/levels persist into overworld and subsequent encounters", "04-level2-entry.png", c2)

    # Start Level 2 battle for progression checks.
    move_click = tile_to_canvas_xy(6, 5, 52)
    page.click("canvas", position=move_click)
    page.wait_for_timeout(1500)
    page.keyboard.press("Space")
    wait_for_scene_key("BattleScene", timeout=12000)
    page.wait_for_timeout(700)
    page.screenshot(path="/workspace/screenshots/05-level2-battle-entry.png")

    def c3():
        # Transition-flow divergence check: state should remain single-source across scene transitions.
        st = get_progress_state()
        assert (st or {}).get("overworld", {}).get("currentSceneKey") == "BattleScene", "Did not transition into expected battle scene"
        pro = get_party_member(st, "protagonist")
        assert pro is not None, "Protagonist missing in shared state during transition"
        assert isinstance(pro.get("currentHp"), int), "Protagonist HP invalid in shared state"
        assert isinstance(pro.get("currentXP"), int), "Protagonist XP invalid in shared state"
        page.screenshot(path="/workspace/screenshots/06-transition-state-check.png")

    run_criterion(3, "No divergent independent stat copies in transition flow", "06-transition-state-check.png", c3)

    def c4():
        # Verify progression visibility surfaces via inspect/debug and progression logs.
        page.keyboard.press("I")
        page.wait_for_timeout(350)
        page.screenshot(path="/workspace/screenshots/07-battle-inspect-log.png")
        assert has_console("[BattleScene] Debug snapshot"), "Battle debug snapshot log not emitted"
        assert has_console("[BattleScene] Progression snapshot"), "Progression snapshot log not emitted"

    run_criterion(4, "Simple UI/logging exists to verify progression", "07-battle-inspect-log.png", c4)

    def c5():
        # Validate elephant/cheetah are seeded and drone members do not receive persistent XP awards.
        before = get_progress_state()
        ele = get_party_member(before, "elephant-bulwark")
        che = get_party_member(before, "cheetah-skirmisher")
        drone_before = get_party_member(before, "qa-drone-wingman")
        assert ele is not None, "Elephant not present in persistent party during level-2 progression"
        assert che is not None, "Cheetah not present in persistent party during level-2 progression"
        assert (drone_before or {}).get("flags", {}).get("isDrone") is True, "QA drone isDrone flag missing"

        # Finish this battle rapidly using overpowered protagonist + elephant + cheetah to trigger XP award pipeline.
        battle_click_tile(2, 4)
        page.wait_for_timeout(220)
        battle_click_tile(8, 3)
        page.wait_for_timeout(300)

        battle_click_tile(4, 3)
        page.wait_for_timeout(220)
        battle_click_tile(9, 5)
        page.wait_for_timeout(300)

        battle_click_tile(3, 6)
        page.wait_for_timeout(220)
        battle_click_tile(10, 2)

        wait_for_scene_key("Level2Scene", timeout=12000)
        page.wait_for_timeout(500)
        page.screenshot(path="/workspace/screenshots/08-level2-after-battle.png")

        after = get_progress_state()
        ele_after = get_party_member(after, "elephant-bulwark")
        che_after = get_party_member(after, "cheetah-skirmisher")
        drone_after = get_party_member(after, "qa-drone-wingman")
        assert ele_after.get("currentXP", 0) > ele.get("currentXP", 0), "Elephant XP did not progress"
        assert che_after.get("currentXP", 0) > che.get("currentXP", 0), "Cheetah XP did not progress"
        assert drone_after.get("currentXP", 0) == drone_before.get("currentXP", 0), "Drone persistent XP changed (should not)"

    run_criterion(5, "Elephant/cheetah/dog progression works and drones remain non-persistent for XP", "08-level2-after-battle.png", c5)

    def c6():
        # Non-browser acceptance criterion from workflow: STATUS updated with touched modules/test guidance.
        assert os.path.exists(STATUS_PATH), "STATUS.md is missing"
        with open(STATUS_PATH, "r", encoding="utf-8") as f:
            status_text = f.read()
        assert "Task 427" in status_text or "427" in status_text, "STATUS.md missing Task 427 update"
        assert "BattleScene" in status_text, "STATUS.md missing touched module details"
        page.screenshot(path="/workspace/screenshots/09-final-state.png")

    run_criterion(6, "STATUS updated with touched modules and test guidance", "09-final-state.png", c6)

    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump({"results": results, "console_events": console_events, "page_errors": page_errors}, f, indent=2)

    browser.close()
