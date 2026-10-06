import { timingSafeEqual } from "crypto";

/**
 * Constant-time string compare for shared secrets (invite tokens, cron secret).
 * Plain `!==` leaks prefix info via timing; length check first.
 */
// single helper — invite-token + register + cron must compare identically.
export function safeTokenEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}
