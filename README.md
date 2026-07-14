# VisPath · 视觉路径

VisPath（视觉路径）是一个本地优先的 AI 视觉方向画板：输入原始提示词或参考图，选择要探索的视觉维度，生成多套结构清晰、可复制或可直接生图的提示词，并在画板中比较方向。

## 版权与归属

VisPath 由 LINPO LAB 维护。

© 2026 LINPO LAB. All rights reserved.

项目页面、说明文档和视觉资产默认按保留所有权利处理；第三方库、模型和服务仍遵循各自原始许可与服务条款。

## 当前阶段

提示词方案通过兼容 OpenAI Responses 接口的文本服务生成。文本 API 和生图 API 分别配置以 `/v1` 结尾的地址、Key 与模型，可以使用两个不同中转站；旧版共用地址会在打开配置时兼容回填到两个服务，重新保存后转为独立地址。具体接口后缀由程序固定拼接：文本使用 `/responses`，同步生图使用 `/images/generations`，异步生图使用 `/images/generations/async`。异步模式会保存 `task_id`，再通过 `/images/tasks/{task_id}` 轮询并回填结果，刷新页面后可继续查询未完成任务。图片请求严格对齐 Aixoras 文档 Demo：同步请求使用 `quality: standard`、`response_format: url`、`watermark: false`，异步请求使用 `response_format: url`；两种方式都通过 `aspect_ratio` 控制比例，不发送未声明的 `size`。解析时仍同时兼容服务端实际返回的 `b64_json` 和 `url`；结果卡按真实响应显示“实际返回 Base64/URL”。生成批次、提示词快照、接口模式、结果状态、实际返回格式和图片尺寸保存在浏览器 IndexedDB 中，结果卡会对比请求比例与实际比例。供应商与模型属于浏览器配置，不进入前端产品文案。

文本服务支持文字、参考图或二者组合输入。参考图会在浏览器内缩放压缩后发送给多模态文本服务，用于识别主体、构图和视觉特征；原始文件不会写入历史记录。

生成历史使用带版本的字段白名单保存。旧记录在读取时会自动迁移，供应商、模型和临时故障字段不会继续保留。

当前版本只支持宽度大于 `900px` 的电脑端浏览器。输入、方案、结果三个阶段始终可以切换，桌面端一次只显示当前阶段；输入页使用表单与提示词蓝图双区布局，方案和结果页各自承担独立列表滚动。

重置工作台前会显示二次确认。取消不会改变当前内容，确认后才会清空输入、提示词方案和本地生成历史。

## MVP 主流程

```text
输入提示词 / 上传参考图
→ 选择创作类型
→ 选择 1 个探索维度
→ 选择生成 2—6 套提示词
→ AI 生成 PromptBlueprint 和提示词方案
→ 选择一套或多套提示词并统一提交
→ 生成任务和历史按批次进入紧凑结果卡列表
→ 选中方向并继续细化
```

## 目录

```text
README.md
AGENTS.md                # 智能体协作与 UI 修改前置规则
DESIGN_SYSTEM.md         # 可执行 Token、组件、布局和状态契约
UI_STYLE_GUIDE.md        # 产品视觉语言与体验原则
index.html                # HTML 应用入口
styles.css               # 响应式视觉样式
app.js                   # 应用交互源码
app.bundle.js            # 浏览器直接运行版本
scripts/build-browser-bundle.mjs # 浏览器 bundle 构建脚本
src/prompt-blueprint.js   # 类型、维度和蓝图的数据结构示例
src/history-store.js      # 浏览器本地生成历史持久化
src/image-generation.js   # 图片生成请求结构
```

## 使用方式

可以直接双击 `index.html` 打开工作台。页面修改 `app.js` 或 `src/` 中的模块后，需要先运行 `node scripts/build-browser-bundle.mjs` 更新可直接打开的 `app.bundle.js`。

部署到 GitHub Pages 后直接打开页面，在右上角“API 配置”中分别填写文本和生图服务的 API 地址、Key 与模型；两者可以来自不同中转站。生图服务还需选择“同步 / 异步”，Aixoras 推荐使用异步图片生成。Responses、同步生图、异步提交和任务查询后缀由程序自动处理，图片结果自动兼容 URL 与 Base64。API Key 只保存在当前浏览器的 IndexedDB 中，不会进入仓库文件。

## GitHub Pages 静态模式

GitHub Pages 只能托管静态文件，不能运行 `server.mjs`。部署后打开页面，点击右上角“API 配置”，分别把文本与生图 API 地址、Key 和模型填写到浏览器端。配置保存在当前浏览器的 IndexedDB 中，页面会分别直连对应中转站。

静态模式的前提是中转站允许 GitHub Pages 域名跨域（CORS）。Key 会参与浏览器请求，不能视为服务器级保密凭据；建议使用可撤销、限额的专用 Key，不要使用主账号 Key。生成结果 URL 和任务 ID 保存在当前浏览器历史中，不写入 GitHub 仓库；远程图片 URL 的有效期由中转站决定。

不要把 API Key 写入 `app.js` 或其他前端文件。GitHub Pages 运行时只从浏览器 IndexedDB 读取用户配置。

## 发布验证

当前静态版本发布前会验证浏览器 bundle、直接打开页面、设计系统合同和完整 Chrome 体验流程。体验范围包括电脑端阶段切换与滚动、双 API 地址配置及旧配置迁移、参考图上传、服务故障反馈、紧凑结果卡比例、大图/对比弹窗、批次筛选删除与撤销、历史恢复及重置清理。测试脚本、截图、模拟服务和生成物只保留在本地开发环境，不作为 GitHub Pages 运行文件上传。

## MVP 边界

首版只验证“输入 → 结构化变量提示词 → 画板生成与比较”这条链路，不包含账号、云同步、复杂历史、资产库、小红书文案和多供应商自动适配。本地历史和 API 配置只保存在当前浏览器，重置工作台会同时清除历史。API Key 不会写进前端文件。
