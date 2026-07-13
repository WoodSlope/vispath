import { EXPLORATION_DIMENSIONS, TASK_TYPES } from "./src/prompt-blueprint.js";
import { clearApiSettings, clearGenerationHistory, loadApiSettings, loadGenerationHistory, saveApiSettings, saveGenerationHistory } from "./src/history-store.js";

const state = {
  blueprint: null,
  referenceImage: null,
  referenceImageData: "",
  selectedVariantIds: new Set(),
  generationEntries: [],
  resultFilters: { query: "", status: "all", batchId: "all" },
  batchNumber: 0,
  apiSettings: null
};

const $ = (id) => document.getElementById(id);
const taskTypeSelect = $("taskType");
const dimensionList = $("dimensionList");
const promptList = $("variantGrid");
const generationFeed = $("generationFeed");
const stageButtons = [...document.querySelectorAll(".stage-nav [data-stage-target]")];
const blueprintSection = document.querySelector(".inline-blueprint");
const blueprintToggle = $("toggleBlueprintBtn");
const apiSettingsDialog = $("apiSettingsDialog");
const historyDialog = $("historyDialog");
const retryGenerationDialog = $("retryGenerationDialog");
const imageRatioSelect = $("imageRatio");
let imageRatioOverridden = false;
let pendingRetryEntryId = "";
let historySaveQueue = Promise.resolve();
const IMAGE_CLEANUP_KEY = "ai-visual-direction-board-pending-image-cleanup";
const IMAGE_CLEANUP_DELAY = 5500;
const IMAGE_POLL_INTERVAL = 3000;
const imageCleanupTimers = new Map();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hasBrowserTextApi() { return Boolean(state.apiSettings?.textApiKey && state.apiSettings?.textBaseUrl); }
function hasBrowserImageApi() { return Boolean(state.apiSettings?.imageApiKey && state.apiSettings?.imageBaseUrl); }

function resolveImageModel(settings, resolution) {
  const configuredModel = String(settings?.imageModel || "gpt-image-2").trim();
  if (!/^gpt-image-2(?:-(?:1k|2k|4k))?$/.test(configuredModel)) return configuredModel;
  return `gpt-image-2-${String(resolution || "1K").toLowerCase()}`;
}

function resolveImageSize(ratio) {
  return {
    "1:1": "1024x1024",
    "16:9": "1792x1024",
    "9:16": "1024x1792",
    "4:3": "1024x768",
    "3:4": "768x1024"
  }[ratio] || "1024x1024";
}

function fillApiSettingsForm(settings = {}) {
  $("textBaseUrlInput").value = settings.textBaseUrl || "";
  $("textApiKeyInput").value = settings.textApiKey || "";
  $("textModelInput").value = settings.textModel || "gpt-5.4-mini";
  $("imageBaseUrlInput").value = settings.imageBaseUrl || "";
  $("imageApiKeyInput").value = settings.imageApiKey || "";
  $("imageModelInput").value = settings.imageModel || "gpt-image-2";
}

function readApiSettingsForm() {
  return {
    textBaseUrl: $("textBaseUrlInput").value,
    textApiKey: $("textApiKeyInput").value,
    textModel: $("textModelInput").value,
    imageBaseUrl: $("imageBaseUrlInput").value,
    imageApiKey: $("imageApiKeyInput").value,
    imageModel: $("imageModelInput").value
  };
}

function getTaskType() {
  return TASK_TYPES.find((item) => item.id === taskTypeSelect.value) || TASK_TYPES[0];
}

function syncDefaultImageRatio() {
  if (!imageRatioOverridden) imageRatioSelect.value = getTaskType().defaultRatio;
}

function getAvailableDimensions() {
  const type = getTaskType();
  return EXPLORATION_DIMENSIONS.filter((dimension) => type.supportedDimensionIds.includes(dimension.id));
}

function selectedDimension() {
  const id = dimensionList.querySelector("input:checked")?.value;
  return EXPLORATION_DIMENSIONS.find((item) => item.id === id) || getAvailableDimensions()[0];
}

function renderTaskTypes() {
  taskTypeSelect.innerHTML = TASK_TYPES.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  taskTypeSelect.value = "poster";
}

function renderDimensions() {
  const available = getAvailableDimensions();
  const current = dimensionList.querySelector("input:checked")?.value;
  const activeId = available.some((item) => item.id === current) ? current : available[0]?.id;
  dimensionList.innerHTML = available.map((dimension) => `
    <label class="dimension-option">
      <input type="radio" name="dimension" value="${escapeHtml(dimension.id)}" ${dimension.id === activeId ? "checked" : ""}>
      <span><strong>${escapeHtml(dimension.name)}</strong><small>${escapeHtml(dimension.description)}</small></span>
    </label>
  `).join("");
}

function renderBlueprint(blueprint) {
  const dimension = selectedDimension();
  $("blueprintStatus").textContent = "已建立";
  $("blueprintPanel").innerHTML = `
    <div class="blueprint-block"><strong>固定内容</strong><p>${escapeHtml(blueprint.locked.intent)}<br>${escapeHtml(blueprint.locked.subject)}</p></div>
    <div class="blueprint-block"><strong>本轮变化</strong><p>${escapeHtml(dimension.name)} · ${blueprint.variants.length} 套方案</p></div>
    <div class="blueprint-block"><strong>输出限制</strong><p>${escapeHtml(blueprint.locked.technical.ratio)} · ${escapeHtml(blueprint.locked.textLayout)}</p></div>
  `;
}

function renderBlueprintEmpty() {
  $("blueprintStatus").textContent = "等待输入";
  $("blueprintPanel").innerHTML = '<div class="blueprint-empty"><strong>尚未建立蓝图</strong><span>生成方向后，这里会显示固定内容、本轮变量和输出限制。</span></div>';
}

function setBlueprintCollapsed(collapsed) {
  blueprintSection.classList.toggle("is-collapsed", collapsed);
  blueprintToggle.setAttribute("aria-expanded", String(!collapsed));
  blueprintToggle.setAttribute("aria-label", collapsed ? "展开提示词蓝图" : "折叠提示词蓝图");
}

function syncBlueprintDisclosure() {
  if (!window.matchMedia("(max-width: 600px)").matches) setBlueprintCollapsed(false);
}

function renderPromptCards() {
  const variants = state.blueprint?.variants || [];
  $("emptyBoard").classList.toggle("hidden", variants.length > 0);
  $("resultCount").textContent = variants.length;
  $("selectAllBtn").disabled = variants.length === 0;
  $("boardHint").textContent = variants.length ? `本轮仅变化：${selectedDimension().name}` : "生成后选择需要提交的提示词方案。";
  promptList.innerHTML = variants.map((variant, index) => {
    const selected = state.selectedVariantIds.has(variant.id);
    return `
      <article class="prompt-card ${selected ? "selected" : ""}" data-variant-id="${escapeHtml(variant.id)}">
        <label class="prompt-card-selector">
          <input type="checkbox" data-action="select" ${selected ? "checked" : ""}>
          <span><strong>${escapeHtml(variant.title)}</strong><small>方案 ${index + 1}</small></span>
        </label>
        <p class="changed-line"><strong>变化：</strong>${escapeHtml(variant.changeSummary)}</p>
        <p class="locked-line"><strong>保持：</strong>主体、场景、比例、信息区域</p>
        <details class="prompt-details">
          <summary>查看完整提示词</summary>
          <div class="prompt-preview">${escapeHtml(variant.prompt)}</div>
        </details>
        <button class="button button-quiet prompt-copy" type="button" data-action="copy">复制提示词</button>
      </article>
    `;
  }).join("");
  syncSubmissionBar();
  syncStageNav();
}

function syncStageNav() {
  const hasPrompts = (state.blueprint?.variants.length || 0) > 0;
  const hasResults = state.generationEntries.length > 0;
  const promptButton = document.querySelector('[data-stage-target="promptStage"]');
  const resultButton = document.querySelector('[data-stage-target="resultStage"]');
  if (promptButton) promptButton.disabled = !hasPrompts;
  if (resultButton) resultButton.disabled = !hasResults;
  updateActiveStageFromScroll();
}

function setActiveStage(stageId) {
  stageButtons.forEach((button) => {
    const active = button.dataset.stageTarget === stageId;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  ["setupStage", "promptStage", "resultStage"].forEach((id) => {
    document.getElementById(id)?.classList.toggle("is-stage-active", id === stageId);
  });
}

function goToStage(stageId) {
  setActiveStage(stageId);
  if (window.matchMedia("(min-width: 901px)").matches) {
    document.getElementById(stageId)?.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  document.getElementById(stageId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateActiveStageFromScroll() {
  if (!window.matchMedia("(max-width: 600px)").matches) return;
  const available = stageButtons.filter((button) => !button.disabled);
  let activeId = available[0]?.dataset.stageTarget || "setupStage";
  available.forEach((button) => {
    const section = document.getElementById(button.dataset.stageTarget);
    if (section?.getBoundingClientRect().top <= 118) activeId = button.dataset.stageTarget;
  });
  setActiveStage(activeId);
}

function syncSubmissionBar() {
  const selectedCount = state.selectedVariantIds.size;
  $("selectedCount").textContent = selectedCount;
  $("submitSelectedBtn").disabled = selectedCount === 0;
  const allSelected = (state.blueprint?.variants.length || 0) > 0 && selectedCount === state.blueprint.variants.length;
  $("selectAllBtn").textContent = allSelected ? "取消全选" : "全选";
}

function groupGenerationEntries(entries = state.generationEntries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const batchId = entry.batchId || `legacy_batch_${entry.batchNumber || "00"}`;
    if (!groups.has(batchId)) groups.set(batchId, { id: batchId, number: entry.batchNumber || "00", createdAt: entry.batchCreatedAt || entry.createdAt || "", entries: [] });
    groups.get(batchId).entries.push(entry);
  });
  return [...groups.values()];
}

function filterGenerationEntries() {
  const query = state.resultFilters.query.trim().toLocaleLowerCase("zh-CN");
  return state.generationEntries.filter((entry) => {
    const batchId = entry.batchId || `legacy_batch_${entry.batchNumber || "00"}`;
    const matchesBatch = state.resultFilters.batchId === "all" || batchId === state.resultFilters.batchId;
    const matchesStatus = state.resultFilters.status === "all" || entry.status === state.resultFilters.status;
    const searchable = `${entry.variantTitle || ""} ${entry.changeSummary || ""} ${entry.promptSnapshot || ""}`.toLocaleLowerCase("zh-CN");
    return matchesBatch && matchesStatus && (!query || searchable.includes(query));
  });
}

function syncBatchFilterOptions(batches) {
  const select = $("resultBatchFilter");
  const availableIds = new Set(batches.map((batch) => batch.id));
  if (state.resultFilters.batchId !== "all" && !availableIds.has(state.resultFilters.batchId)) state.resultFilters.batchId = "all";
  select.innerHTML = `<option value="all">全部批次</option>${batches.map((batch) => `<option value="${escapeHtml(batch.id)}">批次 ${escapeHtml(batch.number)} · ${escapeHtml(formatBatchTime(batch.createdAt))}</option>`).join("")}`;
  select.value = state.resultFilters.batchId;
}

function formatBatchTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return value || "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatGenerationElapsed(startedAt, completedAt = "") {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "时间未知";
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${seconds % 60} 秒`;
}

function updateGenerationElapsed() {
  document.querySelectorAll(".generation-elapsed[data-started-at]").forEach((element) => {
    element.textContent = formatGenerationElapsed(element.dataset.startedAt);
  });
}

function getBatchStatusCounts(entries) {
  return entries.reduce((counts, entry) => {
    counts[entry.status] += 1;
    return counts;
  }, { ready: 0, error: 0, loading: 0 });
}

function syncGenerationOverview() {
  const counts = getBatchStatusCounts(state.generationEntries);
  const navCount = $("activeGenerationNavCount");
  $("generationOverview").classList.toggle("hidden", state.generationEntries.length === 0);
  $("overviewLoadingCount").textContent = counts.loading;
  $("overviewReadyCount").textContent = counts.ready;
  $("overviewErrorCount").textContent = counts.error;
  navCount.textContent = counts.loading;
  navCount.classList.toggle("hidden", counts.loading === 0);
  const resultStageButton = document.querySelector('[data-stage-target="resultStage"]');
  resultStageButton.classList.toggle("has-active-generation", counts.loading > 0);
  resultStageButton.setAttribute("aria-label", counts.loading ? `结果，${counts.loading} 张图片生成中` : "结果");
  document.querySelectorAll("[data-overview-status]").forEach((button) => {
    button.setAttribute("aria-pressed", String(state.resultFilters.status === button.dataset.overviewStatus));
  });
}

function renderGenerationFeed({ openBatchId = "" } = {}) {
  const openBatchIds = new Set([...generationFeed.querySelectorAll(".generation-batch[open]")].map((item) => item.dataset.batchId));
  const allBatches = groupGenerationEntries();
  syncBatchFilterOptions(allBatches);
  const filteredEntries = filterGenerationEntries();
  const batches = groupGenerationEntries(filteredEntries);
  const hasVisibleOpenBatch = batches.some((batch) => openBatchIds.has(batch.id));
  const hasEntries = state.generationEntries.length > 0;
  $("emptyGenerationBoard").classList.toggle("hidden", hasEntries);
  $("filteredGenerationEmpty").classList.toggle("hidden", !hasEntries || filteredEntries.length > 0);
  $("resultFilters").classList.toggle("hidden", !hasEntries);
  $("clearResultFiltersBtn").disabled = !state.resultFilters.query && state.resultFilters.status === "all" && state.resultFilters.batchId === "all";
  generationFeed.classList.toggle("hidden", filteredEntries.length === 0);
  $("generationCount").textContent = state.generationEntries.length;
  syncGenerationOverview();
  if (hasEntries) $("feedHint").textContent = `${filteredEntries.length === state.generationEntries.length ? "" : `显示 ${filteredEntries.length} / ${state.generationEntries.length} · `}${allBatches.length} 个批次 · 当前浏览器`;
  generationFeed.innerHTML = batches.map((batch, batchIndex) => {
    const counts = getBatchStatusCounts(batch.entries);
    return `
    <details class="generation-batch" data-batch-id="${escapeHtml(batch.id)}" ${openBatchId ? batch.id === openBatchId ? "open" : "" : hasVisibleOpenBatch ? openBatchIds.has(batch.id) ? "open" : "" : batchIndex === 0 ? "open" : ""}>
      <summary class="generation-batch-summary">
        <span><strong>批次 ${escapeHtml(batch.number)}</strong><small>${escapeHtml(formatBatchTime(batch.createdAt))} · ${batch.entries.length} 条结果</small></span>
        <span class="generation-batch-meta">
          <span class="generation-batch-stats"><span class="is-ready">已完成 ${counts.ready}</span><span class="is-error">失败 ${counts.error}</span><span class="is-loading">生成中 ${counts.loading}</span></span>
          <span class="generation-batch-count">${batch.entries.length}</span>
          <button class="icon-button generation-batch-delete" type="button" data-action="delete-batch" aria-label="删除批次 ${escapeHtml(batch.number)}，共 ${batch.entries.length} 条结果" title="${counts.loading ? "生成中的批次暂不能删除" : `删除整个批次，共 ${batch.entries.length} 条结果`}" ${counts.loading ? "disabled" : ""}>×</button>
        </span>
      </summary>
      <div class="generation-batch-grid${batch.entries.length === 1 ? " is-single" : ""}">
        ${batch.entries.map((entry) => `
    <article class="generation-card" data-generation-id="${escapeHtml(entry.id)}">
      <div class="generation-card-head">
        <div><strong>${escapeHtml(entry.variantTitle)}</strong><small>批次 ${entry.batchNumber} · ${escapeHtml(entry.resolution || "1K")} · ${escapeHtml(entry.ratio || "未设比例")} · ${escapeHtml(entry.createdAt)}</small></div>
        <div class="generation-card-tools">
          <span class="generation-status ${escapeHtml(entry.status)}">${entry.status === "ready" ? "已完成" : entry.status === "error" ? "失败" : "生成中"}</span>
          <button class="icon-button generation-delete" type="button" data-action="delete" aria-label="删除${escapeHtml(entry.variantTitle)}记录" title="${entry.status === "loading" ? "生成中暂不能删除" : "删除这条记录"}" ${entry.status === "loading" ? "disabled" : ""}>×</button>
        </div>
      </div>
      <div class="generation-art ${escapeHtml(entry.artClass)} ${entry.status === "loading" ? "is-loading" : ""}">
        ${entry.imageUrl ? `<img src="${escapeHtml(entry.imageUrl)}" alt="${escapeHtml(entry.variantTitle)}生成结果">` : `<span>${entry.status === "error" ? "生成失败" : "正在生成"}</span>`}
      </div>
      <div class="generation-body">
        <p><strong>变量：</strong>${escapeHtml(entry.changeSummary)}</p>
        ${entry.status === "loading" ? `<div class="generation-progress" role="status"><span class="generation-spinner" aria-hidden="true"></span><span><strong>服务端生成中</strong><small>已等待 <span class="generation-elapsed" data-started-at="${escapeHtml(entry.startedAt || entry.batchCreatedAt)}">${formatGenerationElapsed(entry.startedAt || entry.batchCreatedAt)}</span> · 可继续创建提示词或提交其他方案</small></span></div>` : ""}
        ${entry.status !== "loading" && entry.startedAt && entry.completedAt ? `<p class="generation-duration"><strong>生成耗时：</strong>${escapeHtml(formatGenerationElapsed(entry.startedAt, entry.completedAt))}</p>` : ""}
        ${entry.status === "error" ? `<p class="generation-error"><strong>失败原因：</strong>${escapeHtml(entry.errorMessage || "模拟生成失败，请重试")}</p>` : ""}
        <details>
          <summary>提示词快照</summary>
          <div class="prompt-preview">${escapeHtml(entry.promptSnapshot)}</div>
        </details>
        <div class="generation-actions">
          <button class="button" type="button" data-action="copy-generation">复制提示词</button>
          <button class="button" type="button" data-action="retry" ${entry.status === "loading" ? "disabled" : ""}>${entry.status === "loading" ? "生成中" : entry.status === "error" ? "重试" : "重新生成"}</button>
          <button class="button button-primary" type="button" data-action="continue">基于此结果细化</button>
        </div>
      </div>
    </article>
        `).join("")}
      </div>
    </details>
  `;
  }).join("");
  syncStageNav();
}

function shouldSimulateFailure(prompt) {
  return /模拟失败|故意失败/.test(prompt);
}

function normalizeDirectBlueprint(value, input) {
  const locked = value?.locked || {};
  const variants = Array.isArray(value?.variants) ? value.variants.slice(0, input.optionCount) : [];
  if (variants.length !== input.optionCount) throw new Error("文本服务返回的方案数量不正确");
  return {
    schemaVersion: 1,
    taskTypeId: input.taskTypeId,
    source: { prompt: input.prompt, referenceImages: input.referenceImage ? [{ source: "uploaded-reference" }] : [], referenceRole: "inspiration" },
    locked: {
      intent: String(locked.intent || input.prompt || "参考图视觉方向探索"), subject: String(locked.subject || "保留原始主体"),
      context: String(locked.context || input.taskTypeName), audience: String(locked.audience || "目标受众"),
      composition: String(locked.composition || "保持基础空间关系"), visualLanguage: String(locked.visualLanguage || ""),
      palette: String(locked.palette || ""), lighting: String(locked.lighting || ""), material: String(locked.material || ""),
      textLayout: String(locked.textLayout || "保留可后期排版区域"), technical: { ratio: input.ratio }, constraints: Array.isArray(locked.constraints) ? locked.constraints : []
    },
    exploration: { dimensionIds: [input.dimensionId], optionCount: input.optionCount, selectedOptions: variants.map((item) => String(item.title || "未命名方向")) },
    variants: variants.map((item, index) => ({
      id: `variant_${Date.now()}_${index + 1}`, title: String(item.title || `方向 ${index + 1}`),
      changed: { [input.dimensionId]: String(item.title || "") }, changeSummary: String(item.changeSummary || `只改变${input.dimensionName}`),
      prompt: String(item.prompt || ""), generation: { ratio: input.ratio, resolution: input.resolution, imageCount: 1 }, artClass: ["art-editorial", "art-retro", "art-future", "art-lifestyle"][index % 4]
    }))
  };
}

async function requestDirectBlueprint(input) {
  const schema = {
    type: "object", required: ["locked", "variants"], additionalProperties: false,
    properties: {
      locked: { type: "object", required: ["intent", "subject"], additionalProperties: false, properties: { intent: { type: "string" }, subject: { type: "string" } } },
      variants: { type: "array", minItems: input.optionCount, maxItems: input.optionCount, items: { type: "object", required: ["title", "changeSummary", "prompt"], additionalProperties: false, properties: { title: { type: "string" }, changeSummary: { type: "string" }, prompt: { type: "string" } } } }
    }
  };
  const system = `你是视觉提示词方案设计器。只输出 JSON。围绕“${input.dimensionName}”生成恰好 ${input.optionCount} 套方案，保持主体、用途、比例和信息区域不变。输出 locked 和 variants，variants 每项包含 title、changeSummary、prompt。`;
  let response;
  try {
    response = await fetch(`${state.apiSettings.textBaseUrl}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${state.apiSettings.textApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: state.apiSettings.textModel, messages: [{ role: "system", content: system }, { role: "user", content: input.referenceImage ? [{ type: "text", text: JSON.stringify({ ...input, referenceImage: undefined, hasReferenceImage: true }) }, { type: "image_url", image_url: { url: input.referenceImage, detail: "low" } }] : JSON.stringify(input) }], response_format: { type: "json_schema", json_schema: { name: "prompt_blueprint", strict: true, schema } }, max_completion_tokens: 8000 })
    });
  } catch {
    throw new Error("文本服务连接失败，请检查 CORS、网络或 API 地址");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((typeof payload.error === "string" ? payload.error : payload.error?.message) || payload.message || `文本生成失败（HTTP ${response.status}）`);
  const content = payload.choices?.[0]?.message?.content;
  return normalizeDirectBlueprint(typeof content === "string" ? JSON.parse(content) : content, input);
}

async function requestGeneratedImage(entry) {
  if (shouldSimulateFailure(entry.promptSnapshot)) throw new Error("本地模拟故障：生成服务暂时不可用");
  if (!hasBrowserImageApi()) throw new Error("请先在右上角 API 配置中填写生图服务");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${state.apiSettings.imageApiKey}` };
  let taskId = entry.taskId || "";
  if (!taskId) {
    let response;
    try {
      const url = `${state.apiSettings.imageBaseUrl}/images/generations/async`;
      const body = {
        model: resolveImageModel(state.apiSettings, entry.resolution),
        prompt: entry.promptSnapshot,
        n: 1,
        size: resolveImageSize(entry.ratio),
        aspect_ratio: entry.ratio || "1:1",
        response_format: "url",
        quality: "high"
      };
      response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    } catch {
      throw new Error("异步生图提交连接中断；请先核对账单，勿立即重试");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((typeof payload.error === "string" ? payload.error : payload.error?.message) || payload.message || `图片生成提交失败（HTTP ${response.status}）`);
    taskId = String(payload.task_id || payload.id || "");
    if (!taskId) {
      const directResult = payload.data?.[0] || payload.result?.data?.[0] || {};
      if (directResult.b64_json) return { imageUrl: `data:image/png;base64,${directResult.b64_json}` };
      if (directResult.url) return { imageUrl: directResult.url };
      throw new Error("异步生图服务未返回 task_id");
    }
    entry.taskId = taskId;
    await persistGenerationHistory();
  }

  while (true) {
    let response;
    try {
      response = await fetch(`${state.apiSettings.imageBaseUrl}/images/tasks/${encodeURIComponent(taskId)}`, { headers });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, IMAGE_POLL_INTERVAL));
      continue;
    }
    const payload = await response.json().catch(() => ({}));
    if (response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, IMAGE_POLL_INTERVAL));
      continue;
    }
    if (!response.ok) throw new Error((typeof payload.error === "string" ? payload.error : payload.error?.message) || payload.message || `图片任务查询失败（HTTP ${response.status}）`);
    const status = String(payload.status || payload.raw_status || "").toLowerCase();
    if (["queued", "in_progress", "processing", "running", "unknown"].includes(status)) {
      await new Promise((resolve) => setTimeout(resolve, IMAGE_POLL_INTERVAL));
      continue;
    }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new Error(payload.fail_reason || payload.error?.message || `图片任务失败（${status}）`);
    }
    const result = payload.data?.[0] || payload.result?.data?.[0] || payload.result?.[0] || {};
    if (result.b64_json) return { imageUrl: `data:image/png;base64,${result.b64_json}` };
    if (result.url) return { imageUrl: result.url };
    if (status === "completed" || status === "success") throw new Error("图片任务已完成，但服务未返回图片");
    throw new Error(`图片任务返回未知状态：${status || "unknown"}`);
  }
}

async function checkImageService() {
  const status = $("serviceStatus");
  const label = $("serviceStatusText");
  const textReady = hasBrowserTextApi();
  const imageReady = hasBrowserImageApi();
  status.classList.toggle("is-offline", !textReady && !imageReady);
  label.textContent = textReady && imageReady ? "浏览器 API 已配置" : textReady ? "文本 API 已配置" : imageReady ? "生图 API 已配置" : "请先配置 API";
}

async function runGeneration(entry) {
  try {
    const result = await requestGeneratedImage(entry);
    entry.imageUrl = result.imageUrl;
    entry.status = "ready";
    entry.errorMessage = "";
  } catch (error) {
    entry.status = "error";
    entry.errorMessage = error.message || "图片生成失败，请重试";
  }
  entry.completedAt = new Date().toISOString();
  renderGenerationFeed();
  await persistGenerationHistory();
  showToast(entry.status === "ready" ? "真实图片已生成" : "生成未完成，请先核对账单再决定是否重试");
}

function openRetryGenerationDialog(entry) {
  pendingRetryEntryId = entry.id;
  retryGenerationDialog.showModal();
  $("cancelRetryGenerationBtn").focus();
}

function closeRetryGenerationDialog() {
  pendingRetryEntryId = "";
  retryGenerationDialog.close();
}

function confirmRetryGeneration() {
  const entry = state.generationEntries.find((item) => item.id === pendingRetryEntryId);
  closeRetryGenerationDialog();
  if (!entry) return;
  entry.status = "loading";
  entry.errorMessage = "";
  entry.startedAt = new Date().toISOString();
  entry.completedAt = "";
  renderGenerationFeed();
  persistGenerationHistory();
  runGeneration(entry);
}

function persistGenerationHistory() {
  const snapshot = {
    entries: state.generationEntries.map((entry) => ({ ...entry })),
    batchNumber: state.batchNumber,
    savedAt: new Date().toISOString()
  };
  historySaveQueue = historySaveQueue.then(() => saveGenerationHistory(snapshot)).catch(() => {
    showToast("历史记录保存失败，本次结果仍可继续使用");
  });
  return historySaveQueue;
}

function readPendingImageCleanup() {
  try {
    const items = JSON.parse(localStorage.getItem(IMAGE_CLEANUP_KEY) || "[]");
    return Array.isArray(items) ? items.filter((item) => item?.entryId && /^\/generated\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(item.imageUrl)) : [];
  } catch {
    return [];
  }
}

function writePendingImageCleanup(items) {
  if (items.length) localStorage.setItem(IMAGE_CLEANUP_KEY, JSON.stringify(items));
  else localStorage.removeItem(IMAGE_CLEANUP_KEY);
}

function removePendingImageCleanup(entryId) {
  window.clearTimeout(imageCleanupTimers.get(entryId));
  imageCleanupTimers.delete(entryId);
  writePendingImageCleanup(readPendingImageCleanup().filter((item) => item.entryId !== entryId));
}

async function runPendingImageCleanup(item) {
  removePendingImageCleanup(item.entryId);
}

function armPendingImageCleanup(item) {
  window.clearTimeout(imageCleanupTimers.get(item.entryId));
  const delay = Math.max(0, Number(item.deleteAfter) - Date.now());
  imageCleanupTimers.set(item.entryId, window.setTimeout(() => runPendingImageCleanup(item), delay));
}

function queueGeneratedImageCleanup(entry, delay = IMAGE_CLEANUP_DELAY) {
  if (!/^\/generated\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(entry.imageUrl || "")) return;
  if (state.generationEntries.some((item) => item.id !== entry.id && item.imageUrl === entry.imageUrl)) return;
  const item = { entryId: entry.id, imageUrl: entry.imageUrl, deleteAfter: Date.now() + delay };
  const items = readPendingImageCleanup().filter((pending) => pending.entryId !== entry.id);
  items.push(item);
  writePendingImageCleanup(items);
  armPendingImageCleanup(item);
}

function resumePendingImageCleanup() {
  readPendingImageCleanup().forEach(armPendingImageCleanup);
}

async function restoreGenerationHistory() {
  try {
    const saved = await loadGenerationHistory();
    const pendingIds = new Set(readPendingImageCleanup().map((item) => item.entryId));
    let interruptedCount = 0;
    const savedEntries = (saved?.entries || []).map((entry) => {
      if (entry.status !== "loading" || entry.taskId) return entry;
      interruptedCount += 1;
      return { ...entry, status: "error", errorMessage: "页面刷新后无法继续接收原请求结果；服务端可能仍在生成并扣费，请先核对账单。" };
    });
    state.generationEntries = savedEntries.filter((entry) => !pendingIds.has(entry.id));
    state.batchNumber = Number(saved?.batchNumber) || 0;
    renderGenerationFeed();
    if (saved && (saved.migrated || interruptedCount || state.generationEntries.length !== savedEntries.length)) await persistGenerationHistory();
    if (state.generationEntries.length) {
      $("feedHint").textContent = `已恢复 ${state.generationEntries.length} 条 · ${groupGenerationEntries().length} 个批次 · 当前浏览器`;
      if (window.matchMedia("(min-width: 901px)").matches) goToStage("resultStage");
      showToast(interruptedCount ? `已恢复记录，其中 ${interruptedCount} 条需核对账单` : `已恢复 ${state.generationEntries.length} 条生成记录`);
    }
    resumePendingImageCleanup();
  } catch {
    $("feedHint").textContent = "历史记录暂时无法恢复";
    resumePendingImageCleanup();
  }
}

function resumePendingGenerationTasks() {
  state.generationEntries.filter((entry) => entry.status === "loading" && entry.taskId).forEach((entry) => runGeneration(entry));
}

function showToast(message, action) {
  const toast = $("toast");
  const text = document.createElement("span");
  text.textContent = message;
  toast.replaceChildren(text);
  toast.classList.toggle("has-action", Boolean(action));
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      window.clearTimeout(showToast.timer);
      action.onClick();
    }, { once: true });
    toast.appendChild(button);
  }
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("show", "has-action");
  }, action ? 5000 : 2200);
}

function formatStorageEstimate(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function openHistoryDialog() {
  const entries = state.generationEntries;
  const batchCount = groupGenerationEntries(entries).length;
  const keepCount = Number($("historyKeepCount").value);
  $("historyEntryCount").textContent = entries.length;
  $("historyBatchCount").textContent = batchCount;
  $("historyImageCount").textContent = entries.filter((entry) => entry.imageUrl).length;
  $("historyStorageEstimate").textContent = "--";
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate().catch(() => null);
    if (estimate?.usage) $("historyStorageEstimate").textContent = formatStorageEstimate(estimate.usage);
  }
  syncHistoryCleanupState(keepCount);
  historyDialog.showModal();
}

function syncHistoryCleanupState(keepCount = Number($("historyKeepCount").value)) {
  const removeCount = Math.max(0, state.generationEntries.length - keepCount);
  $("cleanupHistoryBtn").disabled = removeCount === 0;
  $("cleanupHistoryBtn").textContent = keepCount === 0 ? "全部清空" : "清理旧记录";
  $("historyCleanupHint").textContent = removeCount ? `将清理 ${removeCount} 条最旧记录，保留最新 ${keepCount} 条。` : "当前没有需要清理的旧记录。";
}

async function cleanupOldHistory() {
  const keepCount = Number($("historyKeepCount").value);
  const removedEntries = state.generationEntries.slice(keepCount);
  if (!removedEntries.length) return;
  state.generationEntries = state.generationEntries.slice(0, keepCount);
  removedEntries.forEach((entry) => queueGeneratedImageCleanup(entry));
  renderGenerationFeed();
  await persistGenerationHistory();
  historyDialog.close();
  showToast(`已清理 ${removedEntries.length} 条旧记录`, {
    label: "撤销",
    onClick: () => {
      removedEntries.forEach((entry) => removePendingImageCleanup(entry.id));
      state.generationEntries.push(...removedEntries);
      renderGenerationFeed();
      persistGenerationHistory();
      showToast(`已恢复 ${removedEntries.length} 条历史记录`);
    }
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  showToast("提示词已复制");
}

async function generateDirections() {
  const button = $("generateBtn");
  if (!$("sourcePrompt").value.trim() && !state.referenceImageData) {
    showToast("请先输入原始提示词或上传参考图");
    $("sourcePrompt").focus();
    return;
  }
  if (button.disabled) return;
  button.disabled = true;
  $("generateBtnLabel").textContent = "正在梳理提示词…";
  $("generateHint").textContent = "正在提取固定内容并整理本轮变量，请稍候。";
  try {
    const type = getTaskType();
    const dimension = selectedDimension();
    const input = { prompt: $("sourcePrompt").value.trim(), taskTypeId: type.id, taskTypeName: type.name, dimensionId: dimension.id, dimensionName: dimension.name, optionCount: Number($("optionCount").value), ratio: imageRatioSelect.value, resolution: $("imageResolution").value, referenceImage: state.referenceImageData };
    if (!hasBrowserTextApi()) throw new Error("请先在右上角 API 配置中填写文本服务");
    state.blueprint = await requestDirectBlueprint(input);
    state.selectedVariantIds.clear();
    renderBlueprint(state.blueprint);
    renderPromptCards();
    $("generateBtnLabel").textContent = "重新生成方向";
    $("generateHint").textContent = "已生成方案。请在中间选择一套或多套，再统一提交到右侧。";
    goToStage("promptStage");
    showToast("已生成 AI 提示词方案");
  } catch (error) {
    $("generateBtnLabel").textContent = state.blueprint ? "重新生成方向" : "重试生成方向";
    $("generateHint").textContent = error.message || "提示词方案生成失败，请重试。";
    showToast(error.message || "提示词方案生成失败");
  } finally {
    button.disabled = false;
  }
}

function toggleVariant(variantId, checked) {
  if (checked) state.selectedVariantIds.add(variantId);
  else state.selectedVariantIds.delete(variantId);
  renderPromptCards();
}

function handlePromptAction(event) {
  const card = event.target.closest("[data-variant-id]");
  if (!card || !state.blueprint) return;
  const variant = state.blueprint.variants.find((item) => item.id === card.dataset.variantId);
  if (!variant) return;
  const actionNode = event.target.closest("[data-action]");
  if (!actionNode) return;
  if (actionNode.dataset.action === "select") toggleVariant(variant.id, actionNode.checked);
  if (actionNode.dataset.action === "copy") copyText(variant.prompt);
}

function submitSelected() {
  if (!state.blueprint || state.selectedVariantIds.size === 0) return;
  state.batchNumber += 1;
  const selected = state.blueprint.variants.filter((variant) => state.selectedVariantIds.has(variant.id));
  const now = new Date();
  const batchId = `batch_${now.getTime()}`;
  const batchCreatedAt = now.toISOString();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const entries = selected.map((variant, index) => ({
    id: `generation_${Date.now()}_${index}`,
    batchId,
    batchNumber: String(state.batchNumber).padStart(2, "0"),
    batchCreatedAt,
    variantTitle: variant.title,
    changeSummary: variant.changeSummary,
    promptSnapshot: variant.prompt,
    artClass: variant.artClass,
    ratio: variant.generation.ratio,
    resolution: variant.generation.resolution,
    createdAt: time,
    startedAt: batchCreatedAt,
    completedAt: "",
    status: "loading"
  }));
  state.generationEntries = [...entries, ...state.generationEntries];
  resetResultFilters();
  state.selectedVariantIds.clear();
  renderPromptCards();
  renderGenerationFeed({ openBatchId: batchId });
  persistGenerationHistory();
  goToStage("resultStage");
  showToast(`已提交 ${entries.length} 套，后台生成中；可继续创建或提交其他方案`);
  entries.forEach((entry) => runGeneration(entry));
}

function selectAllPrompts() {
  const variants = state.blueprint?.variants || [];
  const allSelected = variants.length > 0 && state.selectedVariantIds.size === variants.length;
  state.selectedVariantIds = new Set(allSelected ? [] : variants.map((item) => item.id));
  renderPromptCards();
}

function clearResultFilters() {
  resetResultFilters();
  renderGenerationFeed();
}

function resetResultFilters() {
  state.resultFilters = { query: "", status: "all", batchId: "all" };
  $("resultSearchInput").value = "";
  $("resultStatusFilter").value = "all";
}

function handleGenerationAction(event) {
  const button = event.target.closest("button[data-action]");
  const batchNode = event.target.closest(".generation-batch");
  if (button?.dataset.action === "delete-batch" && batchNode) {
    event.preventDefault();
    event.stopPropagation();
    const batchId = batchNode.dataset.batchId;
    const deletedEntries = state.generationEntries.filter((entry) => (entry.batchId || `legacy_batch_${entry.batchNumber || "00"}`) === batchId);
    if (!deletedEntries.length) return;
    const firstIndex = state.generationEntries.findIndex((entry) => entry.id === deletedEntries[0].id);
    state.generationEntries = state.generationEntries.filter((entry) => !deletedEntries.some((item) => item.id === entry.id));
    deletedEntries.forEach((entry) => queueGeneratedImageCleanup(entry));
    renderGenerationFeed();
    persistGenerationHistory();
    if (state.generationEntries.length === 0) $("feedHint").textContent = "提交记录会持续保留";
    showToast(`已删除批次 ${deletedEntries[0].batchNumber}（${deletedEntries.length} 条结果）`, {
      label: "撤销",
      onClick: () => {
        deletedEntries.forEach((entry) => removePendingImageCleanup(entry.id));
        state.generationEntries.splice(firstIndex, 0, ...deletedEntries);
        renderGenerationFeed({ openBatchId: batchId });
        persistGenerationHistory();
        showToast(`已恢复批次 ${deletedEntries[0].batchNumber}（${deletedEntries.length} 条结果）`);
      }
    });
    return;
  }
  const card = event.target.closest("[data-generation-id]");
  if (!button || !card) return;
  const entry = state.generationEntries.find((item) => item.id === card.dataset.generationId);
  if (!entry) return;
  if (button.dataset.action === "delete") {
    const deletedIndex = state.generationEntries.findIndex((item) => item.id === entry.id);
    state.generationEntries = state.generationEntries.filter((item) => item.id !== entry.id);
    queueGeneratedImageCleanup(entry);
    renderGenerationFeed();
    persistGenerationHistory();
    if (state.generationEntries.length === 0) $("feedHint").textContent = "提交记录会持续保留";
    showToast(`已删除“${entry.variantTitle}”`, {
      label: "撤销",
      onClick: () => {
        removePendingImageCleanup(entry.id);
        state.generationEntries.splice(deletedIndex, 0, entry);
        renderGenerationFeed();
        persistGenerationHistory();
        $("feedHint").textContent = "提交记录会持续保留";
        showToast(`已恢复“${entry.variantTitle}”`);
      }
    });
    return;
  }
  if (button.dataset.action === "copy-generation") return copyText(entry.promptSnapshot);
  if (button.dataset.action === "continue") {
    $("sourcePrompt").value = entry.promptSnapshot;
    state.blueprint = null;
    state.selectedVariantIds.clear();
    renderBlueprintEmpty();
    renderPromptCards();
    goToStage("setupStage");
    showToast(`已继承“${entry.variantTitle}”，请设置下一轮探索`);
    return;
  }
  if (button.dataset.action === "retry") {
    openRetryGenerationDialog(entry);
  }
}

function resizeReferenceImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("参考图读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("参考图无法解析"));
      image.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  state.referenceImage = file;
  try {
    state.referenceImageData = await resizeReferenceImage(file);
    $("filePreviewImage").src = state.referenceImageData;
    $("fileName").textContent = file.name;
    $("filePreview").classList.remove("hidden");
    $("dropzone").classList.add("hidden");
    showToast("参考图已加入本轮输入");
  } catch (error) {
    state.referenceImage = null;
    state.referenceImageData = "";
    showToast(error.message || "参考图处理失败");
  }
}

function removeReferenceImage() {
  $("referenceImage").value = "";
  state.referenceImage = null;
  state.referenceImageData = "";
  $("filePreview").classList.add("hidden");
  $("dropzone").classList.remove("hidden");
  showToast("已移除参考图");
}

function openResetDialog() {
  $("resetDialog").showModal();
  $("cancelResetBtn").focus();
}

function closeResetDialog() {
  $("resetDialog").close();
}

async function loadSavedApiSettings() {
  state.apiSettings = await loadApiSettings().catch(() => null);
  fillApiSettingsForm(state.apiSettings || {});
}

async function saveBrowserApiSettings() {
  const nextSettings = readApiSettingsForm();
  const previousSettings = state.apiSettings || {};
  if (!nextSettings.imageBaseUrl && nextSettings.imageApiKey && previousSettings.imageBaseUrl) {
    nextSettings.imageBaseUrl = previousSettings.imageBaseUrl;
  }
  if (!nextSettings.textBaseUrl && nextSettings.textApiKey && previousSettings.textBaseUrl) {
    nextSettings.textBaseUrl = previousSettings.textBaseUrl;
  }
  const missingImageUrl = nextSettings.imageApiKey && !nextSettings.imageBaseUrl;
  const missingTextUrl = nextSettings.textApiKey && !nextSettings.textBaseUrl;
  if (missingImageUrl || missingTextUrl) {
    showToast(missingImageUrl ? "请填写生图服务接口地址" : "请填写文本服务接口地址");
    return;
  }
  state.apiSettings = nextSettings;
  await saveApiSettings(state.apiSettings);
  apiSettingsDialog.close();
  await checkImageService();
  showToast("浏览器 API 配置已保存");
}

async function clearBrowserApiSettings() {
  await clearApiSettings();
  state.apiSettings = null;
  fillApiSettingsForm({});
  apiSettingsDialog.close();
  await checkImageService();
  showToast("浏览器 API 配置已清除");
}

async function reset() {
  const removedEntries = [...new Map(state.generationEntries.filter((entry) => entry.imageUrl).map((entry) => [entry.imageUrl, entry])).values()];
  $("sourcePrompt").value = "";
  $("referenceImage").value = "";
  state.referenceImage = null;
  state.referenceImageData = "";
  state.blueprint = null;
  state.selectedVariantIds.clear();
  state.generationEntries = [];
  resetResultFilters();
  state.batchNumber = 0;
  $("filePreview").classList.add("hidden");
  $("dropzone").classList.remove("hidden");
  renderBlueprintEmpty();
  renderPromptCards();
  renderGenerationFeed();
  try {
    await clearGenerationHistory();
    removedEntries.forEach((entry) => queueGeneratedImageCleanup(entry, 0));
    $("feedHint").textContent = "提交记录会持续保留";
  } catch {
    closeResetDialog();
    showToast("工作台已重置，但浏览器历史清理失败");
    return;
  }
  $("generateBtnLabel").textContent = "生成视觉方向";
  $("generateHint").textContent = "输入提示词或上传参考图后，生成可比较的方向方案。";
  goToStage("setupStage");
  closeResetDialog();
  showToast("已重置工作台");
}

taskTypeSelect.addEventListener("change", () => {
  renderDimensions();
  syncDefaultImageRatio();
  if (state.blueprint) showToast("创作类型已改变，请重新生成提示词方案");
});
imageRatioSelect.addEventListener("change", () => { imageRatioOverridden = true; });
$("generateBtn").addEventListener("click", generateDirections);
$("submitSelectedBtn").addEventListener("click", submitSelected);
$("selectAllBtn").addEventListener("click", selectAllPrompts);
$("resetBtn").addEventListener("click", openResetDialog);
$("apiSettingsBtn").addEventListener("click", () => { fillApiSettingsForm(state.apiSettings || {}); apiSettingsDialog.showModal(); });
$("saveApiSettingsBtn").addEventListener("click", saveBrowserApiSettings);
$("clearApiSettingsBtn").addEventListener("click", clearBrowserApiSettings);
$("historyManageBtn").addEventListener("click", openHistoryDialog);
$("historyKeepCount").addEventListener("change", (event) => syncHistoryCleanupState(Number(event.target.value)));
$("cleanupHistoryBtn").addEventListener("click", cleanupOldHistory);
$("cancelHistoryBtn").addEventListener("click", () => historyDialog.close());
$("cancelRetryGenerationBtn").addEventListener("click", closeRetryGenerationDialog);
$("confirmRetryGenerationBtn").addEventListener("click", confirmRetryGeneration);
$("cancelResetBtn").addEventListener("click", closeResetDialog);
$("confirmResetBtn").addEventListener("click", reset);
$("referenceImage").addEventListener("change", (event) => handleFile(event.target.files?.[0]));
$("removeFileBtn").addEventListener("click", removeReferenceImage);
blueprintToggle.addEventListener("click", () => setBlueprintCollapsed(blueprintToggle.getAttribute("aria-expanded") === "true"));
$("dropzone").addEventListener("dragover", (event) => { event.preventDefault(); $("dropzone").classList.add("is-dragging"); });
$("dropzone").addEventListener("dragleave", () => $("dropzone").classList.remove("is-dragging"));
$("dropzone").addEventListener("drop", (event) => { event.preventDefault(); $("dropzone").classList.remove("is-dragging"); handleFile(event.dataTransfer.files?.[0]); });
promptList.addEventListener("change", handlePromptAction);
promptList.addEventListener("click", handlePromptAction);
generationFeed.addEventListener("click", handleGenerationAction);
$("resultSearchInput").addEventListener("input", (event) => { state.resultFilters.query = event.target.value; renderGenerationFeed(); });
$("resultStatusFilter").addEventListener("change", (event) => { state.resultFilters.status = event.target.value; renderGenerationFeed(); });
$("resultBatchFilter").addEventListener("change", (event) => { state.resultFilters.batchId = event.target.value; renderGenerationFeed(); });
$("generationOverview").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-overview-status]");
  if (!button) return;
  state.resultFilters.status = state.resultFilters.status === button.dataset.overviewStatus ? "all" : button.dataset.overviewStatus;
  $("resultStatusFilter").value = state.resultFilters.status;
  renderGenerationFeed();
});
$("clearResultFiltersBtn").addEventListener("click", clearResultFilters);
document.querySelector(".stage-nav").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-stage-target]");
  if (!button || button.disabled) return;
  goToStage(button.dataset.stageTarget);
});
window.addEventListener("scroll", () => window.requestAnimationFrame(updateActiveStageFromScroll), { passive: true });
window.matchMedia("(max-width: 600px)").addEventListener("change", () => {
  updateActiveStageFromScroll();
  syncBlueprintDisclosure();
});

renderTaskTypes();
renderDimensions();
syncDefaultImageRatio();
setActiveStage("setupStage");
renderPromptCards();
renderGenerationFeed();
loadSavedApiSettings().then(async () => {
  checkImageService();
  await restoreGenerationHistory();
  resumePendingGenerationTasks();
});
updateActiveStageFromScroll();
setBlueprintCollapsed(window.matchMedia("(max-width: 600px)").matches);
window.setInterval(updateGenerationElapsed, 1000);
