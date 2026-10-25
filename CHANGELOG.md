# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- P0 repo setup: `docs/SPEC.md`, `CLAUDE.md`, `.env.example`, `docker-compose.yml` (PostGIS 17-3.5, Valkey 8.1, `atk_test` database for tests), `README.md`, `render.yaml`, CI workflow and PR template.

### Notes

- `render.yaml` keeps secrets as `sync: false` on each service because Render does not allow `sync: false` inside an environment group, and uses Render's current plan IDs (`1c-2g`, `0.5c-512mb`, `256mb`).
- `postgis/postgis` has no arm64 image, so local Postgres runs as `linux/amd64`.
