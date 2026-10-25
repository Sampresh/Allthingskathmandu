import nodemailer from 'nodemailer'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

const SMTP_TIMEOUT_MS = 10_000

// Without SMTP (local dev and tests) messages are rendered to JSON and logged, so links in
// verification and reset emails can be followed from the worker output.
export const smtpConfigured = Boolean(env.SMTP_HOST)

export const mailer = smtpConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    })
  : nodemailer.createTransport({ jsonTransport: true })

export const fromAddress = { name: env.FROM_NAME, address: env.FROM_EMAIL }

export async function sendMail(message) {
  const info = await mailer.sendMail({ from: fromAddress, ...message })
  if (!smtpConfigured) {
    logger.info(
      `email (not sent, SMTP not configured) to ${message.to}: ${message.subject}\n${message.text}`,
    )
  }
  return info
}
