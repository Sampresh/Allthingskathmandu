import { AREAS } from '../../prisma/data/areas.js'
import { GROUPS } from '../../prisma/data/taxonomy.js'
import { slugify } from '../lib/slug.js'
import { setAreaCenter } from './geo.js'

/** Directory categories in prisma/data/taxonomy.js: slug → { nameEn, groupSlug }. */
export function taxonomyCategories() {
  const categories = new Map()
  for (const group of GROUPS) {
    for (const [nameEn] of group.categories) {
      categories.set(slugify(nameEn), { nameEn, groupSlug: slugify(group.nameEn) })
    }
  }
  return categories
}

/**
 * Creates the groups and categories of prisma/data/taxonomy.js that are missing, matched by
 * slug, with sortOrder in listed order. Existing rows keep Admin's names, order and parent.
 */
export async function syncTaxonomy(client) {
  const result = { groupsCreated: 0, categoriesCreated: 0 }
  for (const [groupIndex, group] of GROUPS.entries()) {
    const groupSlug = slugify(group.nameEn)
    let parent = await client.category.findUnique({ where: { slug: groupSlug } })
    if (!parent) {
      parent = await client.category.create({
        data: {
          kind: 'DIRECTORY',
          slug: groupSlug,
          nameEn: group.nameEn,
          nameNe: group.nameNe,
          icon: group.icon,
          sortOrder: groupIndex,
        },
      })
      result.groupsCreated += 1
    }
    for (const [index, [nameEn, nameNe]] of group.categories.entries()) {
      const slug = slugify(nameEn)
      if (await client.category.findUnique({ where: { slug }, select: { id: true } })) continue
      await client.category.create({
        data: { kind: 'DIRECTORY', parentId: parent.id, slug, nameEn, nameNe, sortOrder: index },
      })
      result.categoriesCreated += 1
    }
  }
  return result
}

/**
 * Creates the areas of prisma/data/areas.js that are missing (with their centre) and adds
 * their aliases to existing areas, keeping any Admin added.
 */
export async function syncAreas(client) {
  const result = { created: 0, aliasesAdded: 0 }
  for (const [index, area] of AREAS.entries()) {
    const existing = await client.area.findUnique({ where: { slug: area.slug } })
    if (!existing) {
      const row = await client.area.create({
        data: {
          slug: area.slug,
          nameEn: area.nameEn,
          nameNe: area.nameNe,
          district: area.district,
          aliases: area.aliases,
          sortOrder: index,
        },
      })
      await setAreaCenter(client, row.id, { lat: area.lat, lng: area.lng })
      result.created += 1
      continue
    }
    const missing = area.aliases.filter((alias) => !existing.aliases.includes(alias))
    if (missing.length) {
      await client.area.update({
        where: { id: existing.id },
        data: { aliases: [...existing.aliases, ...missing] },
      })
      result.aliasesAdded += missing.length
    }
  }
  return result
}
