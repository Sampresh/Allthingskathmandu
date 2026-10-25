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
  'claim-approved': ({ name, listingName, url }) => ({
    subject: `Your claim for ${listingName} is approved`,
    text: `Hi ${name},\n\nYou now manage ${listingName} on All Things Kathmandu. Update it from your business portal:\n${url}`,
    html: layout(
      `<p>Hi ${escape(name)},</p><p>You now manage <strong>${escape(listingName)}</strong> on All Things Kathmandu.</p>${button(url, 'Open business portal')}`,
    ),
  }),
  'claim-rejected': ({ name, listingName, reason }) => ({
    subject: `Your claim for ${listingName}`,
    text: `Hi ${name},\n\nWe could not approve your claim for ${listingName}.${reason ? `\nReason: ${reason}` : ''}\n\nReply to this email if you can send more proof.`,
    html: layout(
      `<p>Hi ${escape(name)},</p><p>We could not approve your claim for <strong>${escape(listingName)}</strong>.</p>${reason ? `<p>Reason: ${escape(reason)}</p>` : ''}<p>Reply to this email if you can send more proof.</p>`,
    ),
  }),
  'renewal-reminder': ({ name, listingName, planName, daysLeft, endsAt, url }) => ({
    subject: `${planName} for ${listingName} ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    text: `Hi ${name},\n\nThe ${planName} plan for ${listingName} ends on ${endsAt}. Renew to keep photos, videos, offers and top placement:\n${url}`,
    html: layout(
      `<p>Hi ${escape(name)},</p><p>The ${escape(planName)} plan for <strong>${escape(listingName)}</strong> ends on ${escape(endsAt)}. Renew to keep photos, videos, offers and top placement.</p>${button(url, 'Renew plan')}`,
    ),
  }),
  'market-expired': ({ name, title, url }) => ({
    subject: `Your market listing "${title}" has expired`,
    text: `Hi ${name},\n\n"${title}" was live for 30 days and has now come down from the market. If it is still for sale, edit it to send it for a quick check again:\n${url}`,
    html: layout(
      `<p>Hi ${escape(name)},</p><p><strong>${escape(title)}</strong> was live for 30 days and has now come down from the market. If it is still for sale, edit it to send it for a quick check again.</p>${button(url, 'My market items')}`,
    ),
  }),
  'contact-message': ({ name, email, message }) => ({
    subject: `Contact form: ${name}`,
    text: `From: ${name} <${email}>\n\n${message}`,
    html: layout(
      `<p><strong>From:</strong> ${escape(name)} &lt;${escape(email)}&gt;</p><p style="white-space:pre-line">${escape(message)}</p>`,
    ),
  }),
}

export function renderEmail(template, data) {
  const render = templates[template]
  if (!render) throw new Error(`unknown email template: ${template}`)
  return render(data)
}

/** Queues an email; the worker renders and sends it (never inline in a request). */
export function queueEmail(to, template, data, { replyTo } = {}) {
  if (!templates[template]) throw new Error(`unknown email template: ${template}`)
  return enqueue(QUEUE.EMAIL, 'send', { to, template, data, ...(replyTo && { replyTo }) })
}

export const clientUrl = (path) => new URL(path, env.CLIENT_URL).toString()
