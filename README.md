# VisPath · 视觉路径

VisPath（视觉路径）是一个本地优先的 AI 视觉方向画板：输入原始提示词或参考图，选择要探索的视觉维度，生成多套结构清晰、可复制或可直接生图的提示词，并在画板中比较方向。

## 当前阶段

提示词方案通过兼容 OpenAI Chat Completions 接口的文本服务生成，图片通过兼容 OpenAI Images 接口的服务生成。生成批次、提示词快照和结果状态保存在浏览器 IndexedDB 中，真实图片保存在项目的 `generated/` 目录。供应商与模型属于服务端配置，不进入前端产品文案和历史数据。

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

部署到 GitHub Pages 后直接打开页面，在右上角“API 配置”中填写文本和生图服务。API Key 只保存在当前浏览器的 IndexedDB 中，不会进入仓库文件。

## GitHub Pages 静态模式

GitHub Pages 只能托管静态文件，不能运行 `server.mjs`。部署后打开页面，点击右上角“API 配置”，把文本与生图 API 地址、Key 和模型填写到浏览器端。配置保存在当前浏览器的 IndexedDB 中，页面会直连中转站。

静态模式的前提是中转站允许 GitHub Pages 域名跨域（CORS）。Key 会参与浏览器请求，不能视为服务器级保密凭据；建议使用可撤销、限额的专用 Key，不要使用主账号 Key。生成图片在静态模式下以 Data URL / Blob 形式保存在当前浏览器历史中，不写入 GitHub 仓库。

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
