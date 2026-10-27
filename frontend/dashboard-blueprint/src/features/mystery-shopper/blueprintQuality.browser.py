"""Isolated production-component browser regression; no server/auth/API needed.
Run after npm run build: python <this-file> --output <scratch-directory>.
Requires Playwright Chromium. Rebundles actual production imports every run.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--css-dir', type=Path, help='Built assets directory (outside source is supported)')
args = parser.parse_args()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
frontend = Path(__file__).resolve().parents[3]
entry = Path(__file__).with_name('blueprintQuality.fixture.jsx')
js = subprocess.check_output(['node', '--input-type=module', '-e', '''
import { build } from 'esbuild';
const result = await build({entryPoints:[process.argv[1]],bundle:true,write:false,jsx:'automatic',format:'iife'});
process.stdout.write(result.outputFiles[0].text);
''', str(entry)], cwd=frontend, text=True)
cssfiles = sorted((args.css_dir or frontend / 'dist/assets').glob('*.css'))
assert cssfiles, 'Run npm run build first'
css = '\n'.join(p.read_text() for p in cssfiles)
html = out / 'blueprint-quality-fixed.html'
html.write_text('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + css + '</style></head><body><div id="root"></div><script>' + js.replace('</script', '<\\/script') + '</script></body></html>')
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in (375, 768, 1440):
        for mode in ('populated', 'zero', 'empty'):
            context = browser.new_context(viewport={'width': width, 'height': 1000}, has_touch=True)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('http://**/*', lambda route: route.abort())
            page.route('https://**/*', lambda route: route.abort())
            page.goto(html.as_uri() + '#' + mode)
            category = page.get_by_test_id('category-scores')
            expect(category).to_be_visible()
            rows = category.locator('[data-category-score]')
            if mode == 'empty':
                expect(rows).to_have_count(0)
                expect(category).to_contain_text('No category scores are available')
            else:
                expect(rows).to_have_count(3)
                expected = [('1–5', '4.00', '2 scored responses'), ('0–5', '2.00', '1 scored response'), ('0–10', '0.00' if mode == 'zero' else '8.50', '3 scored responses')]
                for scale, value, count in expected:
                    row = rows.filter(has_text='Declared scale: ' + scale)
                    expect(row).to_have_count(1)
                    expect(row).to_contain_text(value)
                    expect(row).to_contain_text(count)
                    assert row.evaluate('(e)=>e.scrollWidth<=e.clientWidth'), 'category row clipped'
            help_results = []
            # Actual Tab navigation, then Escape, hover persistence, touch, outside dismissal.
            for index, label in enumerate(('B2B score help at left edge', 'B2B score help at right edge', 'B2B help at bottom edge')):
                button = page.get_by_role('button', name=label, exact=True)
                if index == 0:
                    page.keyboard.press('Tab')
                else:
                    button.focus()
                    page.keyboard.press('Tab')
                    page.keyboard.press('Shift+Tab')
                expect(button).to_be_focused()
                tip = page.get_by_role('tooltip')
                expect(tip).to_be_visible()
                assert button.get_attribute('aria-describedby') == tip.get_attribute('id')
                assert button.evaluate('(e)=>getComputedStyle(e).boxShadow') != 'none'
                def bounds():
                    box = tip.bounding_box()
                    assert box and box['x'] >= 0 and box['y'] >= 0
                    assert box['x'] + box['width'] <= width and box['y'] + box['height'] <= 1000
                    assert tip.evaluate('(e)=>e.scrollWidth<=e.clientWidth')
                    return box
                focus_box = bounds()
                page.keyboard.press('Escape')
                expect(tip).to_have_count(0)
                expect(button).to_be_focused()
                button.evaluate('(e)=>e.blur()')
                button.hover()
                expect(tip).to_be_visible()
                tip.hover()
                page.wait_for_timeout(180)
                expect(tip).to_be_visible()
                page.mouse.move(0, 0)
                expect(tip).to_have_count(0)
                button.tap()
                expect(tip).to_be_visible()
                touch_box = bounds()
                if mode == 'populated' and index == 0:
                    page.screenshot(path=str(out / f'blueprint-quality-fixed-help-{width}.png'))
                page.keyboard.press('Escape')
                expect(tip).to_have_count(0)
                button.tap()
                expect(tip).to_be_visible()
                page.touchscreen.tap(1, 500)
                expect(tip).to_have_count(0)
                help_results.append({'label': label, 'focusBounds': focus_box, 'touchBounds': touch_box, 'keyboardHoverTouchEscapeOutside': 'PASS'})
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'), 'document overflow'
            assert not errors, errors
            shot = out / f'blueprint-quality-fixed-{mode}-{width}.png'
            category.scroll_into_view_if_needed()
            page.screenshot(path=str(shot), full_page=True)
            results.append({'width': width, 'mode': mode, 'categoryRows': rows.all_text_contents(), 'readableOriginalScaleCounts': 'PASS', 'help': help_results, 'overflow': False, 'errors': errors, 'screenshot': str(shot)})
            context.close()
    browser.close()
assert len(results) == 9
sources = [entry, frontend/'src/components/shared/InfoHint.jsx', frontend/'src/features/mystery-shopper/components/MysteryAnalyticsSummarySection.jsx', frontend/'src/pages/DashboardPage.jsx']
report = {'scope': 'Isolated current production components, not authenticated full-dashboard E2E', 'cases': results, 'pass': True, 'fixture': str(html), 'sourceSHA256': {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}}
report_path = out/'blueprint-quality-fixed-results.json'
report_path.write_text(json.dumps(report, indent=2))
print(json.dumps({'pass': True, 'cases': len(results), 'helpChecks': sum(len(r['help']) for r in results), 'report': str(report_path), 'screenshots': [r['screenshot'] for r in results]}, indent=2))
