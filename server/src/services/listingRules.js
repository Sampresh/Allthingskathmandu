import { ApiError } from '../utils/ApiError.js'
import { publishProblems } from '../validators/listing.schema.js'

/**
 * What the publish rules need for each listing, read from the saved rows (pass the
 * transaction client to see changes not yet committed). Returns Map id → rule input.
 */
export async function ruleInputs(client, ids) {
  if (!ids.length) return new Map()
  const [rows, pins] = await Promise.all([
    client.business.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        type: true,
        shortDesc: true,
        areaId: true,
        phone: true,
        hours: true,
        logoUrl: true,
        website: true,
        playStoreUrl: true,
        appStoreUrl: true,
        verification: true,
        categories: { select: { categoryId: true, isPrimary: true } },
      },
    }),
    client.$queryRaw`
      SELECT id, location IS NOT NULL AS pinned FROM businesses WHERE id = ANY(${ids}::uuid[])`,
  ])
  const pinned = new Map(pins.map((p) => [p.id, p.pinned]))
  return new Map(
    rows.map(({ categories, ...row }) => [
      row.id,
      {
        ...row,
        categoryIds: categories.filter((c) => c.isPrimary).map((c) => c.categoryId),
        location: pinned.get(row.id) ?? false,
      },
    ]),
  )
}

export const publishBlocked = (problems) =>
  new ApiError(
    422,
    'PUBLISH_BLOCKED',
    `Not ready to publish: ${problems.map((p) => p.message.toLowerCase()).join(', ')}`,
    problems.map(({ field, message }) => ({ path: field, message })),
  )

/** Throws a 422 listing what is missing when this listing may not go LIVE. */
export async function assertPublishable(client, id) {
  const input = (await ruleInputs(client, [id])).get(id)
  const problems = input ? publishProblems(input) : []
  if (problems.length) throw publishBlocked(problems)
}
