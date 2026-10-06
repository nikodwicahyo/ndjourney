export const BREAKPOINTS = [320, 480, 640, 768, 1024, 1280, 1536] as const;

function extractUploadBaseAndId(url: string): { base: string; publicId: string } | null {
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload)\/(.*)$/);
  if (!match) return null;
  const [, base, rest] = match;
  const firstSlash = rest.indexOf("/");
  const publicId = rest.includes(",") && firstSlash >= 0 ? rest.slice(firstSlash + 1) : rest;
  return { base: base + "/", publicId };
}

function buildTransform(opts: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(opts)) {
    if (val !== undefined && val !== "") {
      parts.push(`${key}_${val}`);
    }
  }
  return parts.join(",");
}

export function getOptimizedImageUrl(
  imageUrl: string,
  width = 800,
  options: { quality?: string | number; format?: string; crop?: string } = {},
): string {
  const extracted = extractUploadBaseAndId(imageUrl);
  if (!extracted) return imageUrl;
  const opts = { q: options.quality ?? "auto", f: options.format ?? "auto", w: width, c: options.crop ?? "limit" };
  return `${extracted.base}${buildTransform(opts)}/${extracted.publicId}`;
}

export function getBlurImageUrl(imageUrl: string, size = 20): string {
  const extracted = extractUploadBaseAndId(imageUrl);
  if (!extracted) return imageUrl;
  return `${extracted.base}w_${size},h_${size},c_fill,q_1,e_blur:1000/${extracted.publicId}`;
}

export function getResponsiveImageUrls(
  imageUrl: string,
  options: { quality?: string | number; format?: string } = {},
): { width: number; url: string }[] {
  return BREAKPOINTS.map((w) => ({
    width: w,
    url: getOptimizedImageUrl(imageUrl, w, options),
  }));
}

export function getImageSrcSet(
  imageUrl: string,
  options: { quality?: string | number; format?: string } = {},
): string {
  return getResponsiveImageUrls(imageUrl, options)
    .map(({ width, url }) => `${url} ${width}w`)
    .join(", ");
}

export function getOptimizedVideoUrl(
  videoUrl: string,
  width = 1280,
  options: { quality?: string; codec?: string } = {},
): string {
  const extracted = extractUploadBaseAndId(videoUrl);
  if (!extracted) return videoUrl;
  const opts = {
    q: options.quality ?? "auto",
    vc: options.codec ?? "auto",
    w: width,
    c: "limit" as const,
  };
  return `${extracted.base}${buildTransform(opts)}/${extracted.publicId}`;
}

export function getVideoPosterUrl(videoUrl: string, width = 800): string {
  const match = videoUrl.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+)\/video\/upload\/(.*)$/);
  if (!match) return videoUrl;
  const [, base, rest] = match;
  const firstSlash = rest.indexOf("/");
  const publicId = rest.includes(",") && firstSlash >= 0 ? rest.slice(firstSlash + 1) : rest;
  const baseName = publicId.replace(/\.[^.]+$/, "");
  return `${base}/image/upload/so_0,w_${width},c_limit,q_auto,f_auto/${baseName}.jpg`;
}

// Thumbnail for a fresh Cloudinary upload response (shared by the chunked
// client uploader and the server upload route — was copy-pasted in both).
export function getUploadThumbnailUrl(secureUrl: string, resourceType: string): string {
  const transform = "w_400,h_400,c_fill,q_auto";
  if (resourceType === "video") {
    return buildTransformedDeliveryUrl(secureUrl, `${transform},f_jpg`, "jpg");
  }
  if (resourceType === "image") {
    return buildTransformedDeliveryUrl(secureUrl, `${transform},f_auto`);
  }
  return secureUrl;
}

function buildTransformedDeliveryUrl(
  secureUrl: string,
  transformation: string,
  format?: string,
): string {
  const [baseUrl, query = ""] = secureUrl.split("?");
  const transformedUrl = baseUrl.replace("/upload/", `/upload/${transformation}/`);
  const withFormat = format ? transformedUrl.replace(/\.[^/.]+$/, `.${format}`) : transformedUrl;
  return query ? `${withFormat}?${query}` : withFormat;
}
