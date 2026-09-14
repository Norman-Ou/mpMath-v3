(() => {
    if (globalThis.mpMathContentLoaded) return;
    globalThis.mpMathContentLoaded = true;

    function hideMenus() {
        document.querySelectorAll('#js_editor_insert_formula ul').forEach(menu => {
            menu.hidden = true;
        });
    }

    // SVG repair originally based on https://github.com/kongxiangyan/bookmarklet.
    async function revise() {
        const view = document.getElementById('ueditor_0')?.contentDocument?.querySelector('.view');
        if (!view) {
            alert('编辑器尚未就绪，请稍后重试。');
            return;
        }
        const embeds = [...view.querySelectorAll('embed')];
        const results = await Promise.allSettled(embeds.map(async embed => {
            const response = await fetch(embed.src, { signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
            const svg = doc.documentElement;
            if (doc.querySelector('parsererror') || svg.localName !== 'svg' ||
                svg.namespaceURI !== 'http://www.w3.org/2000/svg') {
                throw new Error('无效的 SVG');
            }
            // Fetched SVG is content, never executable markup.
            svg.querySelectorAll('script, foreignObject, iframe, object, embed').forEach(node => node.remove());
            for (const node of [svg, ...svg.querySelectorAll('*')]) {
                for (const attr of [...node.attributes]) {
                    if (/^on/i.test(attr.name) ||
                        (attr.localName === 'href' && !attr.value.startsWith('#'))) {
                        node.removeAttributeNode(attr);
                    }
                }
            }
            if (!embed.isConnected) throw new Error('原始元素已移除');
            embed.replaceWith(view.ownerDocument.importNode(svg, true));
        }));
        const success = results.filter(result => result.status === 'fulfilled').length;
        alert(`修复了 ${success} 个目标！${success < embeds.length ? ` ${embeds.length - success} 个失败，请检查 SVG 地址或网络后重试。` : ''}`);
    }

    function initialize() {
        const toolbar = document.getElementById('js_media_list');
        if (!toolbar || !document.body) return;
        if (!document.getElementById('popup')) {
            const iframe = document.createElement('iframe');
            iframe.id = 'popup';
            iframe.className = 'mpm-modal';
            iframe.title = '公式编辑器';
            iframe.src = chrome.runtime.getURL('pages/popup.html');
            iframe.style.display = 'none';
            iframe.style.border = '0';
            iframe.addEventListener('load', () => { iframe.dataset.mpmLoaded = 'true'; });
            document.body.appendChild(iframe);
        }
        if (document.getElementById('js_editor_insert_formula')) return;
        const menu = document.createElement('li');
        menu.id = 'js_editor_insert_formula';
        menu.className = 'tpl_item tpl_item_dropdown jsInsertIcon formula';
        const label = document.createElement('span');
        label.textContent = '公式';
        menu.appendChild(label);
        const dropdown = document.createElement('ul');
        dropdown.className = 'tpl_dropdown_menu';
        dropdown.hidden = true;
        const actions = [
            ['插入公式 Ctrl/⌘+/', () => window.dispatchEvent(new Event('mpmath:open'))],
            ['修复SVG', revise],
            ['指南', () => alert('输入 LaTeX 后点击插入。Ctrl/⌘+/ 新建公式，Shift+Enter 插入，Esc 关闭。点击已有公式可再次编辑。')]
        ];
        for (const [text, action] of actions) {
            const item = document.createElement('li');
            item.className = 'tpl_dropdown_menu_item';
            item.textContent = text;
            item.addEventListener('click', event => {
                event.stopPropagation();
                hideMenus();
                action();
            });
            dropdown.appendChild(item);
        }
        menu.appendChild(dropdown);
        menu.addEventListener('click', event => {
            event.stopPropagation();
            dropdown.hidden = !dropdown.hidden;
        });
        toolbar.appendChild(menu);
    }

    document.addEventListener('click', hideMenus);
    new MutationObserver(initialize).observe(document.documentElement, { childList: true, subtree: true });
    initialize();
})();
