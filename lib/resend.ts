import { Resend } from "resend";

const globalForResend = globalThis as unknown as {
  resend: Resend | undefined;
};

function getResend(): Resend | undefined {
  const key = process.env.RESEND_API_KEY;
  if (!key) return undefined;
  return new Resend(key);
}

export const resend = globalForResend.resend ?? getResend();

if (process.env.NODE_ENV !== "production") {
  globalForResend.resend = resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@couple.com";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!resend) {
    console.warn("Resend not configured — email not sent");
    return { error: "Resend not configured" };
  }

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });

  return result;
}

export function letterNotificationHtml(senderName: string, letterTitle: string, url: string): string {
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #FFF1F2; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">💌</span>
      </div>
      <h1 style="font-family: 'Playfair Display', serif; color: #F43F5E; text-align: center; font-size: 24px; margin-bottom: 8px;">
        Surat Baru dari ${senderName}!
      </h1>
      <p style="color: #881337; text-align: center; font-size: 16px; margin-bottom: 24px;">
        "${letterTitle}"
      </p>
      <div style="text-align: center;">
        <a href="${url}" style="display: inline-block; background: #F43F5E; color: white; text-decoration: none; padding: 12px 32px; border-radius: 9999px; font-size: 16px; font-weight: 600;">
          Baca Surat ❤️
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
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #FFF7ED; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">🎁</span>
      </div>
      <h1 style="font-family: 'Playfair Display', serif; color: #F97316; text-align: center; font-size: 24px; margin-bottom: 8px;">
        Time Capsule Terbuka!
      </h1>
      <p style="color: #7C2D12; text-align: center; font-size: 16px; margin-bottom: 8px;">
        Surat dari ${senderName} — "${letterTitle}" — sudah bisa dibuka!
      </p>
      <div style="text-align: center;">
        <a href="${url}" style="display: inline-block; background: #F97316; color: white; text-decoration: none; padding: 12px 32px; border-radius: 9999px; font-size: 16px; font-weight: 600;">
          Buka Sekarang 🎉
        </a>
      </div>
    </div>
  `;
}
