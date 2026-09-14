# 更新记录

## 0.3.1 — 修复新编辑器识别与插入

- 修复只识别旧 `window.UE` 导致新编辑器持续提示「编辑器尚未就绪」的问题。
- 优先使用 `__MP_Editor_JSAPI__.invoke` 的 `mp_editor_insert_html` 接口，保留旧 UEditor 兼容；新接口可用时不再调用旧 `getEditor`。
- 等待插入成功回调后关闭弹窗；失败、异常或超时时保留公式并提示，处理中防止重复提交。
- 支持不同编号的 `ueditor_*` iframe，覆盖快捷键、再次编辑和 SVG 修复的查找逻辑。
- 新增新接口、缺失或异常的旧 UE、异步成功、失败、重复请求及超时测试，共 19 项浏览器回归测试通过。
- 延续修正后的安装包结构，解压目录直接包含 `manifest.json`。

接口适配参考原项目 [Issue #11](https://github.com/latentcat/mpmath/issues/11) 与 [PR #12](https://github.com/latentcat/mpmath/pull/12)，感谢 Jw-23 和 wongyah。验证使用 Chrome for Testing 153.0.8010.36 与本地模拟编辑器，真实公众号草稿保存仍待登录验证。

## 0.3.0 — mpMath v3

微信公众平台公式支持，基于原版 mpMath 的新版 Chrome 适配版本。

- 修正 Manifest V3 Service Worker 配置，使用 ShowAction，清理未使用权限。
- 改用声明式 MAIN 环境脚本访问 UEditor，移除页面 jQuery 依赖及无接收方的初始化消息。
- 支持编辑器延迟加载、iframe 重载与弹窗就绪握手，避免重复绑定。
- 将 MathJax 配置提前加载，串行处理渲染并丢弃过期结果；渲染失败或空输入时禁用插入。
- 修复再次编辑时 HTML 截取问题，保留原始公式源码及行内／行间模式。
- 检查窗口消息来源和类型，插入成功后关闭弹窗，失败时保留输入供重试。
- 改进 SVG 解析、超时与失败处理，按实际结果报告修复数量。
- 修正弹窗 iframe 留白造成的点击坐标偏差。
- 提供源码、可解压加载的扩展 ZIP，以及 12 项浏览器回归测试。

验证环境：Chrome for Testing 153.0.8010.36；真实扩展 + 本地 UEditor 模拟页面。尚未登录真实公众号验证保存草稿及重新打开后的表现。
