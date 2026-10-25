import { expireSubscriptions, sendRenewalReminders } from '../../services/subscriptionJobs.js'

export const expireJob = () => expireSubscriptions()
export const remindJob = () => sendRenewalReminders()
