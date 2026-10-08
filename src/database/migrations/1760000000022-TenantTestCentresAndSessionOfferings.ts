import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes test centres tenant-scoped masters (no intake FK).
 * Moves intake onto test_sessions and replaces programme links with offering links.
 */
export class TenantTestCentresAndSessionOfferings1760000000022 implements MigrationInterface {
  name = 'TenantTestCentresAndSessionOfferings1760000000022';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE test_sessions
        ADD COLUMN IF NOT EXISTS intake_session_id UUID NULL
    `);
    await queryRunner.query(`
      UPDATE test_sessions s
      SET intake_session_id = c.intake_session_id
      FROM test_centres c
      WHERE c.id = s.test_centre_id
        AND c.tenant_id = s.tenant_id
        AND s.intake_session_id IS NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM test_sessions WHERE intake_session_id IS NULL) THEN
          RAISE EXCEPTION 'Cannot migrate: some test_sessions have no intake (missing centre intake backfill)';
        END IF;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE test_sessions
        ALTER COLUMN intake_session_id SET NOT NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_sessions_intake'
        ) THEN
          ALTER TABLE test_sessions
            ADD CONSTRAINT fk_test_sessions_intake
            FOREIGN KEY (intake_session_id) REFERENCES intakes(id) ON DELETE RESTRICT;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_sessions_tenant_intake_status
        ON test_sessions (tenant_id, intake_session_id, status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS test_session_offerings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        test_session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
        programme_offering_id UUID NOT NULL REFERENCES programme_offerings(id) ON DELETE RESTRICT,
        CONSTRAINT uq_test_session_offerings_session_offering
          UNIQUE (tenant_id, test_session_id, programme_offering_id)
      )
    `);
    await queryRunner.query(`
      INSERT INTO test_session_offerings (tenant_id, test_session_id, programme_offering_id)
      SELECT DISTINCT tsp.tenant_id, tsp.test_session_id, po.id
      FROM test_session_programmes tsp
      JOIN test_sessions s
        ON s.id = tsp.test_session_id AND s.tenant_id = tsp.tenant_id
      JOIN programme_offerings po
        ON po.tenant_id = tsp.tenant_id
       AND po.programme_id = tsp.programme_id
       AND po.intake_id = s.intake_session_id
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1
          FROM test_session_programmes tsp
          JOIN test_sessions s
            ON s.id = tsp.test_session_id AND s.tenant_id = tsp.tenant_id
          LEFT JOIN programme_offerings po
            ON po.tenant_id = tsp.tenant_id
           AND po.programme_id = tsp.programme_id
           AND po.intake_id = s.intake_session_id
          WHERE po.id IS NULL
        ) THEN
          RAISE EXCEPTION 'Cannot migrate: some test_session_programmes have no matching programme_offering for the session intake';
        END IF;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_session_offerings_offering
        ON test_session_offerings (tenant_id, programme_offering_id, test_session_id)
    `);
    await queryRunner.query('DROP TABLE IF EXISTS test_session_programmes');

    await queryRunner.query('DROP INDEX IF EXISTS idx_test_centres_tenant_intake');
    await queryRunner.query(`
      ALTER TABLE test_centres
        DROP CONSTRAINT IF EXISTS test_centres_intake_session_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE test_centres DROP COLUMN IF EXISTS intake_session_id
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_centres_tenant_active
        ON test_centres (tenant_id, active)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE test_centres
        ADD COLUMN IF NOT EXISTS intake_session_id UUID NULL
    `);
    await queryRunner.query(`
      UPDATE test_centres c
      SET intake_session_id = s.intake_session_id
      FROM (
        SELECT DISTINCT ON (test_centre_id, tenant_id)
          test_centre_id, tenant_id, intake_session_id
        FROM test_sessions
        ORDER BY test_centre_id, tenant_id, created_at DESC
      ) s
      WHERE s.test_centre_id = c.id AND s.tenant_id = c.tenant_id
        AND c.intake_session_id IS NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM test_centres WHERE intake_session_id IS NULL) THEN
          RAISE EXCEPTION 'Cannot revert: some test_centres have no sessions to recover intake from';
        END IF;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE test_centres
        ALTER COLUMN intake_session_id SET NOT NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'test_centres_intake_session_id_fkey'
        ) THEN
          ALTER TABLE test_centres
            ADD CONSTRAINT test_centres_intake_session_id_fkey
            FOREIGN KEY (intake_session_id) REFERENCES intakes(id) ON DELETE RESTRICT;
        END IF;
      END $$
    `);
    await queryRunner.query('DROP INDEX IF EXISTS idx_test_centres_tenant_active');
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_centres_tenant_intake
        ON test_centres (tenant_id, intake_session_id, active)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS test_session_programmes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        test_session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
        programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE RESTRICT,
        CONSTRAINT uq_test_session_programmes_session_programme
          UNIQUE (tenant_id, test_session_id, programme_id)
      )
    `);
    await queryRunner.query(`
      INSERT INTO test_session_programmes (tenant_id, test_session_id, programme_id)
      SELECT DISTINCT tso.tenant_id, tso.test_session_id, po.programme_id
      FROM test_session_offerings tso
      JOIN programme_offerings po ON po.id = tso.programme_offering_id
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_session_programmes_programme
        ON test_session_programmes (tenant_id, programme_id, test_session_id)
    `);
    await queryRunner.query('DROP TABLE IF EXISTS test_session_offerings');

    await queryRunner.query('ALTER TABLE test_sessions DROP CONSTRAINT IF EXISTS fk_test_sessions_intake');
    await queryRunner.query('DROP INDEX IF EXISTS idx_test_sessions_tenant_intake_status');
    await queryRunner.query('ALTER TABLE test_sessions DROP COLUMN IF EXISTS intake_session_id');
  }
}
