import { sendMail } from '../../config/mailer.js'
import { renderEmail } from '../../services/email.js'

export async function sendEmailJob(job) {
  const { to, template, data, replyTo } = job.data
  const message = renderEmail(template, data)
  const info = await sendMail({ to, ...(replyTo && { replyTo }), ...message })
  return { messageId: info.messageId }
}
