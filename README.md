# VisPath · 视觉路径

VisPath（视觉路径）是一个本地优先的 AI 视觉方向画板：输入原始提示词或参考图，选择要探索的视觉维度，生成多套结构清晰、可复制或可直接生图的提示词，并在画板中比较方向。

## 当前阶段

提示词方案通过兼容 OpenAI Responses 接口的文本服务生成。API 配置只填写以 `/v1` 结尾的根地址、Key、模型和图片生成方式，具体接口后缀由程序固定拼接：文本使用 `/responses`，同步生图使用 `/images/generations`，异步生图使用 `/images/generations/async`。异步模式会保存 `task_id`，再通过 `/images/tasks/{task_id}` 轮询并回填结果，刷新页面后可继续查询未完成任务。图片请求严格对齐 Aixoras 文档 Demo：同步请求使用 `quality: standard`、`response_format: url`、`watermark: false`，异步请求使用 `response_format: url`；两种方式都通过 `aspect_ratio` 控制比例，不发送未声明的 `size`。解析时仍同时兼容服务端实际返回的 `b64_json` 和 `url`；结果卡按真实响应显示“实际返回 Base64/URL”。生成批次、提示词快照、接口模式、结果状态、实际返回格式和图片尺寸保存在浏览器 IndexedDB 中，结果卡会对比请求比例与实际比例。供应商与模型属于浏览器配置，不进入前端产品文案。

文本服务支持文字、参考图或二者组合输入。参考图会在浏览器内缩放压缩后发送给多模态文本服务，用于识别主体、构图和视觉特征；原始文件不会写入历史记录。

生成历史使用带版本的字段白名单保存。旧记录在读取时会自动迁移，供应商、模型和临时故障字段不会继续保留。

移动端提供“输入 / 方案 / 结果”三阶段导航。后续阶段会在内容可用后解锁，桌面端仍保持三栏工作台。

重置工作台前会显示二次确认。取消不会改变当前内容，确认后才会清空输入、提示词方案和本地生成历史。

## MVP 主流程

```text
输入提示词 / 上传参考图
→ 选择创作类型
→ 选择 1 个探索维度
→ 选择生成 2—4 套提示词
→ AI 生成 PromptBlueprint 和提示词方案
→ 选择一套或多套提示词并统一提交
→ 生成任务和历史进入右侧画板瀑布流
→ 选中方向并继续细化
```

## 目录

```text
README.md
PRODUCT_SPEC.md           # MVP 产品说明
index.html                # HTML 应用入口
styles.css               # 响应式视觉样式
app.js                   # 原型交互和本地模拟流程
docs/PROMPT_BLUEPRINT.md  # 提示词蓝图与扩展规则
docs/XIAOBAI_ACCEPTANCE_RECORD_TEMPLATE.md # 通用体验验收记录模板
docs/XIAOBAI_ACCEPTANCE_RECORD_2026-07-12.md # 当前应用正式体验验收记录
src/prompt-blueprint.js   # 类型、维度和蓝图的数据结构示例
src/history-store.js      # 浏览器本地生成历史持久化
tests/experience-smoke.mjs # 上传、移动导航和历史删除冒烟测试
```

## 使用方式

可以直接双击 `index.html` 打开工作台。页面修改 `app.js` 或 `src/` 中的模块后，需要先运行 `npm run build:browser` 更新可直接打开的 `app.bundle.js`。

部署到 GitHub Pages 后直接打开页面，在右上角“API 配置”中填写文本和生图服务的根地址、Key 与模型。生图服务只需选择“同步 / 异步”；Aixoras 推荐使用异步图片生成。Responses、同步生图、异步提交和任务查询后缀由程序自动处理，图片结果自动兼容 URL 与 Base64。API Key 只保存在当前浏览器的 IndexedDB 中，不会进入仓库文件。

## GitHub Pages 静态模式

GitHub Pages 只能托管静态文件，不能运行 `server.mjs`。部署后打开页面，点击右上角“API 配置”，把文本与生图 API 地址、Key 和模型填写到浏览器端。配置保存在当前浏览器的 IndexedDB 中，页面会直连中转站。

静态模式的前提是中转站允许 GitHub Pages 域名跨域（CORS）。Key 会参与浏览器请求，不能视为服务器级保密凭据；建议使用可撤销、限额的专用 Key，不要使用主账号 Key。生成结果 URL 和任务 ID 保存在当前浏览器历史中，不写入 GitHub 仓库；远程图片 URL 的有效期由中转站决定。

不要把 API Key 写入 `app.js` 或其他前端文件。GitHub Pages 运行时只从浏览器 IndexedDB 读取用户配置。

## 定向体验测试

服务启动后运行：

```text
npm install
npm run test:experience
```

体验测试会使用本机 Chrome，拦截外部 AI 请求，并验证参考图上传预览、限流 / 服务故障 / 超时反馈、移动端阶段与蓝图折叠、单条历史删除、撤销、刷新恢复清理任务及重置清理。可通过 `APP_URL` 和 `BROWSER_EXECUTABLE` 覆盖默认页面地址。

如果系统终端没有 `node`，先安装 Node.js，再运行上述命令。

## MVP 边界

首版只验证“输入 → 结构化变量提示词 → 画板生成与比较”这条链路，不包含账号、云同步、复杂历史、资产库、小红书文案和多供应商自动适配。本地历史和 API 配置只保存在当前浏览器，重置工作台会同时清除历史。API Key 不会写进前端文件。
