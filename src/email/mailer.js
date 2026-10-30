import nodemailer from 'nodemailer'

let transporter

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      },
    })
  }
  return transporter
}

// true once the required Gmail OAuth2 env vars are present; callers fall back to another delivery method otherwise
export function isMailerConfigured() {
  const { GMAIL_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env
  return Boolean(GMAIL_USER && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN)
}

export async function sendMail({ to, subject, text }) {
  await getTransporter().sendMail({
    // Gmail always rewrites the From header to the authenticated account anyway
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
  })
}
