// No jQuery. Model both the legacy UE API and WeChat's newer editor bridge.
window.insertions = [];
window.changes = 0;
const instance = {
    isReady: true,
    selection: {
        getBookmark: () => ({ saved: true }),
        moveToBookmark: value => { window.restoredBookmark = value; }
    },
    execCommand(command, html) {
        if (command !== 'insertHTML') throw new Error(`Unexpected command: ${command}`);
        window.insertions.push(html);
        document.querySelector('iframe[id^="ueditor_"]').contentDocument.querySelector('.view')
            .insertAdjacentHTML('beforeend', html);
    },
    fireEvent(name) {
        if (name === 'contentchange') window.changes++;
    }
};
window.UE = { getEditor: () => instance };
window.mountEditor = () => {
    document.getElementById('js_media_list')?.remove();
    document.querySelector('iframe[id^="ueditor_"]')?.remove();
    const toolbar = document.createElement('ul');
    toolbar.id = 'js_media_list';
    document.body.appendChild(toolbar);
    const iframe = document.createElement('iframe');
    iframe.id = location.search.includes('renumbered') ? 'ueditor_7' : 'ueditor_0';
    iframe.srcdoc = '<!doctype html><body class="view" contenteditable="true"><p>文章正文</p></body>';
    document.body.appendChild(iframe);
};

if (location.search.includes('modern')) {
    delete window.UE;
    window.apiCalls = [];
    window.apiReply = 'success';
    window.__MP_Editor_JSAPI__ = {
        invoke(request) {
            window.apiCalls.push({ apiName: request.apiName, apiParam: request.apiParam });
            if (request.apiName !== 'mp_editor_insert_html') throw new Error('Unknown editor API');
            if (window.apiReply === 'throw') throw new Error('bridge unavailable');
            window.completeInsertion = () => {
                const view = document.querySelector('iframe[id^="ueditor_"]').contentDocument.querySelector('.view');
                view.insertAdjacentHTML('beforeend', request.apiParam.html);
                window.insertions.push(request.apiParam.html);
                request.sucCb({});
            };
            if (window.apiReply === 'hold') return;
            setTimeout(() => {
                if (window.apiReply === 'failure') request.errCb({ errMsg: 'editor rejected insert' });
                else window.completeInsertion();
            }, 20);
        }
    };
}
if (!location.search.includes('delayed') && !location.search.includes('plain')) window.mountEditor();
