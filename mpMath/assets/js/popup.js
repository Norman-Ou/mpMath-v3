(() => {
    const input = document.getElementById('input');
    const block = document.getElementById('block');
    const insert = document.getElementById('insert');
    const output = document.getElementById('output');
    let parentOrigin = null;
    let generation = 0;
    let rendered = null;
    let submitting = false;
    let renderQueue = Promise.resolve();

    function enableInsert(enabled) {
        insert.disabled = !enabled;
        insert.classList.toggle('weui-desktop-btn_disabled', !enabled);
    }

    function send(message) {
        if (parentOrigin) parent.postMessage(message, parentOrigin);
    }

    function showError(message) {
        const error = document.createElement('pre');
        error.textContent = message;
        output.replaceChildren(error);
    }

    function convert() {
        const current = ++generation;
        const text = input.value.trim();
        const display = block.checked;
        rendered = null;
        enableInsert(false);
        output.replaceChildren();
        if (!text) return;
        // MathJax has shared state: serialize conversions and discard superseded work.
        renderQueue = renderQueue.then(async () => {
            if (current !== generation) return;
            try {
                if (!window.MathJax?.startup?.promise) throw new Error('公式渲染器加载失败，请重新加载扩展。');
                await MathJax.startup.promise;
                if (current !== generation) return;
                MathJax.texReset();
                const options = MathJax.getMetricsFor(output);
                options.display = display;
                const node = await MathJax.tex2svgPromise(text, options);
                if (current !== generation) return;
                if (node.querySelector('[data-mml-node="merror"]') || !node.querySelector('svg')) {
                    throw new Error('公式语法有误，请检查 LaTeX 输入。');
                }
                output.replaceChildren(node);
                MathJax.startup.document.clear();
                MathJax.startup.document.updateDocument();
                rendered = { text, display, node };
                enableInsert(!submitting);
            } catch (error) {
                if (current === generation) showError(error.message);
            }
        });
    }

    function closeFrame() {
        generation++;
        rendered = null;
        enableInsert(false);
        send({ type: 'CLOSE_FORMULA' });
    }

    function insertFormula() {
        if (insert.disabled || submitting || !rendered) return;
        const node = rendered.node.cloneNode(true);
        if (rendered.display) {
            node.style.cssText = 'overflow-x:auto; outline:0; display:block; text-align:center; margin:15px 0;';
            node.setAttribute('display', 'true');
            node.querySelector('svg').style.cssText = 'height:auto; max-width:300% !important;';
        }
        node.setAttribute('data-formula', rendered.text);
        node.querySelectorAll('mjx-assistive-mml').forEach(element => element.remove());
        const wrapper = document.createElement('span');
        wrapper.style.cursor = 'pointer';
        wrapper.appendChild(node);
        submitting = true;
        enableInsert(false);
        send({ type: 'INSERT_FORMULA', text: wrapper.outerHTML });
    }

    input.addEventListener('input', convert);
    block.addEventListener('change', convert);
    insert.addEventListener('click', insertFormula);
    document.getElementById('close').addEventListener('click', closeFrame);
    document.getElementById('cancel').addEventListener('click', closeFrame);
    window.addEventListener('message', event => {
        if (event.source !== parent || !/^https?:\/\/mp\.weixin\.qq\.com$/.test(event.origin) ||
            !event.data || typeof event.data !== 'object') return;
        parentOrigin = event.origin;
        const message = event.data;
        if (message.type === 'FORMULA_PING') {
            send({ type: 'FORMULA_READY' });
        } else if (message.type === 'CHANGE_INPUT' && typeof message.text === 'string') {
            submitting = false;
            input.value = message.text;
            block.checked = message.isBlock === 'true';
            input.focus();
            convert();
        } else if (message.type === 'FORMULA_RESULT' && typeof message.success === 'boolean') {
            submitting = false;
            if (message.success) {
                input.value = '';
                rendered = null;
                enableInsert(false);
            } else {
                enableInsert(!!rendered);
                alert(typeof message.error === 'string' ? message.error : '插入失败，请重试。');
            }
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeFrame();
        } else if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            insertFormula();
        }
    });
    enableInsert(false);
})();
