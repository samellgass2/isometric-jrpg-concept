from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'])
    page=b.new_page()
    page.goto('http://localhost:5173',wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')
    st=page.evaluate("""() => {
      const raw=localStorage.getItem('playerProgress');
      if(!raw) return null;
      try {return JSON.parse(raw);} catch(e){return {parseError:String(e),raw};}
    }""")
    print(json.dumps(st,indent=2)[:4000])
    b.close()
