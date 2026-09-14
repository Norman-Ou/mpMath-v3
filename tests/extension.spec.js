const { test: base, expect, chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const test = base.extend({
    context: async ({}, use) => {
        const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mpmath-test-'));
        const context = await chromium.launchPersistentContext(profile, {
            channel: 'chromium',
            executablePath: process.env.MPMATH_CHROME_PATH,
            headless: true,
            args: [
                `--disable-extensions-except=${path.join(root, 'mpMath')}`,
                `--load-extension=${path.join(root, 'mpMath')}`
            ]
        });
        await context.route('https://mp.weixin.qq.com/**', async route => {
            const url = new URL(route.request().url());
            if (url.pathname === '/fixture.js') {
                return route.fulfill({ contentType: 'application/javascript', path: path.join(__dirname, 'fixtures/editor.js') });
            }
            if (url.pathname === '/good.svg') {
                return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>' });
            }
            if (url.pathname === '/bad.svg') return route.fulfill({ status: 404, body: 'not found' });
            return route.fulfill({
                contentType: 'text/html',
                path: path.join(__dirname, 'fixtures/editor.html'),
                headers: { 'Content-Security-Policy': "script-src 'self'; object-src 'none'; frame-src 'self' chrome-extension:;" }
            });
        });
        await use(context);
        await context.close();
        await fs.rm(profile, { recursive: true, force: true });
    },
    page: async ({ context }, use) => {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
            if ((message.type() === 'error' && message.location().url.startsWith('chrome-extension://')) ||
                message.text().includes("Failed to execute 'postMessage'")) errors.push(message.text());
        });
        await use(page);
        expect(errors, 'Uncaught page/extension exceptions').toEqual([]);
        await page.close();
    }
});

async function open(page) {
    await page.locator('#js_editor_insert_formula > span').click();
    await page.getByText('插入公式 Ctrl/⌘+/', { exact: true }).click();
    await expect(page.locator('#popup')).toBeVisible();
    return page.frameLocator('#popup');
}

async function render(popup, text) {
    await popup.locator('#input').fill(text);
    await expect(popup.locator('#output svg')).toHaveCount(1);
    await expect(popup.locator('#insert')).toBeEnabled();
}

async function popupFrame(page) {
    await expect.poll(() => page.frames().find(frame => frame.url().endsWith('/pages/popup.html'))?.url()).toBeTruthy();
    return page.frames().find(frame => frame.url().endsWith('/pages/popup.html'));
}

test('manifest resources exist and the MV3 worker registers current action rules', async ({ context }) => {
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'mpMath/manifest.json'), 'utf8'));
    const resources = [manifest.background.service_worker, ...Object.values(manifest.icons),
        ...manifest.content_scripts.flatMap(script => [...(script.js || []), ...(script.css || [])]),
        ...manifest.web_accessible_resources.flatMap(rule => rule.resources)];
    for (const resource of resources) await fs.access(path.join(root, 'mpMath', resource));
    expect(manifest.manifest_version).toBe(3);
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(() => new Promise(resolve => {
        chrome.declarativeContent.onPageChanged.getRules(undefined, rules => resolve(rules.length));
    }))).toBe(1);
    expect(await worker.evaluate(() => chrome.action.isEnabled())).toBe(false);
});

test('renders, inserts and re-edits formulas without damaging adjacent text', async ({ page }) => {
    await page.goto('https://mp.weixin.qq.com/editor');
    const popup = await open(page);
    await render(popup, 'x^2 + \\frac{1}{2}');
    await popup.locator('#insert').click();
    await expect(page.locator('#popup')).toBeHidden();
    const editor = page.frameLocator('#ueditor_0');
    await expect(editor.locator('[data-formula]')).toHaveAttribute('data-formula', 'x^2 + \\frac{1}{2}');
    expect(await page.evaluate(() => window.restoredBookmark)).toEqual({ saved: true });
    await editor.locator('[data-formula]').click();
    await expect(popup.locator('#input')).toHaveValue('x^2 + \\frac{1}{2}');
    await render(popup, 'y^3');
    await popup.locator('#block').check();
    await expect(popup.locator('#insert')).toBeEnabled();
    await popup.locator('#input').press('Shift+Enter');
    await expect(page.locator('#popup')).toBeHidden();
    await expect(editor.locator('[data-formula]')).toHaveCount(1);
    await expect(editor.locator('[data-formula]')).toHaveAttribute('data-formula', 'y^3');
    await expect(editor.locator('[data-formula]')).toHaveAttribute('display', 'true');
    await expect(editor.locator('p')).toHaveText('文章正文');
    expect(await page.evaluate(() => [insertions.length, changes])).toEqual([1, 1]);
    await editor.locator('[data-formula]').click();
    await expect(popup.locator('#block')).toBeChecked();
    await popup.locator('#input').press('Escape');
    await expect(page.locator('#popup')).toBeHidden();
});

test('late editor mounting, iframe reload and replacement bind exactly once', async ({ page }) => {
    await page.goto('https://mp.weixin.qq.com/editor?delayed');
    await expect(page.locator('#popup')).toHaveCount(0);
    await page.evaluate(() => mountEditor());
    await expect(page.locator('#js_editor_insert_formula')).toHaveCount(1);
    const popup = await open(page);
    await popup.locator('#cancel').click();
    await page.evaluate(() => mountEditor());
    await expect(page.locator('#js_editor_insert_formula')).toHaveCount(1);
    await expect(page.locator('#popup')).toHaveCount(1);
    const editor = page.frameLocator('#ueditor_0');
    await editor.locator('.view').press('Control+/');
    await expect(page.locator('#popup')).toBeVisible();
    await render(popup, 'a+b');
    await popup.locator('#input').press('Shift+Enter');
    await expect(page.locator('#popup')).toBeHidden();
    expect(await page.evaluate(() => insertions.length)).toBe(1);
    await page.evaluate(() => { document.getElementById('ueditor_0').srcdoc = '<body class="view" contenteditable="true">重新加载</body>'; });
    await expect(editor.locator('.view')).toHaveText('重新加载');
    await editor.locator('.view').press('Meta+/');
    await expect(page.locator('#popup')).toBeVisible();
    await popup.locator('#close').click();
    await expect(page.locator('#popup')).toBeHidden();
});

test('empty and invalid input cannot be inserted, then recovers', async ({ page }) => {
    await page.goto('https://mp.weixin.qq.com/editor');
    const popup = await open(page);
    await expect(popup.locator('#insert')).toBeDisabled();
    await popup.locator('#input').fill('   ');
    await expect(popup.locator('#insert')).toBeDisabled();
    await popup.locator('#input').fill('\\frac{');
    await expect(popup.locator('#output pre')).toBeVisible();
    await expect(popup.locator('#insert')).toBeDisabled();
    await render(popup, '\\color{red}{x}');
    await popup.locator('#cancel').click();
    expect(await page.evaluate(() => insertions.length)).toBe(0);
});

test('waits for MathJax startup and never inserts a superseded render', async ({ page }) => {
    await page.goto('https://mp.weixin.qq.com/editor');
    const frame = await popupFrame(page);
    await frame.evaluate(async () => {
        await MathJax.startup.promise;
        const ready = MathJax.startup.promise;
        MathJax.startup.promise = new Promise(resolve => { window.releaseStartup = () => resolve(ready); });
    });
    const popup = await open(page);
    await popup.locator('#input').fill('old');
    await expect(popup.locator('#insert')).toBeDisabled();
    await popup.locator('#input').fill('new');
    await frame.evaluate(() => window.releaseStartup());
    await expect(popup.locator('#insert')).toBeEnabled();
    await popup.locator('#insert').click();
    await expect(page.frameLocator('#ueditor_0').locator('[data-formula]')).toHaveAttribute('data-formula', 'new');
});

test('queues an edit request until the popup handshake completes', async ({ page }) => {
    await page.addInitScript(() => {
        if (window !== window.top) return;
        const holdReady = event => {
            if (event.data?.type === 'FORMULA_READY') event.stopImmediatePropagation();
        };
        window.addEventListener('message', holdReady);
        window.releasePopup = () => {
            window.removeEventListener('message', holdReady);
            const popup = document.getElementById('popup');
            popup.contentWindow.postMessage({ type: 'FORMULA_PING' }, new URL(popup.src).origin);
        };
    });
    await page.goto('https://mp.weixin.qq.com/editor');
    const editor = page.frameLocator('#ueditor_0');
    await editor.locator('.view').evaluate(view => {
        view.innerHTML = '<span data-formula="x_0">existing formula</span>';
    });
    await editor.locator('[data-formula]').click();
    const popup = page.frameLocator('#popup');
    await expect(popup.locator('#input')).toHaveValue('');
    await page.evaluate(() => releasePopup());
    await expect(popup.locator('#input')).toHaveValue('x_0');
    await expect(popup.locator('#insert')).toBeEnabled();
});

test('discards a conversion already in progress when input changes', async ({ page }) => {
    await page.goto('https://mp.weixin.qq.com/editor');
    const popup = await open(page);
    const frame = await popupFrame(page);
    await frame.evaluate(async () => {
        await MathJax.startup.promise;
        const convert = MathJax.tex2svgPromise.bind(MathJax);
        let first = true;
        MathJax.tex2svgPromise = async (...args) => {
            if (first) {
                first = false;
                await new Promise(resolve => { window.releaseRender = resolve; });
            }
            return convert(...args);
        };
    });
    await popup.locator('#input').fill('old');
    await expect.poll(() => frame.evaluate(() => typeof window.releaseRender)).toBe('function');
    await popup.locator('#input').fill('latest');
    await expect(popup.locator('#insert')).toBeDisabled();
    await frame.evaluate(() => releaseRender());
    await expect(popup.locator('#insert')).toBeEnabled();
    await popup.locator('#insert').click();
    await expect(page.frameLocator('#ueditor_0').locator('[data-formula]')).toHaveAttribute('data-formula', 'latest');
});

test('handles renderer rejection and editor not ready without closing or inserting', async ({ page }) => {
    await page.goto('https://mp.weixin.qq.com/editor');
    const popup = await open(page);
    const frame = await popupFrame(page);
    await frame.evaluate(async () => {
        await MathJax.startup.promise;
        window.originalConvert = MathJax.tex2svgPromise;
        MathJax.tex2svgPromise = () => Promise.reject(new Error('render failed'));
    });
    await popup.locator('#input').fill('x');
    await expect(popup.locator('#output pre')).toHaveText('render failed');
    await expect(popup.locator('#insert')).toBeDisabled();
    await frame.evaluate(() => { MathJax.tex2svgPromise = window.originalConvert; });
    await render(popup, 'y');
    await page.evaluate(() => { UE.getEditor().isReady = false; });
    const dialog = page.waitForEvent('dialog');
    await popup.locator('#insert').click();
    const warning = await dialog;
    expect(warning.message()).toContain('编辑器尚未就绪');
    await warning.dismiss();
    await expect(page.locator('#popup')).toBeVisible();
    expect(await page.evaluate(() => insertions.length)).toBe(0);
    await page.evaluate(() => { UE.getEditor().isReady = true; });
    await popup.locator('#insert').click();
    await expect(page.locator('#popup')).toBeHidden();
});

test('ignores unrelated and malformed window messages', async ({ page }) => {
    await page.goto('https://mp.weixin.qq.com/editor');
    const popup = await open(page);
    await render(popup, 'x');
    await page.evaluate(() => {
        window.postMessage(null, location.origin);
        window.postMessage({ type: 'CLOSE_FORMULA' }, location.origin);
        window.postMessage({ type: 'INSERT_FORMULA', text: '<span>bad</span>' }, location.origin);
    });
    const frame = await popupFrame(page);
    await frame.evaluate(() => {
        window.postMessage({ type: 'CHANGE_INPUT', text: 'bad' }, location.origin);
        parent.postMessage(null, 'https://mp.weixin.qq.com');
        parent.postMessage({ type: 'INSERT_FORMULA', text: 42 }, 'https://mp.weixin.qq.com');
    });
    await expect(popup.locator('#input')).toHaveValue('x');
    await expect(page.locator('#popup')).toBeVisible();
    expect(await page.evaluate(() => insertions.length)).toBe(0);
});

test('SVG repair reports actual successes and retains failed embeds', async ({ page }) => {
    await page.goto('https://mp.weixin.qq.com/editor');
    await page.frameLocator('#ueditor_0').locator('.view').evaluate(view => {
        view.innerHTML = '<embed src="https://mp.weixin.qq.com/good.svg"><embed src="https://mp.weixin.qq.com/bad.svg">';
    });
    await page.locator('#js_editor_insert_formula > span').click();
    const dialog = page.waitForEvent('dialog');
    await page.getByText('修复SVG', { exact: true }).click();
    const report = await dialog;
    expect(report.message()).toContain('修复了 1 个目标');
    expect(report.message()).toContain('1 个失败');
    await report.dismiss();
    const editor = page.frameLocator('#ueditor_0');
    await expect(editor.locator('svg')).toHaveCount(1);
    await expect(editor.locator('embed')).toHaveCount(1);
});

test('non-editor and unrelated pages have no UI or errors', async ({ page }) => {
    await page.goto('https://mp.weixin.qq.com/home?plain');
    await expect(page.locator('#popup')).toHaveCount(0);
    await page.route('https://example.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>unrelated</p>' }));
    await page.goto('https://example.com/');
    expect(await page.evaluate(() => window.mpMathBridgeLoaded)).toBeUndefined();
    await expect(page.locator('#popup')).toHaveCount(0);
});

test('formula insertion works after the service worker is stopped', async ({ page, context }) => {
    await page.goto('https://mp.weixin.qq.com/editor');
    const internals = await context.newPage();
    await internals.goto('chrome://serviceworker-internals');
    await internals.getByText('Stop', { exact: true }).click();
    await expect(internals.locator('body')).toContainText('STOPPED');
    const cdp = await context.browser().newBrowserCDPSession();
    await expect.poll(async () => (await cdp.send('Target.getTargets')).targetInfos
        .filter(target => target.type === 'service_worker')).toHaveLength(0);
    await cdp.detach();
    await internals.close();
    const popup = await open(page);
    await render(popup, 'z');
    await popup.locator('#insert').click();
    await expect(page.frameLocator('#ueditor_0').locator('[data-formula]')).toHaveAttribute('data-formula', 'z');
});
