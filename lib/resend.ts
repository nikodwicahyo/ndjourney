import nodemailer from "nodemailer";

const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "noreply@couple.com";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

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
    console.error("[SMTP] Connection verification failed:", error);
    transporter = null;
    return null;
  }

  return transporter;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const t = await getTransporter();

  if (!t) {
    console.warn("SMTP not configured — email not sent");
    return { error: "SMTP not configured" };
  }

  try {
    const result = await t.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    return { data: { id: result.messageId } };
  } catch (error) {
    console.error("[SMTP_ERROR]", error);
    return { error: String(error) };
  }
}

export function noteNotificationHtml(
  senderName: string,
  content: string,
  url: string,
): string {
  const preview = content.length > 150 ? content.slice(0, 150) + "..." : content;
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #F0FDF4; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">\u{1F4DD}</span>
      </div>
      <h1 style="font-family: 'Playfair Display', serif; color: #16A34A; text-align: center; font-size: 24px; margin-bottom: 8px;">
        Catatan Baru dari ${senderName}!
      </h1>
      <p style="color: #14532D; text-align: center; font-size: 16px; margin-bottom: 16px; font-style: italic;">
        "${preview}"
      </p>
      <div style="text-align: center;">
        <a href="${url}" style="display: inline-block; background: #16A34A; color: white; text-decoration: none; padding: 12px 32px; border-radius: 9999px; font-size: 16px; font-weight: 600;">
          Baca Catatan \u{1F49A}
        </a>
      </div>
    </div>
  `;
}

export function letterNotificationHtml(senderName: string, letterTitle: string, url: string): string {
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #FFF1F2; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">\u{1F48C}</span>
      </div>
      <h1 style="font-family: 'Playfair Display', serif; color: #F43F5E; text-align: center; font-size: 24px; margin-bottom: 8px;">
        Surat Baru dari ${senderName}!
      </h1>
      <p style="color: #881337; text-align: center; font-size: 16px; margin-bottom: 24px;">
        "${letterTitle}"
      </p>
      <div style="text-align: center;">
        <a href="${url}" style="display: inline-block; background: #F43F5E; color: white; text-decoration: none; padding: 12px 32px; border-radius: 9999px; font-size: 16px; font-weight: 600;">
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
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #FFF7ED; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">\u{1F381}</span>
      </div>
      <h1 style="font-family: 'Playfair Display', serif; color: #F97316; text-align: center; font-size: 24px; margin-bottom: 8px;">
        Time Capsule Terbuka!
      </h1>
      <p style="color: #7C2D12; text-align: center; font-size: 16px; margin-bottom: 8px;">
        Surat dari ${senderName} — "${letterTitle}" — sudah bisa dibuka!
      </p>
      <div style="text-align: center;">
        <a href="${url}" style="display: inline-block; background: #F97316; color: white; text-decoration: none; padding: 12px 32px; border-radius: 9999px; font-size: 16px; font-weight: 600;">
          Buka Sekarang \u{1F389}
        </a>
      </div>
    </div>
  `;
}
