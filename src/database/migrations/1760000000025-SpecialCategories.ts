import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Special categories — extra marks on merit (not reserved seats).
 * Seed defaults for the system DEFAULT tenant seed id.
 */
export class SpecialCategories1760000000025 implements MigrationInterface {
  name = 'SpecialCategories1760000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE special_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        code VARCHAR(40) NOT NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        bonus_marks NUMERIC(6,2) NOT NULL DEFAULT 0,
        stackable BOOLEAN NOT NULL DEFAULT TRUE,
        requires_evidence BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by UUID NOT NULL,
        updated_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_special_categories_tenant_code UNIQUE (tenant_id, code),
        CONSTRAINT chk_special_categories_status
          CHECK (status IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT chk_special_categories_bonus
          CHECK (bonus_marks >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_special_categories_tenant_status
        ON special_categories (tenant_id, status, sort_order)
    `);

    await queryRunner.query(`
      CREATE TABLE application_special_category_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        applicant_id UUID NOT NULL
          REFERENCES applications (id) ON DELETE CASCADE,
        special_category_id UUID NOT NULL
          REFERENCES special_categories (id) ON DELETE RESTRICT,
        status VARCHAR(20) NOT NULL DEFAULT 'CLAIMED',
        rejection_reason TEXT NULL,
        reviewed_by UUID NULL,
        reviewed_at TIMESTAMPTZ NULL,
        created_by UUID NOT NULL,
        updated_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_special_category_claim_app_cat
          UNIQUE (tenant_id, applicant_id, special_category_id),
        CONSTRAINT chk_special_category_claim_status
          CHECK (status IN ('CLAIMED', 'VERIFIED', 'REJECTED'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_special_category_claims_applicant
        ON application_special_category_claims (tenant_id, applicant_id, status)
    `);

    const tenantId = '00000000-0000-4000-8000-000000000001';
    const actor = '00000000-0000-4000-8000-000000000000';
    await queryRunner.query(
      `
      INSERT INTO special_categories (
        tenant_id, code, name, description, bonus_marks, stackable,
        requires_evidence, status, sort_order, created_by, updated_by
      ) VALUES
        ($1, 'HAFIZ_E_QURAN', 'Hafiz-e-Quran', 'Extra marks for Hafiz-e-Quran', 5, TRUE, TRUE, 'ACTIVE', 1, $2, $2),
        ($1, 'SPORTS', 'Sports', 'Extra marks for sports distinction', 2, TRUE, TRUE, 'ACTIVE', 2, $2, $2),
        ($1, 'DIPLOMA', 'Diploma', 'Extra marks for relevant diploma', 2, TRUE, TRUE, 'ACTIVE', 3, $2, $2),
        ($1, 'DISABILITY', 'Disability', 'Extra marks for declared disability', 5, TRUE, TRUE, 'ACTIVE', 4, $2, $2),
        ($1, 'FEMALE', 'Female', 'Extra marks for female applicants', 2, TRUE, FALSE, 'ACTIVE', 5, $2, $2)
      ON CONFLICT (tenant_id, code) DO NOTHING
      `,
      [tenantId, actor],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS application_special_category_claims`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS special_categories`);
  }
}
