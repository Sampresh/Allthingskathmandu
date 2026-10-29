#!/bin/sh
# Runs once, on first start of an empty volume. Creates the databases used by `npm test`
# (server) and the Playwright end-to-end run (client).
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  CREATE DATABASE atk_test OWNER $POSTGRES_USER;
  CREATE DATABASE atk_e2e OWNER $POSTGRES_USER;
SQL
