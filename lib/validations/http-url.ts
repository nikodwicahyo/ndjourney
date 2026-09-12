import { z } from "zod/v4";

/**
 * URL that must use http(s) — `z.string().url()` alone accepts
 * `javascript:`/`data:` (parseable by `new URL`), which executes
 * when rendered in `<a href>` / `<Image src>`.
 */
// ponytail: one allowlist for every user-supplied link in the app.
export const httpUrl = (message = "Link harus diawali http:// atau https://") =>
  z
    .string()
    .url("Link tidak valid")
    .refine(
      (u) => u.startsWith("http://") || u.startsWith("https://"),
      message,
    );
