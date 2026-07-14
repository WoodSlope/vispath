# VisPath Design System

状态：生效。本文档是 VisPath 的可执行设计系统真相源；`UI_STYLE_GUIDE.md` 负责视觉语言、产品语气和体验原则，`styles.css` 负责实现。

## 1. 产品与屏幕契约

VisPath 是面向视觉创作者的本地 AI 视觉方向工作台。用户通过“输入 -> 方案 -> 结果”完成一次视觉探索，并在当前浏览器中管理 API 配置、生成状态和历史记录。

- 当前只支持电脑端。有效工作区宽度为 `>= 901px`；`<= 900px` 只显示电脑端边界说明。
- 工具界面优先支持扫描、比较和重复操作，不采用营销页式 Hero、装饰性卡片嵌套或无意义渐变。
- 规范覆盖静态 HTML、`app.js` 动态生成内容、全部 `dialog`、Toast、空/加载/成功/失败状态和本地历史恢复状态。

## 2. 真相源与修改顺序

1. 先读 `AGENTS.md`、本文档和 `UI_STYLE_GUIDE.md`。
2. 复用 `styles.css :root` Token 和现有组件类，不在叶子组件增加同义尺寸或颜色。
3. 组件合同变化时，同步更新本文档、共享 CSS 和 `tests/design-system-contract.mjs`。
4. `app.js` 或 `src/` 变化后运行 `npm run build:browser`；禁止手改 `app.bundle.js`。

优先级：项目产品边界 > 本文档组件合同 > `UI_STYLE_GUIDE.md` 视觉原则 > 局部样式。

## 3. 基础 Token

### 3.1 颜色

| 语义 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| 主文字/结构 | `--ink` | `#151816` | 标题、正文、强边框、当前阶段 |
| 次文字 | `--muted` | `#68716b` | 辅助说明、未激活、禁用文字 |
| 纸张 | `--paper` | `#fbfcf8` | 页面、输入、卡片、弹窗 |
| 普通表面 | `--surface` | `#f1f4ee` | 次级面板、加载块、筛选组 |
| 输入面板 | `--panel` | `#f2f5ef` | 输入阶段主面板 |
| 强调表面 | `--surface-strong` | `#e8ede5` | 蓝图等次级任务区 |
| 普通边界 | `--line` | `#cfd7cd` | 内部分隔、弱边框 |
| 强边界 | `--line-strong` | `#aab5aa` | 控件、卡片、弹窗边界 |
| 主操作 | `--accent` | `#e4572e` | 主按钮、当前选择、焦点、加载重点 |
| 主操作 hover/active | `--accent-hover` / `--accent-active` | `#c84725` / `#b83d20` | 主操作交互状态 |
| 主操作浅底 | `--accent-soft` | `#fff0e9` | 选中、焦点辅助底色 |
| 选中纸张底 | `--selected-paper` | `#fffaf7` | 选中方案卡的浅底 |
| 成功 | `--success` | `#0d8050` | 已连接、已完成、比例一致 |
| 危险 | `--danger` | `#9f3522` | 错误、删除、重置 |
| 危险体系 | `--danger-strong` / `--danger-line` / `--danger-soft` | `#812817` / `#d7a398` / `#fff0ec` | 危险 hover、边界、浅底 |
| 收藏/提醒 | `--warning` | `#8b610b` | 收藏、提醒文字 |
| 收藏体系 | `--warning-line` / `--warning-soft` | `#b68016` / `#fff5d9` | 收藏边界和浅底 |
| 高亮 | `--highlight` | `#f3c969` | 深色表面上的小范围提示 |

`--green` 是 `--success` 的兼容别名。新增语义状态必须使用 Token；不允许在组件规则中重复写上述颜色字面量。

`--art-editorial`、`--art-retro`、`--art-future`、`--art-lifestyle` 只用于视觉方案示意，不参与成功、错误、警告等 UI 语义。

### 3.2 间距

| Token | 值 | 用途 |
| --- | ---: | --- |
| `--space-1` | `8px` | 字段内、图标组、紧凑操作 |
| `--space-2` | `12px` | 控件组、卡片内部、辅助内容 |
| `--space-3` | `16px` | 面板/卡片内边距、模块间距 |
| `--space-4` | `24px` | 大区块、左右任务区、弹窗动作区上间距 |

- 页面骨架和重复组件只使用这四级间距。
- `1-7px` 可用于边框、图标绘制、文字光学偏移。
- `9-13px` 的既有值只允许作为紧凑组件内部排版例外；不得扩散为新的页面级间距。
- 父容器已使用 `gap` 时，子元素不得再用同方向 margin 重复制造间距。

### 3.3 尺寸、形状与层级

- `--control-height: 32px`：文本按钮、单行输入、下拉框、阶段标签。
- `--icon-button-size: 32px`：图标按钮外框。
- `--icon-size: 16px`：SVG 图标盒。
- `--result-card-min-width: 260px`：结果列表的紧凑卡片轨道宽度。
- `--result-thumbnail-height: 180px`：结果卡统一缩略图高度。
- `--panel-padding: 16px`：页面任务面板。
- `--dialog-padding: 24px`：确认、配置、历史弹窗。
- 普通边框 `1px`；页面、控件、卡片和弹窗采用直角。
- `--shadow` 只用于需要与页面分层的主输入面板；弹窗使用更强阴影。
- z-index：粘性任务动作 `3`，顶栏 `10`，Toast `20`；新增浮层必须说明相对关系。
- 动效只用于 hover 位移、展开、Toast、加载和焦点反馈，常规时长 `150-200ms`；不添加装饰性循环动效。

### 3.4 字体层级

系统无衬线用于界面，系统等宽字体用于编号、状态、时间、模型标识和 Prompt。

| 层级 | 字号 | 使用位置 |
| --- | ---: | --- |
| 微型状态 | `8-9px` | 批次状态、步骤编号、技术元数据 |
| 辅助/等宽 | `10px` | helper、Prompt 预览、任务信息 |
| 正文/表单值 | `11px` | 输入值、卡片正文、说明 |
| 标签/按钮 | `12px` | 表单标签、普通按钮、弹窗正文 |
| 紧凑标题 | `13-15px` | 卡片、批次、分组标题 |
| 页面标题 | `18px` | 当前阶段标题、统计数字 |
| 弹窗标题 | `20px` | 确认和配置弹窗标题 |

字距固定为 `0`。按钮文字保持单行；正文和长值允许换行，技术标识使用 `overflow-wrap`。

## 4. 页面骨架与响应式

### 4.1 顶栏

- `.topbar` 高 `52px`，使用三列网格：品牌 / 阶段导航 / 全局操作。
- 品牌区第二行使用低权重等宽文字显示 `LINPO LAB · © 2026`；完整版权文本放在项目元数据和 API 配置弹窗的归属区。
- `.stage-nav` 固定三等分，宽度 `252-320px`，按钮高 `32px`。
- 三个阶段始终可点击；数据为空时进入对应空状态。导航不承担操作权限，依赖数据的提交、重试、删除等操作自行管理 disabled。
- 品牌、阶段导航和操作区不得互相重叠；全局操作只影响整个工作区。

### 4.2 阶段工作区

- `.app-shell` 从顶栏下方开始；`.workspace-grid` 最大宽度 `1480px`。
- `>= 901px` 一次只显示一个 `.is-stage-active` 阶段。
- 输入阶段为两列任务区：表单 `minmax(0, 1.25fr)`，蓝图 `minmax(360px, .75fr)`，水平间距 `24px`。
- 表单和蓝图各自拥有纵向滚动，不使用页面滚动模拟双区滚动。
- 方案阶段只让方案列表滚动，提交栏固定在工作区底部；结果阶段只让批次列表滚动，标题、统计和筛选保持可见。
- 手动切换阶段保留各自滚动位置；生成新方案、恢复历史、提交新批次或重置时才重置对应内容滚动。
- 方案阶段负责比较和选择；结果阶段负责筛选、批次和历史，局部操作不得改变其他阶段状态。

### 4.3 断点

| 范围 | 合同 |
| --- | --- |
| `<= 900px` | 隐藏完整工作台，只显示“仅支持电脑端”边界页 |
| `901-999px` | 窄桌面；输入双区仍保留，必须无横向溢出 |
| `>= 1180px` | 三/五/六套方案使用三列；结果工具栏横向排列 |
| `901-1280px` | 窄桌面保持 `16px` 面板内边距，结果卡继续使用紧凑自动填充网格 |

`max-width: 600px` 中保留的旧布局规则不是当前可达产品界面；不得以这些规则作为移动端已支持的依据。

## 5. 组件目录

| 组件族 | 实现选择器 | 核心合同 | 必查状态 |
| --- | --- | --- | --- |
| 品牌与状态 | `.brand`, `.brand-mark`, `.status-pill` | 顶栏左侧；状态点只表达连接结果 | online, offline |
| 阶段导航 | `.stage-nav`, `.stage-count` | `32px`；三等分；始终可点击；当前位置使用 `aria-current` | default, current, active-generation |
| 文本按钮 | `.button`, `.button-primary`, `.button-quiet`, `.button-danger` | 高 `32px`；主/次/危险三级 | default, hover, active, focus, disabled |
| 图标按钮 | `.icon-button`, `.ui-icon` | `32x32px` 外框、`16x16px` SVG、零内边距；必须有 `aria-label` 和 `title` | default, hover, active, focus, disabled, pressed |
| 单行表单 | `input`, `select`, `.select-control` | 高 `32px`；`11px` 值文字；统一边框和焦点环 | default, focus, disabled, invalid |
| 文本域 | `textarea` | 最小 `88px`；内边距 `12px`；允许调整高度 | default, focus, long-content |
| 上传 | `.dropzone`, `.file-preview` | 上传和已选文件是互斥状态；整行可点击 | empty, focus, dragging, selected, error |
| 探索变量 | `.dimension-option` | 单选本体 `16px`；整卡承担点击；名称不得被无意裁切 | default, hover, checked, focus |
| 面板与标题 | `.control-panel`, `.workbench-panel`, `.results-column`, `.title-pair` | 面板内边距 `16px`；标识 + 中文标题 | normal, scroll, long-title |
| 蓝图 | `.inline-blueprint`, `.blueprint-empty`, `.blueprint-block` | 固定内容/本轮变化/输出限制三段 | empty, populated, collapsed |
| 方案卡 | `.prompt-card`, `.prompt-card-selector`, `.prompt-preview` | 卡片边界、内容、动作顺序固定；选中使用 accent | default, hover, selected, expanded, long-content |
| 提交栏 | `.submission-bar` | 阶段级动作；不得遮挡列表尾部 | disabled, ready, sticky |
| 结果概览/筛选 | `.generation-overview`, `.result-filters` | 状态概览与筛选都只影响结果区；控件同高 | default, pressed, active-filter, no-match |
| 批次 | `.generation-batch`, `.generation-batch-summary`, `.generation-batch-meta` | 批次头 `52px`；summary 只负责展开，对比和删除作为并列操作区 | collapsed, expanded, loading, deletable, disabled |
| 结果卡 | `.generation-card`, `.generation-art`, `.generation-body` | 统一紧凑小卡；固定缩略图高度；只有成功结果显示“基于此结果细化” | loading, ready, error, favorite, long-content |
| 状态反馈 | `.empty-board`, `.generation-state`, `.generation-progress`, `.generation-error` | 说明当前状态、下一步和恢复方式 | empty, loading, success, error, no-match |
| Toast | `.toast` | 只承载短操作反馈；可选单个撤销动作 | hidden, shown, actionable |
| 基础弹窗 | `.confirm-dialog` | 标题/内容/动作三段；内容内边距 `24px` | open, focus, destructive, scroll |
| 弹窗关闭 | `.dialog-close` | 每个 dialog 必须存在；默认可见描边 | default, hover, focus |
| 大图/对比 | `.image-preview-dialog`, `.comparison-dialog` | 头部固定、内容独立滚动；媒体使用深色舞台 | open, zoom, favorite, multi-item |

## 6. 组件详细合同

### 6.1 按钮与图标

- `.button-primary` 只用于当前区域最重要的提交动作；同一动作区通常只有一个。
- `.button-danger` 只用于会删除、重置或覆盖数据的动作，必须有明确后果。
- 禁用按钮保持尺寸并降低透明度；不能通过隐藏按钮代替不可用状态。
- 关闭、收藏、移除等明确动作使用 SVG 图标按钮；清除筛选等可能歧义的动作使用文字。
- 字符 `×`、`+`、`⌄` 不得作为新增共享图标；优先复用 `.ui-icon`。现有 `.dropzone-icon` 和 `.select-control::after` 是受控例外。

### 6.2 表单

- 标签、值、辅助说明分别使用 `12px / 11px / 9-11px` 层级。
- `.select-control` 是所有原生 select 的统一箭头包裹，不单独修正某个下拉框。
- 两列字段使用 `.split-fields`，等任务优先级使用等宽列。
- 错误提示必须靠近出错字段或弹窗任务；阻断弹窗操作的错误不能只显示 Toast。

### 6.3 卡片与状态

- 卡片只用于重复方案、结果或对比条目；页面区块不套装饰性卡片。
- 选中卡片同时明确边框、背景和内部操作的前景色，不依赖父级颜色继承。
- 结果卡动作只在能力真实可用时出现；加载中禁止删除/重试，失败时提供重试。
- 结果列表以同屏浏览尽可能多的卡片为优先级；单条批次不放大，也不改用横向宽卡。
- 结果图片在固定高度的缩略框内完整容纳；真实比例和细节通过现有大图查看或批次对比承载。
- 收藏使用 warning 体系，不与成功、选中或警告文案混用。

### 6.4 弹窗

- 所有 `dialog` 标题区必须有 `.dialog-close`，外框 `32x32px`、`1px --line-strong` 描边、`--paper` 背景。
- focus 使用橙色 `2px` outline；默认描边不能被 focus 环代替。
- API、历史和确认弹窗使用 `.confirm-dialog`；大图和对比使用独立宽弹窗，但共享关闭按钮、标题层级和 backdrop 逻辑。
- 基础弹窗必须使用固定标题、`.confirm-dialog-content` 滚动正文、固定操作区三段结构，最大高度为 `100dvh - 48px`。内容较短时不应出现滚动条。
- 大图和批次对比弹窗保持头部固定、媒体/对比区独立滚动；每次打开弹窗都将内容滚动位置重置到顶部。
- 操作区 gap `8px`、距正文 `24px`；主操作位于右侧，危险操作不能成为窄布局的首个视觉动作。

## 7. 状态矩阵

| 状态 | 视觉信号 | 行为要求 |
| --- | --- | --- |
| default | paper/surface、普通边界 | 可读、可操作 |
| hover | 边界增强或最多 `-1px` 位移 | 不改变布局尺寸 |
| active | 深一档表面或取消位移 | 提供按压反馈 |
| focus-visible | `2px --accent` outline 或统一焦点环 | 键盘可见，不能移除 |
| disabled | 同尺寸、低透明度、not-allowed | 不触发副作用 |
| selected/current | accent 边界/浅底，配合 ARIA | 与 success、warning 区分 |
| loading | 局部进度、具体文案、阻止重复提交 | 完成或失败后恢复操作 |
| success | `--success` + 明确文字 | 展示结果或下一步 |
| error | danger 文字/边界/浅底 | 说明原因、保留的数据和恢复方式 |
| destructive | danger 填充或边界 | 明确范围，必要时确认/撤销 |
| favorite | warning 边界/浅底 | 使用 `aria-pressed` |

## 8. 可访问性与文案

- 控件必须有可访问名称；图标按钮同时提供 `aria-label` 和 `title`。
- 当前位置/选中使用 `aria-current`、`aria-pressed`、checked 等真实状态，不只靠颜色。
- 空状态说明“当前状态 + 下一步 + 将出现什么”；加载说明正在进行的动作；错误说明恢复方式。
- 空状态的标题与辅助说明在状态容器内居中排列；标题栏和有数据状态保持既有左对齐层级。
- 弹窗内阻断提交的字段错误必须留在对应字段旁，并同步 `aria-invalid` 与焦点；Toast 只作为补充反馈。
- 清除 API 配置等不可撤销操作必须使用危险样式和统一确认弹窗。
- API、URL、Prompt、model、task_id 可保留英文；其他界面文案使用简体中文动作语言。

## 9. 禁止项与受控例外

禁止：

- 为重复控件新增一次性高度、圆角、边框、颜色或 focus 样式。
- 只更新文档但不更新共享实现和验证。
- 用单张默认状态截图宣称全页面组件统一。
- 在卡片中嵌套仅为装饰的卡片，或用颜色代替状态文字。
- 把 `<= 900px` 边界页描述为移动端适配完成。

受控例外：

- 状态点、计数和收藏标识可使用小于 `32px` 的非交互尺寸。
- 上传区、文本域、媒体舞台、批次头不是普通控件，不强制 `32px`。
- 视觉方案示意色只用于生成内容预览，不进入 UI 语义。
- 光学偏移和 SVG 路径尺寸可以使用非间距 Token 值，但不得影响外框几何。

## 10. 验收合同

页面级设计系统修改必须完成：

```text
npm run test:design-system
npm run test:file-open
npm run test:experience
```

渲染验证至少包含：

- 普通桌面和 `901x720` 窄桌面；`<= 900px` 验证只出现电脑端边界页。
- `document.documentElement.scrollWidth === innerWidth`。
- 顶栏三列无重叠；输入双区 top/bottom/height 和滚动归属符合合同。
- 至少打开并关闭一个弹窗，测量关闭按钮、默认描边和 focus。
- 方案卡 selected/expanded，结果 loading/ready/error/favorite 中可达的状态。
- 控制台无明显 warning/error；未覆盖的真实 API、数据和状态必须列出。

不能只根据源码、Token 存在或单张截图判定通过。
