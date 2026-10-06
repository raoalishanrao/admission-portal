import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Controlled academic degree_type codes + configurable required levels
 * per programme degree_level (Bachelor → MATRIC+FSC, etc.).
 */
export class AcademicLevelRequirements1760000000018
  implements MigrationInterface
{
  name = 'AcademicLevelRequirements1760000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normalize legacy free-text degree_type values to controlled codes.
    await queryRunner.query(`
      UPDATE application_academic_information
      SET degree_type = CASE
        WHEN UPPER(TRIM(degree_type)) IN ('MATRIC', 'SSC', 'SECONDARY', 'SECONDARY SCHOOL')
          THEN 'MATRIC'
        WHEN UPPER(TRIM(degree_type)) IN ('FSC', 'HSSC', 'INTERMEDIATE', 'HIGHER SECONDARY', 'FA', 'ICS', 'I.COM', 'ICOM')
          THEN 'FSC'
        WHEN UPPER(TRIM(degree_type)) IN ('BACHELOR', 'BACHELORS', 'BS', 'BA', 'BSC', 'B.SC', 'UNDERGRADUATE')
          THEN 'BACHELOR'
        WHEN UPPER(TRIM(degree_type)) IN ('MASTER', 'MASTERS', 'MS', 'MA', 'MPHIL', 'M.PHIL', 'POSTGRADUATE')
          THEN 'MASTER'
        WHEN UPPER(TRIM(degree_type)) IN ('DOCTORATE', 'PHD', 'PH.D', 'DOCTORAL')
          THEN 'DOCTORATE'
        ELSE UPPER(TRIM(degree_type))
      END
    `);

    // Keep the newest row when duplicates share applicant_id + degree_type.
    await queryRunner.query(`
      DELETE FROM application_academic_information a
      USING application_academic_information b
      WHERE a.applicant_id = b.applicant_id
        AND a.degree_type = b.degree_type
        AND (
          a.updated_at < b.updated_at
          OR (a.updated_at = b.updated_at AND a.id::text < b.id::text)
        )
    `);

    // Drop any remaining rows that still are not controlled codes.
    await queryRunner.query(`
      DELETE FROM application_academic_information
      WHERE degree_type NOT IN ('MATRIC', 'FSC', 'BACHELOR', 'MASTER', 'DOCTORATE')
    `);

    await queryRunner.query(`
      ALTER TABLE application_academic_information
        DROP CONSTRAINT IF EXISTS chk_academic_degree_type
    `);
    await queryRunner.query(`
      ALTER TABLE application_academic_information
        ADD CONSTRAINT chk_academic_degree_type
        CHECK (degree_type IN ('MATRIC', 'FSC', 'BACHELOR', 'MASTER', 'DOCTORATE'))
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_info_applicant_degree_type
        ON application_academic_information (applicant_id, degree_type)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS academic_level_requirements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        degree_level VARCHAR(30) NOT NULL,
        required_academic_code VARCHAR(30) NOT NULL,
        mandatory BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by UUID NOT NULL,
        CONSTRAINT chk_academic_level_req_degree_level
          CHECK (degree_level IN ('Bachelor', 'Master', 'Doctorate')),
        CONSTRAINT chk_academic_level_req_code
          CHECK (required_academic_code IN ('MATRIC', 'FSC', 'BACHELOR', 'MASTER', 'DOCTORATE')),
        CONSTRAINT uq_academic_level_requirements
          UNIQUE (tenant_id, degree_level, required_academic_code)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_academic_level_req_tenant
        ON academic_level_requirements (tenant_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_academic_level_req_degree_level
        ON academic_level_requirements (degree_level)
    `);

    // Seed defaults for DEFAULT_TENANT_ID (system seed user).
    await queryRunner.query(`
      INSERT INTO academic_level_requirements (
        tenant_id, degree_level, required_academic_code, mandatory, sort_order,
        created_by, updated_by
      )
      VALUES
        ('00000000-0000-4000-8000-000000000001', 'Bachelor', 'MATRIC', TRUE, 1,
          '00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000000'),
        ('00000000-0000-4000-8000-000000000001', 'Bachelor', 'FSC', TRUE, 2,
          '00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000000'),
        ('00000000-0000-4000-8000-000000000001', 'Master', 'BACHELOR', TRUE, 1,
          '00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000000'),
        ('00000000-0000-4000-8000-000000000001', 'Doctorate', 'BACHELOR', TRUE, 1,
          '00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000000'),
        ('00000000-0000-4000-8000-000000000001', 'Doctorate', 'MASTER', TRUE, 2,
          '00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000000')
      ON CONFLICT (tenant_id, degree_level, required_academic_code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS academic_level_requirements`);
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_academic_info_applicant_degree_type
    `);
    await queryRunner.query(`
      ALTER TABLE application_academic_information
        DROP CONSTRAINT IF EXISTS chk_academic_degree_type
    `);
  }
}
