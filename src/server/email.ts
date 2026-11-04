import { getEnv } from "@/lib/env";

export function isEmailConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Envoi transactionnel via Resend.
 * Aucune intégration ne doit être annoncée comme active si les variables
 * RESEND_API_KEY et EMAIL_FROM ne sont pas renseignées.
 */
async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const env = getEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error("Envoi d'e-mail non configuré");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Resend a refusé l'envoi (${response.status})`);
  }
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<void> {
  const name = escapeHtml(input.name);
  const resetUrl = escapeHtml(input.resetUrl);

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
            <tr><td>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#15803d;font-weight:bold;">Stockely</p>
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">Réinitialisation du mot de passe</h1>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#64748b;">Bonjour ${name},</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;">Une demande de réinitialisation a été faite pour votre compte. Ce lien est valable ${input.expiresInMinutes} minutes et ne peut être utilisé qu'une fois.</p>
              <p style="margin:0 0 24px;">
                <a href="${resetUrl}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 20px;border-radius:8px;">Choisir un nouveau mot de passe</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste inchangé.</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Bonjour ${input.name},`,
    "",
    "Une demande de réinitialisation de votre mot de passe Stockely a été faite.",
    `Lien valable ${input.expiresInMinutes} minutes, utilisable une seule fois :`,
    input.resetUrl,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  ].join("\n");

  await sendEmail({
    to: input.to,
    subject: "Stockely — réinitialisation de votre mot de passe",
    html,
    text,
  });
}

export async function sendEmailVerificationEmail(input: {
  to: string;
  name: string;
  verifyUrl: string;
  expiresInMinutes: number;
}): Promise<void> {
  const name = escapeHtml(input.name);
  const verifyUrl = escapeHtml(input.verifyUrl);

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
            <tr><td>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#15803d;font-weight:bold;">Stockely</p>
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">Confirmez votre adresse e-mail</h1>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#64748b;">Bonjour ${name},</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;">Votre espace Stockely est prêt. Confirmez votre adresse pour sécuriser votre compte. Ce lien est valable ${input.expiresInMinutes} minutes.</p>
              <p style="margin:0 0 24px;">
                <a href="${verifyUrl}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 20px;border-radius:8px;">Confirmer mon adresse</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Bonjour ${input.name},`,
    "",
    "Votre espace Stockely est prêt. Confirmez votre adresse e-mail avec ce lien :",
    input.verifyUrl,
    "",
    `Lien valable ${input.expiresInMinutes} minutes.`,
    "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.",
  ].join("\n");

  await sendEmail({
    to: input.to,
    subject: "Stockely — confirmez votre adresse e-mail",
    html,
    text,
  });
}
