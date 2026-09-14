(() => {
    if (window.mpMathBridgeLoaded) return;
    window.mpMathBridgeLoaded = true;
    let editing = null;
    let bookmark = null;
    let pendingInput = null;
    let popup = null;
    let popupReady = false;
    const frames = new WeakSet();
    const documents = new WeakSet();

    function popupOrigin() {
        return popup ? new URL(popup.src).origin : '';
    }

    function send(message) {
        if (popup?.isConnected) popup.contentWindow.postMessage(message, popupOrigin());
    }

    function editor() {
        const frame = document.getElementById('ueditor_0');
        if (!frame?.contentDocument?.querySelector('.view') || !window.UE?.getEditor) return null;
        const instance = window.UE.getEditor('js_editor');
        return instance && instance.isReady !== false && typeof instance.execCommand === 'function' ? instance : null;
    }

    function flushInput() {
        if (popupReady && pendingInput) {
            send(pendingInput);
            pendingInput = null;
        }
    }

    function openFormula(formula = null) {
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
        document.getElementById('ueditor_0')?.contentWindow?.focus();
    }

    window.addEventListener('mpmath:open', () => openFormula());
    window.addEventListener('message', event => {
        if (!popup || event.source !== popup.contentWindow || event.origin !== popupOrigin() ||
            !event.data || typeof event.data !== 'object') return;
        const message = event.data;
        if (message.type === 'FORMULA_READY') {
            popupReady = true;
            flushInput();
        } else if (message.type === 'CLOSE_FORMULA') {
            closeFormula();
        } else if (message.type === 'INSERT_FORMULA' && typeof message.text === 'string' &&
            popup.style.display !== 'none') {
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
                    instance.fireEvent?.('contentchange');
                } else {
                    if (bookmark) instance.selection?.moveToBookmark?.(bookmark);
                    instance.execCommand('insertHTML', '\u00a0' + wrapper.outerHTML + '\u00a0');
                }
                send({ type: 'FORMULA_RESULT', success: true });
                closeFormula();
            } catch (error) {
                send({ type: 'FORMULA_RESULT', success: false, error: error.message });
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
        const frame = document.getElementById('ueditor_0');
        if (frame && !frames.has(frame)) {
            frames.add(frame);
            frame.addEventListener('load', () => bindFrame(frame));
            bindFrame(frame);
        }
    }
    new MutationObserver(initialize).observe(document.documentElement, { childList: true, subtree: true });
    initialize();
})();
