import { clsx } from 'clsx'

export function Card({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={clsx('rounded-box border border-border bg-surface p-4', className)} {...props}>
      {children}
    </Tag>
  )
}
