from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox','--disable-gpu'])
    page = browser.new_page()
    page.goto('http://localhost:5173', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    keys = page.evaluate('''() => ({
      hasPhaser: typeof window.Phaser !== 'undefined',
      hasGames: Array.isArray(window.Phaser?.GAMES),
      gamesLen: window.Phaser?.GAMES?.length || 0,
      gameKeys: Object.keys(window).filter(k => k.toLowerCase().includes('phaser') || k.toLowerCase().includes('game')).slice(0,30)
    })''')
    print(keys)
    # try click Start Game by Enter
    page.keyboard.press('Enter')
    page.wait_for_timeout(800)
    out = page.evaluate('''() => {
      const game = window.Phaser?.GAMES?.[0];
      const scenes = game?.scene?.scenes?.map(s => ({key:s.scene?.key, active:s.scene?.isActive(), visible:s.scene?.isVisible()})) || [];
      const active = game?.scene?.getScenes?.(true)?.map(s => s.scene?.key) || [];
      return {hasGame: !!game, scenes, active};
    }''')
    print(out)
    browser.close()
