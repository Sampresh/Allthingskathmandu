import { env } from '../config/env.js'
import { QUEUE, enqueue } from '../jobs/queues.js'

const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

const button = (url, label) =>
  `<p><a href="${escape(url)}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">${escape(label)}</a></p>`

const layout = (body) =>
  `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;padding:24px">${body}<p style="color:#6b7280;font-size:14px">${escape(env.FROM_NAME)}</p></body></html>`

// Each template returns { subject, text, html } from the job data.
const templates = {
  'verify-email': ({ name, url }) => ({
    subject: 'Verify your email',
    text: `Hi ${name},\n\nConfirm your email to finish creating your All Things Kathmandu account:\n${url}\n\nThis link expires in 24 hours. If you did not sign up, ignore this email.`,
    html: layout(
      `<p>Hi ${escape(name)},</p><p>Confirm your email to finish creating your All Things Kathmandu account.</p>${button(url, 'Verify email')}<p style="color:#6b7280;font-size:14px">This link expires in 24 hours. If you did not sign up, ignore this email.</p>`,
    ),
  }),
  'reset-password': ({ name, url }) => ({
    subject: 'Reset your password',
    text: `Hi ${name},\n\nReset your password with this link:\n${url}\n\nThis link expires in 1 hour. If you did not ask for it, ignore this email; your password stays the same.`,
    html: layout(
      `<p>Hi ${escape(name)},</p><p>Reset your password with the button below.</p>${button(url, 'Reset password')}<p style="color:#6b7280;font-size:14px">This link expires in 1 hour. If you did not ask for it, ignore this email; your password stays the same.</p>`,
    ),
  }),
  'account-exists': ({ name, loginUrl, resetUrl }) => ({
    subject: 'You already have an account',
    text: `Hi ${name},\n\nSomeone tried to sign up with this email, but it already has an account.\nLog in: ${loginUrl}\nForgot your password? ${resetUrl}\n\nIf this was not you, ignore this email.`,
    html: layout(
      `<p>Hi ${escape(name)},</p><p>Someone tried to sign up with this email, but it already has an account.</p>${button(loginUrl, 'Log in')}<p>Forgot your password? <a href="${escape(resetUrl)}">Reset it</a>.</p><p style="color:#6b7280;font-size:14px">If this was not you, ignore this email.</p>`,
    ),
  }),
}

export function renderEmail(template, data) {
  const render = templates[template]
  if (!render) throw new Error(`unknown email template: ${template}`)
  return render(data)
}

/** Queues an email; the worker renders and sends it (never inline in a request). */
export function queueEmail(to, template, data) {
  if (!templates[template]) throw new Error(`unknown email template: ${template}`)
  return enqueue(QUEUE.EMAIL, 'send', { to, template, data })
}

export const clientUrl = (path) => new URL(path, env.CLIENT_URL).toString()
