const { chromium } = require('playwright');

function countNodes(text) {
  if (!text) return 0;
  // Count lines that start with '- ' (each is a node in the aria snapshot)
  return text.split('\n').filter(line => line.trim().startsWith('- ')).length;
}

function parseAriaSnapshot(text) {
  // Parse the YAML-like aria snapshot into a structured JSON tree
  if (!text) return null;

  const lines = text.split('\n');
  const root = { role: 'root', children: [] };
  const stack = [{ node: root, indent: -1 }];

  for (const line of lines) {
    if (!line.trim()) continue;

    const indent = line.search(/\S/);
    const content = line.trim();

    if (!content.startsWith('- ')) continue;

    const nodeText = content.slice(2); // remove '- '

    // Parse the node from aria snapshot format
    // Formats: "role \"name\" [attrs]: text", "role \"name\" [attrs]", "role: text", "role:", "/prop: value"
    let node = {};

    // Property line like "/url: https://..."
    if (nodeText.startsWith('/')) {
      const propMatch = nodeText.match(/^\/(\w+):\s*(.+)$/);
      if (propMatch) {
        node.role = 'property';
        node.name = propMatch[1];
        node.value = propMatch[2];
      } else {
        node.role = 'property';
        node.text = nodeText;
      }
    } else {
      // Try matching: role "name" [attrs]: text
      const roleNameMatch = nodeText.match(/^([\w-]+)(?:\s+"([^"]*)")?(?:\s+\[(.+)\])?(?::(?:\s*(.+))?)?$/);
      if (roleNameMatch) {
        node.role = roleNameMatch[1];
        if (roleNameMatch[2]) node.name = roleNameMatch[2];
        if (roleNameMatch[3]) {
          // Parse attributes like level=1
          const attrs = roleNameMatch[3].split(',').map(a => a.trim());
          for (const attr of attrs) {
            const eqIdx = attr.indexOf('=');
            if (eqIdx > 0) {
              const key = attr.slice(0, eqIdx);
              const val = attr.slice(eqIdx + 1);
              node[key] = isNaN(val) ? val : Number(val);
            }
          }
        }
        if (roleNameMatch[4]) node.text = roleNameMatch[4].trim();
      } else {
        node.role = 'unknown';
        node.text = nodeText;
      }
    }

    node.children = [];

    // Pop stack entries with indent >= current
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    // Add to parent
    const parent = stack[stack.length - 1].node;
    parent.children.push(node);

    stack.push({ node, indent });
  }

  // Clean up: remove empty children arrays
  function clean(n) {
    if (n.children && n.children.length === 0) delete n.children;
    if (n.children) n.children.forEach(clean);
    return n;
  }

  clean(root);
  return root.children && root.children.length === 1 ? root.children[0] : root;
}

(async () => {
  const url = process.env.MAESTRO_INPUT_URL;
  const selector = process.env.MAESTRO_INPUT_SELECTOR || null;

  if (!url) {
    console.log(JSON.stringify({ success: false, error: 'Missing required input: url', tree: null, nodeCount: 0 }));
    process.exit(0);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'load', timeout: 20000 });

    let snapshotText;
    if (selector) {
      const element = page.locator(selector);
      const count = await element.count();
      if (count === 0) {
        console.log(JSON.stringify({ success: false, error: `Selector '${selector}' not found`, tree: null, nodeCount: 0 }));
        await browser.close();
        process.exit(0);
      }
      snapshotText = await element.ariaSnapshot();
    } else {
      snapshotText = await page.locator(':root').ariaSnapshot();
    }

    const tree = parseAriaSnapshot(snapshotText);
    const nodeCount = countNodes(snapshotText);
    console.log(JSON.stringify({ success: true, tree, nodeCount, raw: snapshotText }));
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message, tree: null, nodeCount: 0 }));
  } finally {
    if (browser) await browser.close();
  }
})();
