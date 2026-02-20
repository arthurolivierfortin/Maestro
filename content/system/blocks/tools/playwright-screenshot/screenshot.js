const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

(async () => {
  const url = process.env.MAESTRO_INPUT_URL;
  const outputPath = process.env.MAESTRO_INPUT_OUTPUT || path.join(os.tmpdir(), `maestro-screenshot-${Date.now()}.png`);
  const fullPage = process.env.MAESTRO_INPUT_FULLPAGE === 'true';
  const viewportStr = process.env.MAESTRO_INPUT_VIEWPORT || '1280x720';

  if (!url) {
    console.log(JSON.stringify({ success: false, error: 'Missing required input: url', filePath: null, width: 0, height: 0 }));
    process.exit(0);
  }

  const [vw, vh] = viewportStr.split('x').map(Number);
  const viewport = { width: vw || 1280, height: vh || 720 };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'load', timeout: 20000 });

    await page.screenshot({ path: outputPath, fullPage });

    const size = page.viewportSize();
    console.log(JSON.stringify({
      success: true,
      filePath: path.resolve(outputPath),
      width: size.width,
      height: fullPage ? (await page.evaluate(() => document.documentElement.scrollHeight)) : size.height
    }));
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message, filePath: null, width: 0, height: 0 }));
  } finally {
    if (browser) await browser.close();
  }
})();
