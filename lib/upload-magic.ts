/**
 * Magic-bytes content sniffing for uploads.
 * Client-controlled `file.type` is a claim, not a fact — verify the bytes.
 */
// ponytail: single table shared by /upload, /upload/bulk, /upload/server.
export const MAGIC_BYTES: Record<string, string[]> = {
  "image/jpeg": ["ffd8ff"],
  "image/png": ["89504e47"],
  "image/webp": ["52494646"],
  "image/heic": ["00000018", "0000001c"],
  "video/mp4": ["00000018", "0000001c", "66747970", "6d646174", "6d6f6f76", "77696465"],
  "video/webm": ["1a45dfa3"],
  "video/quicktime": ["66747970", "6d646174", "6d6f6f76", "77696465"],
  "video/x-msvideo": ["52494646"],
  "video/x-matroska": ["1a45dfa3"],
  "video/ogg": ["4f676753"],
  "video/mpeg": ["000001ba", "000001b3"],
  // MP3: ID3 header or MPEG frame sync
  "audio/mpeg": ["494433", "fffb", "fff3", "fff2", "ffe3", "ffe2"],
};

export function checkMagicBytes(buffer: Buffer, fileType: string): boolean {
  const sigs = MAGIC_BYTES[fileType];
  if (!sigs) return true; // unknown type: no claim to verify (policy allowlist decides)
  const checkLength = fileType.startsWith("video/") ? 16 : 8;
  const hex = buffer.subarray(0, checkLength).toString("hex");
  return sigs.some((sig) => hex.includes(sig));
}
