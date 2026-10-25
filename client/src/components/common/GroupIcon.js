import {
  BedDouble,
  Briefcase,
  Car,
  HeartPulse,
  Landmark,
  LayoutGrid,
  ShoppingBag,
  Siren,
  Smartphone,
  Utensils,
  Wrench,
} from 'lucide-react'

// Icon names stored on groups (Admin can change them); unknown names get a neutral icon.
const ICONS = {
  utensils: Utensils,
  car: Car,
  'bed-double': BedDouble,
  smartphone: Smartphone,
  'heart-pulse': HeartPulse,
  'shopping-bag': ShoppingBag,
  landmark: Landmark,
  wrench: Wrench,
  briefcase: Briefcase,
  siren: Siren,
}

export function GroupIcon({ name, className = 'size-6' }) {
  const Icon = ICONS[name] ?? LayoutGrid
  return <Icon aria-hidden="true" className={className} />
}
