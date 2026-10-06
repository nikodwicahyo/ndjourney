// CI runners hit Neon half a world away, so data-dependent assertions get a
// 2x budget there. Timeouts only bite on failure — green runs resolve in
// seconds either way, so local runs stay strict and fast.
export function t(ms: number): number {
  return process.env.CI ? ms * 2 : ms;
}
