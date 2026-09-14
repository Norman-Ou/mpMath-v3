// Deliberately no jQuery: the bridge must only depend on the editor's UE API.
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
        document.getElementById('ueditor_0').contentDocument.querySelector('.view')
            .insertAdjacentHTML('beforeend', html);
    },
    fireEvent(name) {
        if (name === 'contentchange') window.changes++;
    }
};
window.UE = { getEditor: () => instance };
window.mountEditor = () => {
    document.getElementById('js_media_list')?.remove();
    document.getElementById('ueditor_0')?.remove();
    const toolbar = document.createElement('ul');
    toolbar.id = 'js_media_list';
    document.body.appendChild(toolbar);
    const iframe = document.createElement('iframe');
    iframe.id = 'ueditor_0';
    iframe.srcdoc = '<!doctype html><body class="view" contenteditable="true"><p>文章正文</p></body>';
    document.body.appendChild(iframe);
};
if (!location.search.includes('delayed') && !location.search.includes('plain')) window.mountEditor();
