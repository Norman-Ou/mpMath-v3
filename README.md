# mpMath v3 — 微信公众平台公式支持

在微信公众号图文编辑器中使用 LaTeX 编写、预览和插入 SVG 公式。

**当前版本：0.3.1** · **Manifest V3** · **MIT 开源**

[下载 v0.3.1](https://github.com/Norman-Ou/mpMath-v3/releases/tag/v0.3.1) · [问题反馈](https://github.com/Norman-Ou/mpMath-v3/issues) · [更新记录](CHANGELOG.md)

本项目由 [Norman-Ou](https://github.com/Norman-Ou) 维护，基于 [原版 mpMath](https://github.com/latentcat/mpmath) 继续适配新版 Chrome。感谢原作者 ciaochaos、CPunisher 及原项目贡献者。本仓库是独立维护版本，与微信官方无关。

## 功能

- 使用本地 MathJax 将 LaTeX 渲染为 SVG 公式。
- 在微信公众号图文编辑器中插入行内、行间公式，点击已有公式再次编辑。
- 保留公式的 LaTeX 源码，支持颜色与字号相关的 LaTeX 命令。
- 支持新建、插入、关闭公式编辑器的快捷键。
- 将编辑器中的 SVG embed 转为内联 SVG，并报告修复成功及失败数量。
- 使用 Manifest V3，修复后台注册、脚本注入、弹窗加载与异步渲染时序问题。

## 下载与安装

1. 下载 [mpMath-v3-0.3.1.zip](https://github.com/Norman-Ou/mpMath-v3/releases/download/v0.3.1/mpMath-v3-0.3.1.zip)，并解压到一个长期保留的文件夹。
2. 在桌面 Chrome 打开 `chrome://extensions/`。
3. 开启右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择解压后的 **`mpMath-v3-0.3.1` 文件夹**，其中应直接包含 `manifest.json`、`assets` 和 `pages`。
5. 停用旧版 mpMath，再打开或刷新微信公众号图文编辑页面。

也可以下载本仓库源码，选择其中的 `mpMath` 子目录加载。安装和使用无需运行 npm，公式渲染脚本随扩展提供。

如果提示「清单文件缺失或不可读取」，请检查所选目录是否直接包含 `manifest.json`。早期下载的 0.3.0 安装包多嵌套了一层目录，请选择其内层 `mpMath` 文件夹，或重新下载已修正的安装包。

更新时替换文件，在扩展管理页点击「重新加载」，再刷新公众号页面。本仓库的修复通过 GitHub 发布，原项目的商店版本与旧 CRX 不代表本版本。

## 使用

0.3.0 若持续提示「编辑器尚未就绪」，请升级至 0.3.1 并刷新公众号页面；本版已接入新编辑器的插入接口。

打开微信公众号图文编辑页面，在素材工具栏找到「公式」，选择「插入公式」。输入 LaTeX，等待预览生成后点击「插入」。勾选「行间公式」可插入独立成行的公式。

点击已有公式可再次编辑。渲染中、空输入或渲染失败时，插入按钮会禁用。

| 操作 | 快捷键 |
| --- | --- |
| 新建公式 | `Ctrl + /` / macOS `⌘ + /`（编辑器内） |
| 插入公式 | `Shift + Enter` |
| 关闭弹窗 | `Esc` |

例如：`E = mc^2`、`\frac{a}{b}`、`\sum_{i=1}^{n} i`。可用 `\displaystyle` 调整行内公式的显示样式。

## 兼容性与已知限制

- 0.3.1 已在 **Chrome for Testing 153.0.8010.36** 上通过 **19 项浏览器回归测试**。测试加载真实扩展，使用本地模拟的新编辑器 JSAPI 及旧 UEditor 页面。
- 尚未登录真实公众号验证当前线上编辑器及「保存草稿后重新打开」。微信的编辑器结构或保存过滤规则发生变化时，可能需要继续适配；请先在测试草稿中确认效果。
- 优先使用公众号页面的 `__MP_Editor_JSAPI__` 插入接口，兼容旧 UEditor；快捷键与再次编辑仍依赖编辑器 DOM。没有出现「公式」菜单时，请先确认已刷新页面，并在本仓库提交问题。
- SVG 修复受资源地址、网络及跨域访问限制影响；失败的原始 embed 会保留。
- 本轮未实测 Edge、Firefox 或移动端。

反馈请使用 [本仓库 Issues](https://github.com/Norman-Ou/mpMath-v3/issues)，附上浏览器版本、复现步骤及扩展管理页中的错误信息。

## 开发与测试

需要 Node.js 20 或更新版本。在仓库根目录执行：

```sh
npm ci
npx playwright install --with-deps chromium
npm test
```

默认使用 Playwright 随附的 Chromium。设置 `MPMATH_CHROME_PATH` 为 Chrome for Testing 的可执行文件路径可验证指定版本。

打包发布附件：运行 `python3 scripts/package_extension.py`（需要 Python 3），在 `dist` 中生成 ZIP。安装包根目录直接包含 `manifest.json`，可解压后直接加载。

测试拦截公众号域名请求，提供本地 UEditor 模拟页面，不使用公众号账号或真实草稿。覆盖 Manifest V3 后台、公式插入与再次编辑、快捷键、延迟加载、渲染失败恢复、消息来源检查、SVG 修复，以及后台实际停止后的运行。

真实公众号验收步骤：新建测试草稿，插入并修改行内和行间公式，验证快捷键及 SVG 修复；保存后重新打开，确认显示与再次编辑正常。请记录 `chrome://version/` 中的版本。

## 来源与许可

- 原项目：[latentcat/mpmath](https://github.com/latentcat/mpmath)（原地址 `ciaochaos/mpMath`）。
- 原作者：ciaochaos（CUC）、CPunisher（BUAA）。
- 本分支维护：Norman-Ou。
- 遵循 [MIT License](LICENSE)，保留原作者版权声明及项目提交历史。

新编辑器接口适配参考 [Jw-23 在原项目的讨论](https://github.com/latentcat/mpmath/issues/11) 和 [wongyah 的修复方案](https://github.com/latentcat/mpmath/pull/12)，感谢分享。
