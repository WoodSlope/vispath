const DB_NAME = "ai-visual-direction-board";
const DB_VERSION = 1;
const STORE_NAME = "workspace";
const HISTORY_KEY = "generation-history";
const API_SETTINGS_KEY = "api-settings";
const HISTORY_SCHEMA_VERSION = 5;
const ENTRY_FIELDS = [
  "id", "batchId", "batchNumber", "batchCreatedAt", "variantTitle", "changeSummary", "promptSnapshot",
  "artClass", "ratio", "resolution", "createdAt", "startedAt", "completedAt", "status", "imageUrl", "errorMessage", "taskId"
];

function sanitizeEntry(entry) {
  const clean = {};
  for (const field of ENTRY_FIELDS) {
    if (entry?.[field] !== undefined) clean[field] = entry[field];
  }
  clean.batchNumber = String(clean.batchNumber || "00");
  clean.batchId = String(clean.batchId || `legacy_batch_${clean.batchNumber}`);
  clean.batchCreatedAt = typeof clean.batchCreatedAt === "string" ? clean.batchCreatedAt : "";
  clean.status = ["loading", "ready", "error"].includes(clean.status) ? clean.status : "error";
  return clean;
}

export function sanitizeGenerationHistory(payload) {
  if (!payload || typeof payload !== "object") return null;
  const entries = Array.isArray(payload.entries) ? payload.entries.map(sanitizeEntry) : [];
  const clean = {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    entries,
    batchNumber: Number(payload.batchNumber) || 0,
    savedAt: typeof payload.savedAt === "string" ? payload.savedAt : new Date(0).toISOString()
  };
  const migrated = payload.schemaVersion !== HISTORY_SCHEMA_VERSION || JSON.stringify(payload) !== JSON.stringify(clean);
  return { ...clean, migrated };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction(mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadGenerationHistory() {
  const payload = await runTransaction("readonly", (store) => store.get(HISTORY_KEY));
  return sanitizeGenerationHistory(payload);
}

export function saveGenerationHistory(payload) {
  const clean = sanitizeGenerationHistory(payload);
  if (!clean) throw new Error("历史记录格式无效");
  const { migrated, ...stored } = clean;
  return runTransaction("readwrite", (store) => store.put(stored, HISTORY_KEY));
}

export function clearGenerationHistory() {
  return runTransaction("readwrite", (store) => store.delete(HISTORY_KEY));
}

export function loadApiSettings() {
  return runTransaction("readonly", (store) => store.get(API_SETTINGS_KEY));
}

export function saveApiSettings(settings) {
  const clean = {
    textBaseUrl: String(settings?.textBaseUrl || "").trim().replace(/\/$/, ""),
    textApiKey: String(settings?.textApiKey || "").trim(),
    textModel: String(settings?.textModel || "gpt-5.4-mini").trim(),
    imageBaseUrl: String(settings?.imageBaseUrl || "").trim().replace(/\/$/, ""),
    imageApiKey: String(settings?.imageApiKey || "").trim(),
    imageModel: String(settings?.imageModel || "gpt-image-2").trim()
  };
  return runTransaction("readwrite", (store) => store.put(clean, API_SETTINGS_KEY));
}

export function clearApiSettings() {
  return runTransaction("readwrite", (store) => store.delete(API_SETTINGS_KEY));
}
