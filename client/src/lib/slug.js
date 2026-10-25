// Same rule as the API: lowercase words joined by single hyphens.
export const isSlug = (value) =>
  typeof value === 'string' && value.length <= 160 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
