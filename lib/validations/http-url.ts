import { z } from "zod/v4";

/**
 * URL that must use http(s) — `z.string().url()` alone accepts
 * `javascript:`/`data:` (parseable by `new URL`), which executes
 * when rendered in `<a href>` / `<Image src>`.
 */
// one allowlist for every user-supplied link in the app.
export const httpUrl = (message = "Link harus diawali http:// atau https://") =>
  z
    .string()
    .url("Link tidak valid")
    .refine(
      (u) => u.startsWith("http://") || u.startsWith("https://"),
      message,
    )
    // Double quotes/angle brackets/control bytes can break out of an HTML
    // attribute or a header. They are invalid raw in a URL, so reject them
    // at the edge (apostrophes remain valid in query strings).
    .refine(
      (u) => !/[\u0000-\u001F\u007F"<>]/.test(u),
      "Link mengandung karakter tidak valid",
    );
