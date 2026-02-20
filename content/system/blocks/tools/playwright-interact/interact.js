const { chromium } = require('playwright');

// Resolve Playwright-style selectors: role=button[name='Submit'], text=Submit, label=Email
function resolveSelector(sel) {
  if (!sel) return null;
  if (sel.startsWith('role=')) {
    const match = sel.match(/^role=(\w+)\[name='(.+)'\]$/);
    if (match) return `role=${match[1]}[name="${match[2]}"]`;
    return sel;  // pass through for Playwright to interpret
  }
  if (sel.startsWith('text=')) return sel;
  if (sel.startsWith('label=')) return sel;
  // CSS selectors pass through directly
  return sel;
}

(async () => {
  const action = process.env.MAESTRO_INPUT_ACTION;
  const url = process.env.MAESTRO_INPUT_URL || '';
  const selector = process.env.MAESTRO_INPUT_SELECTOR || '';
  const text = process.env.MAESTRO_INPUT_TEXT || '';
  const value = process.env.MAESTRO_INPUT_VALUE || '';
  const timeout = parseInt(process.env.MAESTRO_INPUT_TIMEOUT || '5000', 10);

  if (!action) {
    console.log(JSON.stringify({ success: false, error: 'Missing required input: action', result: null, pageTitle: '', currentUrl: '' }));
    process.exit(0);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // If url is provided for non-navigate actions, navigate first
    if (action !== 'navigate' && url) {
      await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    }

    let result = '';
    const resolved = resolveSelector(selector);

    switch (action) {
      case 'navigate':
        if (!url) throw new Error('navigate action requires url input');
        await page.goto(url, { waitUntil: 'load', timeout: 20000 });
        result = `Navigated to ${url}`;
        break;

      case 'click':
        if (!resolved) throw new Error('click action requires selector input');
        await page.locator(resolved).click({ timeout });
        result = `Clicked ${selector}`;
        break;

      case 'type':
        if (!resolved) throw new Error('type action requires selector input');
        if (!text) throw new Error('type action requires text input');
        await page.locator(resolved).fill(text, { timeout });
        result = `Typed "${text}" into ${selector}`;
        break;

      case 'select':
        if (!resolved) throw new Error('select action requires selector input');
        if (!value) throw new Error('select action requires value input');
        await page.locator(resolved).selectOption(value, { timeout });
        result = `Selected "${value}" in ${selector}`;
        break;

      case 'scroll':
        if (resolved) {
          await page.locator(resolved).scrollIntoViewIfNeeded({ timeout });
          result = `Scrolled to ${selector}`;
        } else {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          result = 'Scrolled to bottom of page';
        }
        break;

      case 'wait':
        if (!resolved) throw new Error('wait action requires selector input');
        await page.locator(resolved).waitFor({ state: 'visible', timeout });
        result = `Element ${selector} is visible`;
        break;

      case 'evaluate':
        if (!text) throw new Error('evaluate action requires text input (JS code)');
        const evalResult = await page.evaluate(text);
        result = typeof evalResult === 'object' ? JSON.stringify(evalResult) : String(evalResult);
        break;

      default:
        throw new Error(`Unknown action: ${action}. Supported: navigate, click, type, select, scroll, wait, evaluate`);
    }

    console.log(JSON.stringify({
      success: true,
      result,
      pageTitle: await page.title(),
      currentUrl: page.url()
    }));
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message, result: null, pageTitle: '', currentUrl: '' }));
  } finally {
    if (browser) await browser.close();
  }
})();
