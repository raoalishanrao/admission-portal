import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves programme eligibility off test_sessions into a many-to-many table,
 * preserving each session's existing programme association. Removes the
 * applicant-selected centre column now that session allocation is automatic.
 */
export class ShareTestSessionsAcrossProgrammes1760000000016 implements MigrationInterface {
  name = 'ShareTestSessionsAcrossProgrammes1760000000016';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE test_session_programmes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      test_session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
      programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE RESTRICT,
      CONSTRAINT uq_test_session_programmes_session_programme
        UNIQUE (tenant_id, test_session_id, programme_id)
    )`);
    await queryRunner.query(`INSERT INTO test_session_programmes (tenant_id, test_session_id, programme_id)
      SELECT tenant_id, id, programme_id FROM test_sessions`);
    await queryRunner.query('CREATE INDEX idx_test_session_programmes_programme ON test_session_programmes(tenant_id, programme_id, test_session_id)');
    await queryRunner.query('ALTER TABLE test_sessions DROP COLUMN programme_id');
    await queryRunner.query('DROP INDEX IF EXISTS idx_application_declarations_test_centre');
    await queryRunner.query('ALTER TABLE application_declarations DROP COLUMN IF EXISTS selected_test_centre_id');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM test_session_programmes
        GROUP BY tenant_id, test_session_id HAVING COUNT(*) > 1
      ) THEN
        RAISE EXCEPTION 'Cannot revert: a test session is associated with multiple programmes';
      END IF;
    END $$`);
    await queryRunner.query(`ALTER TABLE test_sessions
      ADD COLUMN programme_id UUID NULL REFERENCES programmes(id) ON DELETE RESTRICT`);
    await queryRunner.query(`UPDATE test_sessions s SET programme_id = link.programme_id
      FROM test_session_programmes link
      WHERE link.tenant_id = s.tenant_id AND link.test_session_id = s.id`);
    await queryRunner.query('ALTER TABLE test_sessions ALTER COLUMN programme_id SET NOT NULL');
    await queryRunner.query('DROP TABLE test_session_programmes');
    await queryRunner.query('ALTER TABLE application_declarations ADD COLUMN selected_test_centre_id UUID NULL REFERENCES test_centres(id) ON DELETE RESTRICT');
    await queryRunner.query('CREATE INDEX idx_application_declarations_test_centre ON application_declarations(tenant_id, selected_test_centre_id)');
  }
}
