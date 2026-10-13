import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Degree-level admission document templates + source tracking on offering rules.
 */
export class DegreeLevelRequiredDocuments1760000000024
  implements MigrationInterface
{
  name = 'DegreeLevelRequiredDocuments1760000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE degree_level_required_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        degree_level VARCHAR(30) NOT NULL,
        document_type_id UUID NOT NULL
          REFERENCES document_types (id) ON DELETE RESTRICT,
        mandatory BOOLEAN NOT NULL DEFAULT TRUE,
        condition_code VARCHAR(60) NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID NOT NULL,
        updated_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_degree_level_required_doc_level
          CHECK (degree_level IN ('Bachelor', 'Master', 'Doctorate')),
        CONSTRAINT uq_degree_level_required_document
          UNIQUE (tenant_id, degree_level, document_type_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_degree_level_required_docs_level
        ON degree_level_required_documents (tenant_id, degree_level, active, sort_order)
    `);

    await queryRunner.query(`
      ALTER TABLE offering_required_documents
        ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
        ADD COLUMN IF NOT EXISTS source_degree_level_requirement_id UUID NULL
          REFERENCES degree_level_required_documents (id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE offering_required_documents
        DROP CONSTRAINT IF EXISTS chk_offering_required_doc_source
    `);
    await queryRunner.query(`
      ALTER TABLE offering_required_documents
        ADD CONSTRAINT chk_offering_required_doc_source
        CHECK (source IN ('MANUAL', 'DEGREE_LEVEL'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_offering_required_docs_source_tpl
        ON offering_required_documents (tenant_id, source_degree_level_requirement_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_offering_required_docs_source_tpl
    `);
    await queryRunner.query(`
      ALTER TABLE offering_required_documents
        DROP CONSTRAINT IF EXISTS chk_offering_required_doc_source
    `);
    await queryRunner.query(`
      ALTER TABLE offering_required_documents
        DROP COLUMN IF EXISTS source_degree_level_requirement_id,
        DROP COLUMN IF EXISTS source
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS degree_level_required_documents
    `);
  }
}
