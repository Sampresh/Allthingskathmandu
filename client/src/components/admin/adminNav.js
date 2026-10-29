import {
  BadgeCheck,
  CalendarDays,
  FileText,
  Flag,
  FolderTree,
  Globe,
  House,
  Images,
  LayoutDashboard,
  MapPin,
  MessageSquareText,
  Package,
  Receipt,
  ScrollText,
  SearchCode,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  Users,
} from 'lucide-react'

const RANK = { MODERATOR: 1, ADMIN: 2, SUPER_ADMIN: 3 }

export const canSee = (role, min) => (RANK[role] ?? 0) >= RANK[min]

/**
 * Admin sidebar, grouped by job (Part 4 §3). `min` is the lowest role that sees an item
 * (Part 3 §7); `queue` names its pending count in GET /admin/overview.
 */
export const ADMIN_NAV = [
  {
    title: 'Overview',
    items: [
      {
        href: '/admin',
        label: 'Dashboard',
        icon: LayoutDashboard,
        min: 'MODERATOR',
        description: 'Queues and site numbers at a glance',
      },
    ],
  },
  {
    title: 'Review queue',
    items: [
      {
        href: '/admin/claims',
        label: 'Claims',
        icon: BadgeCheck,
        min: 'MODERATOR',
        queue: 'claims',
        description: 'Owners asking to manage a listing',
      },
      {
        href: '/admin/reviews',
        label: 'Reviews',
        icon: MessageSquareText,
        min: 'MODERATOR',
        queue: 'reviews',
        description: 'New ratings waiting to go live',
      },
      {
        href: '/admin/reports',
        label: 'Reports',
        icon: Flag,
        min: 'MODERATOR',
        queue: 'reports',
        description: 'Wrong info and abuse flagged by visitors',
      },
      {
        href: '/admin/events',
        label: 'Events',
        icon: CalendarDays,
        min: 'MODERATOR',
        queue: 'events',
        description: 'Submitted events to approve',
      },
      {
        href: '/admin/market',
        label: 'Market items',
        icon: ShoppingBag,
        min: 'MODERATOR',
        queue: 'market',
        description: 'Classifieds waiting for review',
      },
    ],
  },
  {
    title: 'Directory',
    items: [
      {
        href: '/admin/listings',
        label: 'Listings',
        icon: Store,
        min: 'ADMIN',
        description: 'Businesses, apps, places and hotlines',
      },
      {
        href: '/admin/categories',
        label: 'Categories',
        icon: FolderTree,
        min: 'ADMIN',
        description: 'Groups and categories, in display order',
      },
      {
        href: '/admin/tags',
        label: 'Tags',
        icon: Tags,
        min: 'ADMIN',
        description: 'Filter chips shown on category pages',
      },
      {
        href: '/admin/areas',
        label: 'Areas',
        icon: MapPin,
        min: 'ADMIN',
        description: 'Neighbourhoods for the area picker',
      },
    ],
  },
  {
    title: 'Website',
    items: [
      {
        href: '/admin/homepage',
        label: 'Homepage',
        icon: House,
        min: 'ADMIN',
        description: 'Order and visibility of homepage sections',
      },
      {
        href: '/admin/pages',
        label: 'Pages',
        icon: FileText,
        min: 'ADMIN',
        description: 'About, terms, privacy and other pages',
      },
      {
        href: '/admin/media',
        label: 'Media',
        icon: Images,
        min: 'ADMIN',
        description: 'Uploaded photos and videos',
      },
    ],
  },
  {
    title: 'Search & SEO',
    items: [
      {
        href: '/admin/seo',
        label: 'SEO',
        icon: Globe,
        min: 'ADMIN',
        description: 'Titles and descriptions for search engines',
      },
      {
        href: '/admin/synonyms',
        label: 'Search synonyms',
        icon: SearchCode,
        min: 'ADMIN',
        description: 'Words that should find the same results',
      },
    ],
  },
  {
    title: 'Billing',
    items: [
      {
        href: '/admin/plans',
        label: 'Plans',
        icon: Package,
        min: 'ADMIN',
        description: 'Prices and limits for business plans',
      },
      {
        href: '/admin/payments',
        label: 'Payments',
        icon: Receipt,
        min: 'ADMIN',
        description: 'Khalti and eSewa transactions',
      },
    ],
  },
  {
    title: 'People & system',
    items: [
      {
        href: '/admin/users',
        label: 'Users',
        icon: Users,
        min: 'ADMIN',
        description: 'Accounts, roles and suspensions',
      },
      {
        href: '/admin/settings',
        label: 'Settings',
        icon: Settings,
        min: 'ADMIN',
        description: 'Emergency numbers, social links and more',
      },
      {
        href: '/admin/audit',
        label: 'Audit log',
        icon: ScrollText,
        min: 'SUPER_ADMIN',
        description: 'Every change made in the admin',
      },
    ],
  },
]

/** The nav filtered to what `role` may open. */
export const navFor = (role) =>
  ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(role, item.min)),
  })).filter((group) => group.items.length)

export const isActiveHref = (pathname, href) =>
  href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

/** { group, item } for the page at `pathname`, for the breadcrumb. */
export function findNavItem(pathname) {
  for (const group of ADMIN_NAV) {
    const item = group.items.find((i) => isActiveHref(pathname, i.href))
    if (item) return { group, item }
  }
  return null
}

export const QUEUE_ITEMS = ADMIN_NAV.flatMap((g) => g.items).filter((i) => i.queue)
