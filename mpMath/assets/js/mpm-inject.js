(() => {
    if (window.mpMathBridgeLoaded) return;
    window.mpMathBridgeLoaded = true;
    let editing = null;
    let bookmark = null;
    let pendingInput = null;
    let popup = null;
    let popupReady = false;
    let inserting = false;
    const frames = new WeakSet();
    const documents = new WeakSet();

    function popupOrigin() {
        return popup ? new URL(popup.src).origin : '';
    }

    function send(message) {
        if (popup?.isConnected) popup.contentWindow.postMessage(message, popupOrigin());
    }

    function editorFrame() {
        return [...document.querySelectorAll('iframe[id^="ueditor_"]')]
            .find(frame => frame.contentDocument?.querySelector('.view'));
    }

    function editor() {
        // WeChat's current editor exposes this bridge instead of a usable UE instance.
        // See latentcat/mpmath#11 and #12 (Jw-23 / wongyah).
        const bridge = window.__MP_Editor_JSAPI__;
        if (typeof bridge?.invoke === 'function') {
            return {
                insertHTML: html => new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error(
                        '插入请求超时，请先检查正文是否已插入，再决定是否重试。'
                    )), 15000);
                    const fail = error => {
                        clearTimeout(timeout);
                        const detail = typeof error === 'string' ? error : error?.message || error?.errMsg || error?.msg;
                        reject(new Error(detail || '微信编辑器拒绝了插入请求，请稍后重试。'));
                    };
                    try {
                        bridge.invoke({
                            apiName: 'mp_editor_insert_html',
                            apiParam: { html, isSelect: false },
                            sucCb: () => { clearTimeout(timeout); resolve(); },
                            errCb: fail
                        });
                    } catch (error) {
                        fail(error);
                    }
                })
            };
        }
        const frame = editorFrame();
        if (!frame?.contentDocument?.querySelector('.view') || !window.UE?.getEditor) return null;
        try {
            const instance = window.UE.getEditor('js_editor');
            if (!instance || instance.isReady === false || typeof instance.execCommand !== 'function') return null;
            return {
                selection: instance.selection,
                insertHTML: html => instance.execCommand('insertHTML', html),
                notifyChanged: () => instance.fireEvent?.('contentchange')
            };
        } catch {
            // Some current pages still expose UE, but getEditor creates an unusable instance.
            return null;
        }
    }

    function flushInput() {
        if (popupReady && pendingInput) {
            send(pendingInput);
            pendingInput = null;
        }
    }

    function openFormula(formula = null) {
        if (inserting) return;
        const instance = editor();
        if (!instance || !popup) {
            alert('编辑器尚未就绪，请稍后重试。');
            return;
        }
        editing = formula;
        bookmark = formula ? null : instance.selection?.getBookmark?.();
        pendingInput = {
            type: 'CHANGE_INPUT',
            text: formula?.getAttribute('data-formula') || '',
            isBlock: formula?.getAttribute('display') || 'false'
        };
        popup.style.display = 'block';
        popup.focus();
        flushInput();
    }

    function closeFormula() {
        if (popup) popup.style.display = 'none';
        pendingInput = null;
        editing = null;
        bookmark = null;
        editorFrame()?.contentWindow?.focus();
    }

    window.addEventListener('mpmath:open', () => openFormula());
    window.addEventListener('message', async event => {
        if (!popup || event.source !== popup.contentWindow || event.origin !== popupOrigin() ||
            !event.data || typeof event.data !== 'object') return;
        const message = event.data;
        if (message.type === 'FORMULA_READY') {
            popupReady = true;
            flushInput();
        } else if (message.type === 'CLOSE_FORMULA') {
            if (!inserting) closeFormula();
        } else if (message.type === 'INSERT_FORMULA' && typeof message.text === 'string' &&
            popup.style.display !== 'none' && !inserting) {
            inserting = true;
            try {
                const instance = editor();
                if (!instance) throw new Error('编辑器尚未就绪，请稍后重试。');
                const template = document.createElement('template');
                template.innerHTML = message.text;
                const wrapper = template.content.firstElementChild;
                const formula = wrapper?.firstElementChild;
                if (wrapper?.tagName !== 'SPAN' || !formula?.hasAttribute('data-formula') ||
                    !formula.querySelector('svg')) throw new Error('公式内容无效，请重新渲染。');
                if (editing) {
                    if (!editing.isConnected) throw new Error('原公式已移除，请关闭后重新插入。');
                    editing.replaceWith(formula);
                    instance.notifyChanged?.();
                    formula.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    if (bookmark) instance.selection?.moveToBookmark?.(bookmark);
                    await instance.insertHTML('\u00a0' + wrapper.outerHTML + '\u00a0');
                }
                send({ type: 'FORMULA_RESULT', success: true });
                closeFormula();
            } catch (error) {
                send({ type: 'FORMULA_RESULT', success: false, error: error.message });
            } finally {
                inserting = false;
            }
        }
    });

    function bindFrame(frame) {
        const doc = frame.contentDocument;
        if (!doc || documents.has(doc)) return;
        documents.add(doc);
        doc.addEventListener('keydown', event => {
            if ((event.ctrlKey || event.metaKey) && (event.code === 'Slash' || event.key === '/')) {
                event.preventDefault();
                openFormula();
            }
        });
        doc.addEventListener('click', event => {
            const formula = event.target.closest?.('[data-formula]');
            if (formula) {
                event.preventDefault();
                openFormula(formula);
            }
        });
    }

    function initialize() {
        const currentPopup = document.getElementById('popup');
        if (currentPopup !== popup) {
            popup = currentPopup;
            popupReady = false;
            // The handshake also covers a popup loaded before this bridge was injected.
            if (popup) {
                popup.addEventListener('load', () => send({ type: 'FORMULA_PING' }));
                if (popup.dataset.mpmLoaded === 'true') send({ type: 'FORMULA_PING' });
            }
        }
        for (const frame of document.querySelectorAll('iframe[id^="ueditor_"]')) {
            if (!frames.has(frame)) {
                frames.add(frame);
                frame.addEventListener('load', () => bindFrame(frame));
                bindFrame(frame);
            }
        }
    }
    new MutationObserver(initialize).observe(document.documentElement, { childList: true, subtree: true });
    initialize();
})();
