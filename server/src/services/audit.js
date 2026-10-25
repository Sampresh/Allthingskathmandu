/** Fields that changed between `before` and the patch actually applied. */
export function changedFields(before, patch) {
  const diff = {}
  for (const [key, value] of Object.entries(patch)) {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(value)) {
      diff[key] = { from: before?.[key] ?? null, to: value ?? null }
    }
  }
  return diff
}

/**
 * Writes an audit_logs row (every admin and owner change, Part 5 §2). Pass the transaction
 * client so the log commits or rolls back with the change.
 */
export function audit(client, req, { action, entity, entityId, diff }) {
  return client.auditLog.create({
    data: {
      actorId: req.user?.id ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      diff: diff && Object.keys(diff).length ? diff : undefined,
      ip: req.ip,
    },
  })
}
