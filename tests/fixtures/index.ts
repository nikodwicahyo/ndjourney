// Shared E2E fixtures: isolated users per worker, no hardcoded secrets.
export const INVITE_TOKEN = process.env.INVITE_TOKEN || "test-invite-123";

export function workerUsers(workerIndex: number) {
  const tag = `w${workerIndex}-${Date.now().toString(36)}`;
  return {
    partnerA: { name: `Partner A ${tag}`, email: `a-${tag}@test.com`, password: "supersecret12345" },
    partnerB: { name: `Partner B ${tag}`, email: `b-${tag}@test.com`, password: "supersecret12345" },
  };
}

export const JAKARTA = { latitude: -6.2, longitude: 106.816666 };
export const BANDUNG = { latitude: -6.9175, longitude: 107.6191 };

export const LETTERS = {
  plain: { title: "Untukmu", content: "Aku sayang kamu", mood: "LOVE" },
  capsule: { title: "Buka nanti", content: "Masa depan", mood: "SURPRISE" as const },
};

export const NOTE_280 = "n".repeat(280);
export const NOTE_281 = "n".repeat(281);
