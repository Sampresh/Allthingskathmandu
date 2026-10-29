'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

/**
 * Collapsible sidebar: grouped links with icons and count badges. Collapsed, it is a 64 px icon
 * rail (labels move to tooltips and aria-labels). Rendered without `onToggleCollapsed` it is the
 * full-width drawer body used on phones.
 *
 * groups: [{ title, items: [{ href, label, icon, badge?, description? }] }]
 */
export function Sidebar({
  brand,
  groups,
  isActive,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  className,
}) {
  return (
    <div className={clsx('flex h-full flex-col', className)}>
      <SidebarBrand {...brand} collapsed={collapsed} onNavigate={onNavigate} />

      <nav aria-label={brand.navLabel} className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group, index) => (
          <div key={group.title} className={clsx(index > 0 && 'mt-4')}>
            {collapsed ? (
              index > 0 && <hr className="mx-3 mb-3 border-border" />
            ) : (
              <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-text-muted uppercase">
                {group.title}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink
                    item={item}
                    active={isActive(item.href)}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="flex min-h-12 items-center gap-3 border-t border-border px-5 text-sm font-semibold text-text-muted hover:bg-surface-raised hover:text-text"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-5 shrink-0" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-5 shrink-0" />
          )}
          {!collapsed && 'Collapse'}
        </button>
      )}
    </div>
  )
}

function SidebarBrand({ title, subtitle, href, icon: Icon, collapsed, onNavigate }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? title : undefined}
      className={clsx(
        'flex min-h-16 shrink-0 items-center gap-3 border-b border-border hover:bg-surface-raised',
        collapsed ? 'justify-center px-2' : 'px-4',
      )}
    >
      <span className="grid size-9 shrink-0 place-content-center rounded-box bg-brand text-brand-contrast">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      {collapsed ? (
        <span className="sr-only">{title}</span>
      ) : (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs text-text-muted">{subtitle}</span>
        </span>
      )}
    </Link>
  )
}

function SidebarLink({ item, active, collapsed, onNavigate }) {
  const { href, label, icon: Icon, badge } = item
  const hasBadge = typeof badge === 'number' && badge > 0
  const badgeText = badge > 99 ? '99+' : badge

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? (hasBadge ? `${label}, ${badge} waiting` : label) : undefined}
      title={collapsed ? label : item.description}
      className={clsx(
        'relative flex min-h-11 items-center rounded-box text-sm transition-colors',
        collapsed ? 'justify-center' : 'gap-3 pr-3 pl-3',
        active
          ? 'bg-brand/10 font-semibold text-brand'
          : 'text-text-muted hover:bg-surface-raised hover:text-text',
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-0.5 rounded-pill bg-brand"
        />
      )}
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {hasBadge &&
        (collapsed ? (
          <span
            aria-hidden="true"
            className="absolute top-2 right-3 size-2 rounded-pill bg-danger ring-2 ring-surface"
          />
        ) : (
          <span className="inline-flex min-w-6 items-center justify-center rounded-pill bg-brand px-1.5 text-xs font-semibold text-brand-contrast">
            {badgeText}
            <span className="sr-only"> waiting</span>
          </span>
        ))}
    </Link>
  )
}
