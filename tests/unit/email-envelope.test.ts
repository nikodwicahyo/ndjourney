import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMailMock = vi.hoisted(() => vi.fn());

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      verify: vi.fn(async () => true),
      sendMail: sendMailMock,
    })),
  },
}));

function setSmtpEnv() {
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "user@example.com";
  process.env.SMTP_PASS = "secret";
}

describe("email envelope hardening (P1 mailer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setSmtpEnv();
    sendMailMock.mockResolvedValue({ messageId: "m1" });
  });

  it("rejects CRLF header injection in `to` without calling sendMail", async () => {
    const { sendEmail } = await import("@/lib/email");
    const r = await sendEmail({
      to: "victim@x.com\r\nBcc: evil@x.com",
      subject: "hi",
      html: "<p>hi</p>",
    });
    expect(r).toMatchObject({ error: expect.any(String) });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rejects non-email recipients without calling sendMail", async () => {
    const { sendEmail } = await import("@/lib/email");
    for (const to of ["not-an-email", "", "a@b", "x".repeat(300)]) {
      sendMailMock.mockClear();
      const r = await sendEmail({ to, subject: "hi", html: "<p>hi</p>" });
      expect(r).toMatchObject({ error: expect.any(String) });
    }
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("folds CRLF in subject to inert text", async () => {
    const { sendEmail } = await import("@/lib/email");
    const r = await sendEmail({
      to: "partner@x.com",
      subject: "Surat Baru dari A\r\nBcc: evil@x.com",
      html: "<p>hi</p>",
    });
    expect(r).toMatchObject({ data: { id: "m1" } });
    expect(sendMailMock).toHaveBeenCalledOnce();
    const subject = sendMailMock.mock.calls[0][0].subject as string;
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain("Bcc: evil@x.com");
  });

  it("passes valid recipients through (trimmed) unchanged", async () => {
    const { sendEmail } = await import("@/lib/email");
    const r = await sendEmail({
      to: "  partner@x.com  ",
      subject: "💌 Surat Baru dari Pasangan!",
      html: "<p>hi</p>",
    });
    expect(r).toMatchObject({ data: { id: "m1" } });
    expect(sendMailMock.mock.calls[0][0]).toMatchObject({
      to: "partner@x.com",
      subject: "💌 Surat Baru dari Pasangan!",
    });
  });

  it("sanitizeSubject folds all CR/LF runs", async () => {
    const { sanitizeSubject } = await import("@/lib/email");
    expect(sanitizeSubject("a\r\nb\rc\nd")).toBe("a b c d");
    expect(sanitizeSubject("clean subject 💕")).toBe("clean subject 💕");
  });
});
