import nodemailer from "nodemailer";

const FROM_NAME = process.env.SMTP_FROM_NAME || "NDjourney Apps";
const FROM_EMAIL = `"${FROM_NAME}" <${process.env.SMTP_FROM_EMAIL || "noreply@couple.com"}>`;

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

// P1 mailer hardening (nodemailer header-injection advisories, no upstream
// fix): validate the envelope centrally so all 4 callers are covered.
// `to` always originates from User.email in DB; `subject` interpolates
// user-controlled display names (register/PUT /api/user allow CRLF).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidRecipient(to: string): boolean {
  const clean = to.trim();
  if (clean.length === 0 || clean.length > 254) return false;
  if (/[\r\n]/.test(clean)) return false;
  return EMAIL_RE.test(clean);
}

/** Fold CRLF runs to a single space — header injection becomes inert text. */
export function sanitizeSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, " ");
}

// email HTML injection guard — sender names/titles are user input.
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

/** Links in emails must stay same-origin (auth-gated app routes). */
export function safeAppUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");
  const url = new URL(path, base || "http://localhost");
  if (base && url.origin !== new URL(base).origin) return base;
  return url.toString();
}

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(port) || 587,
    secure: Number(port) === 465,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
  } catch (error) {
    // log message only — error objects can echo host/credentials.
    console.error("[SMTP] Connection verification failed:", error instanceof Error ? error.message : error);
    transporter = null;
    return null;
  }

  return transporter;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  // validate before touching SMTP so bad input never reaches sendMail,
  // even when the transport is mocked in tests.
  const cleanTo = to.trim();
  if (!isValidRecipient(cleanTo)) {
    console.error("[SMTP] Rejected invalid recipient");
    return { error: "Invalid recipient" };
  }

  const t = await getTransporter();

  if (!t) {
    console.warn("SMTP not configured — email not sent");
    return { error: "SMTP not configured" };
  }

  try {
    const result = await t.sendMail({
      from: FROM_EMAIL,
      to: cleanTo,
      subject: sanitizeSubject(subject),
      html,
    });

    return { data: { id: result.messageId } };
  } catch (error) {
    // message only — Nodemailer errors embed recipients/host.
    console.error("[SMTP_ERROR]", error instanceof Error ? error.message : error);
    return { error: "Gagal mengirim email" };
  }
}

export function noteNotificationHtml(
  senderName: string,
  content: string,
  url: string,
): string {
  const preview = content.length > 150 ? content.slice(0, 150) + "..." : content;
  const safeName = escapeHtml(senderName);
  const safePreview = escapeHtml(preview);
  const safeUrl = escapeHtml(url);
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #F0FDF4; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">\u{1F4DD}</span>
      </div>
      <h1 style="font-family: 'Playfair Display', serif; color: #16A34A; text-align: center; font-size: 24px; margin-bottom: 8px;">
        Catatan Baru dari ${safeName}!
      </h1>
      <p style="color: #14532D; text-align: center; font-size: 16px; margin-bottom: 16px; font-style: italic;">
        "${safePreview}"
      </p>
      <div style="text-align: center;">
        <a href="${safeUrl}" style="display: inline-block; background: #16A34A; color: white; text-decoration: none; padding: 12px 32px; border-radius: 9999px; font-size: 16px; font-weight: 600;">
          Baca Catatan \u{1F49A}
        </a>
      </div>
    </div>
  `;
}

export function letterNotificationHtml(senderName: string, letterTitle: string, url: string): string {
  const safeName = escapeHtml(senderName);
  const safeTitle = escapeHtml(letterTitle);
  const safeUrl = escapeHtml(url);
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #FFF1F2; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">\u{1F48C}</span>
      </div>
      <h1 style="font-family: 'Playfair Display', serif; color: #F43F5E; text-align: center; font-size: 24px; margin-bottom: 8px;">
        Surat Baru dari ${safeName}!
      </h1>
      <p style="color: #881337; text-align: center; font-size: 16px; margin-bottom: 24px;">
        "${safeTitle}"
      </p>
      <div style="text-align: center;">
        <a href="${safeUrl}" style="display: inline-block; background: #F43F5E; color: white; text-decoration: none; padding: 12px 32px; border-radius: 9999px; font-size: 16px; font-weight: 600;">
          Baca Surat \u{2764}\u{FE0F}
        </a>
      </div>
    </div>
  `;
}

export function timeCapsuleNotificationHtml(
  senderName: string,
  letterTitle: string,
  url: string,
): string {
  const safeName = escapeHtml(senderName);
  const safeTitle = escapeHtml(letterTitle);
  const safeUrl = escapeHtml(url);
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #FFF7ED; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">\u{1F381}</span>
      </div>
      <h1 style="font-family: 'Playfair Display', serif; color: #F97316; text-align: center; font-size: 24px; margin-bottom: 8px;">
        Time Capsule Terbuka!
      </h1>
      <p style="color: #7C2D12; text-align: center; font-size: 16px; margin-bottom: 8px;">
        Surat dari ${safeName} — "${safeTitle}" — sudah bisa dibuka!
      </p>
      <div style="text-align: center;">
        <a href="${safeUrl}" style="display: inline-block; background: #F97316; color: white; text-decoration: none; padding: 12px 32px; border-radius: 9999px; font-size: 16px; font-weight: 600;">
          Buka Sekarang \u{1F389}
        </a>
      </div>
    </div>
  `;
}
