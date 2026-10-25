import { readDb } from '../config/db.js'

// PostGIS columns are Unsupported(...) in Prisma: write with $executeRaw in the same
// transaction as the create/update, read with $queryRaw tagged templates (Part 5 §1).

/** LIVE listings within radiusMeters of a point, nearest first, with distance in meters. */
export function nearbyListings({ lat, lng, radiusMeters, limit }) {
  return readDb.$queryRaw`
    SELECT id, slug, name, "shortDesc", "logoUrl",
           ST_Distance(location, ST_MakePoint(${lng}, ${lat})::geography) AS meters
    FROM businesses
    WHERE status = 'LIVE' AND "deletedAt" IS NULL
      AND ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radiusMeters})
    ORDER BY meters, id
    LIMIT ${limit}`
}

/** Sets a listing's map pin. Pass the transaction client used for the create/update. */
export function setBusinessLocation(client, businessId, { lat, lng }) {
  return client.$executeRaw`
    UPDATE businesses
    SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    WHERE id = ${businessId}::uuid`
}

/** Sets an area's centre point. Pass the transaction client used for the create/update. */
export function setAreaCenter(client, areaId, { lat, lng }) {
  return client.$executeRaw`
    UPDATE areas
    SET center = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    WHERE id = ${areaId}::uuid`
}
