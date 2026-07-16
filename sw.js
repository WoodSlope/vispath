const OPAQUE_IMAGE_CACHE_NAME = "vispath-generated-images-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_IMAGE") return;
  event.waitUntil((async () => {
    try {
      const url = new URL(event.data.url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("图片地址协议不受支持");
      const request = new Request(url.href, { mode: "no-cors", credentials: "omit" });
      const response = await fetch(request);
      if (response.type !== "opaque") throw new Error(`预期 opaque 响应，实际为 ${response.type}`);
      const cache = await caches.open(OPAQUE_IMAGE_CACHE_NAME);
      await cache.put(request, response);
      event.ports[0]?.postMessage({ ok: true });
    } catch (error) {
      event.ports[0]?.postMessage({ ok: false, error: error.message || "图片缓存失败" });
    }
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.destination !== "image") return;
  event.respondWith((async () => {
    const cache = await caches.open(OPAQUE_IMAGE_CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreVary: true });
    return cached || fetch(event.request);
  })());
});
