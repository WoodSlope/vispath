export function createImageRequest({ model, prompt, ratio, generationMode = "async" }) {
  const request = {
    model,
    prompt,
    n: 1,
    aspect_ratio: ratio || "1:1",
    response_format: "url"
  };
  if (generationMode === "sync") {
    request.quality = "standard";
    request.watermark = false;
  }
  return request;
}
