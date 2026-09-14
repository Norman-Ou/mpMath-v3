// Keep every SVG self-contained so WeChat can save it without a shared font cache.
window.MathJax = {
    svg: { fontCache: 'none' },
    tex: { tags: 'ams' },
    startup: { typeset: false }
};
