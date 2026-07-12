export const BREAKPOINTS = [320, 480, 640, 768, 1024, 1280, 1536] as const;

function extractUploadBaseAndId(url: string): { base: string; publicId: string } | null {
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload)\/(.*)$/);
  if (!match) return null;
  const [, base, rest] = match;
  const publicId = rest.includes(",") ? rest.slice(rest.indexOf("/") + 1) : rest;
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
