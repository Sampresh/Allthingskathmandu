#!/bin/sh
# Runs once, on first start of an empty volume. Creates the database used by `npm test`.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  CREATE DATABASE atk_test OWNER $POSTGRES_USER;
SQL
