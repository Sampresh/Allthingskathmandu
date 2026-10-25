/** One line and one action (Part 4 §7). */
export function EmptyState({ message, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-box border border-dashed border-border p-6">
      <p className="text-text-muted">{message}</p>
      {action}
    </div>
  )
}
