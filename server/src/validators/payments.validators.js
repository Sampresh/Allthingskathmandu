import { z } from 'zod'

export const initiateBody = z.object({
  businessId: z.uuid(),
  planCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,30}$/),
})

export const khaltiVerifyBody = z.object({ pidx: z.string().trim().min(1).max(100) })

export const esewaVerifyBody = z.object({ data: z.string().trim().min(1).max(4000) })
