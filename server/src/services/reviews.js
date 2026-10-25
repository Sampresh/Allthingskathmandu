/** Recomputes a listing's rating from its approved reviews. Pass the transaction client. */
export function recomputeRating(client, businessId) {
  return client.$executeRaw`
    UPDATE businesses b SET
      "ratingAvg" = COALESCE((
        SELECT round(avg(r.rating)::numeric, 1) FROM reviews r
        WHERE r."businessId" = b.id AND r.status = 'APPROVED'), 0),
      "ratingCount" = (
        SELECT count(*) FROM reviews r WHERE r."businessId" = b.id AND r.status = 'APPROVED')
    WHERE b.id = ${businessId}::uuid`
}
