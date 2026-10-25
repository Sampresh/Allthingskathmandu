import { ApiError } from '../utils/ApiError.js'

// Staff roles include the ones below them: SUPER_ADMIN ⊇ ADMIN ⊇ MODERATOR (Part 3 §7).
const STAFF_RANK = { MODERATOR: 1, ADMIN: 2, SUPER_ADMIN: 3 }

export const isStaff = (role) => role in STAFF_RANK

/**
 * Allows the listed roles (staff roles also admit higher staff). Staff reaching a staff
 * route must have TOTP enabled and a session that passed the 2FA step.
 * Use after verifyToken.
 */
export function requireRole(...roles) {
  const lowestStaffRank = Math.min(...roles.map((r) => STAFF_RANK[r] ?? Infinity))

  return (req, res, next) => {
    const { role, totpEnabled } = req.user ?? {}
    if (!role) throw ApiError.unauthorized()

    const viaStaffRank = isStaff(role) && STAFF_RANK[role] >= lowestStaffRank
    if (!roles.includes(role) && !viaStaffRank) throw ApiError.forbidden()

    if (isStaff(role) && lowestStaffRank !== Infinity && !(totpEnabled && req.auth?.mfa)) {
      throw ApiError.forbidden('Two-factor authentication is required', 'TWO_FACTOR_REQUIRED')
    }
    next()
  }
}
