## What

<!-- One or two lines: what this PR changes. -->

## Why

<!-- Link the spec section (docs/SPEC.md Part / §) or issue this implements. -->

## Checklist

- [ ] Follows `CLAUDE.md` (stack, layer rules, security defaults)
- [ ] Server: `npm run lint` and `npm test` pass
- [ ] Client: `npm run lint` and `npm run build` pass
- [ ] Migrations created with `--create-only`, SQL reviewed, no unwanted `DROP` lines (PostGIS, trigger, indexes)
- [ ] Migration is backward compatible (add, backfill, switch, then drop in a later release)
- [ ] New env variables added to `.env.example` and `render.yaml` / Vercel
- [ ] No secrets, `.env` files or `TODO` stubs committed
- [ ] `CHANGELOG.md` updated

## How to test

<!-- Steps or commands a reviewer can run. -->
