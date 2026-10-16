import type { DataSourceOptions } from 'typeorm';

type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

/**
 * Builds TypeORM Postgres options for local or Nhost (cloud) databases.
 * Prefer DATABASE_URL when set (Nhost dashboard connection string).
 */
export function buildDatabaseOptions(): PostgresOptions {
  const url = process.env.DATABASE_URL?.trim();
  const sslEnabled =
    process.env.DATABASE_SSL === 'true' ||
    process.env.DATABASE_SSL === '1' ||
    Boolean(url && !url.includes('localhost') && !url.includes('127.0.0.1'));

  // Set SSL only once (root option). Duplicating under `extra.ssl` can confuse
  // node-pg / Nhost and surface intermittent "no authentication method is found".
  const ssl = sslEnabled
    ? {
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
      }
    : undefined;

  // Keep idle clients short-lived: Nhost/pgBouncer can drop idle TLS sessions and
  // the next checkout then fails with "no authentication method is found".
  const pool = {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 10_000),
    connectionTimeoutMillis: Number(
      process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 15_000,
    ),
    keepAlive: true,
    keepAliveInitialDelayMillis: Number(
      process.env.DATABASE_KEEPALIVE_DELAY_MS ?? 10_000,
    ),
  };

  if (url) {
    // Prefer explicit ssl object (with rejectUnauthorized) over sslmode in the URL —
    // node-pg overwrites the ssl object when sslmode is present in the connection string.
    return {
      type: 'postgres',
      url,
      ssl,
      extra: pool,
      connectTimeoutMS: pool.connectionTimeoutMillis,
    };
  }

  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'admissions',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? 'admissions',
    ssl,
    extra: pool,
    connectTimeoutMS: pool.connectionTimeoutMillis,
  };
}
