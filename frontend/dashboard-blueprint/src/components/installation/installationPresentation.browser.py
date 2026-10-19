"""Local component fixture QA, not an authenticated business workflow test.
Start dashboard-blueprint with `npm run dev -- --host 127.0.0.1 --port 5194 --strictPort`,
then run this file with a Python environment containing Playwright + Chromium.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright, expect

base = os.environ.get("INSTALLATION_QA_BASE_URL", "http://127.0.0.1:5194")
output = Path(os.environ.get("INSTALLATION_QA_OUTPUT", os.environ.get("TMPDIR", ".")))
output.mkdir(parents=True, exist_ok=True)
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width in (375, 768, 1440):
        context = browser.new_context(viewport={"width": width, "height": 1000}, has_touch=True)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(f"{base}/src/components/installation/installationQa.fixture.html")
        help_button = page.get_by_label("Help for customer type scores")
        help_button.wait_for()
        help_button.focus()
        expect(page.get_by_role("tooltip")).to_be_visible()
        expect(help_button).to_have_attribute("aria-expanded", "true")
        page.keyboard.press("Escape")
        expect(page.get_by_role("tooltip")).to_have_count(0)
        help_button.evaluate("element => element.blur()")
        help_button.hover()
        expect(page.get_by_role("tooltip")).to_be_visible()
        page.mouse.move(0, 0)
        expect(page.get_by_role("tooltip")).to_have_count(0)
        help_button.tap()
        tooltip = page.get_by_role("tooltip")
        expect(tooltip).to_be_visible()
        bounds = tooltip.bounding_box()
        assert bounds and bounds["x"] >= 0 and bounds["x"] + bounds["width"] <= width, bounds
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
        page.screenshot(path=str(output / f"installation-qa-{width}.png"), full_page=True)
        assert not errors, errors
        print(f"{width}: focus, Escape, hover, touch, popover bounds, overflow and page errors PASS")
        context.close()
    browser.close()
