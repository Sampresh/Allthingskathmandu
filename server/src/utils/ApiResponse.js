// Success envelope: { success: true, data, meta? } (Part 6 §1).
export function ok(res, data = null, meta, status = 200) {
  const body = { success: true, data }
  if (meta) body.meta = meta
  return res.status(status).json(body)
}

export function created(res, data = null, meta) {
  return ok(res, data, meta, 201)
}

export function noContent(res) {
  return res.status(204).end()
}
