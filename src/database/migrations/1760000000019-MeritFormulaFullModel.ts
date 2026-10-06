import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Full merit formula model: degree-level templates + offering overrides,
 * plus merit list columns for score engine snapshot.
 */
export class MeritFormulaFullModel1760000000019 implements MigrationInterface {
  name = 'MeritFormulaFullModel1760000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS merit_formula_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        degree_level VARCHAR(30) NOT NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by UUID NOT NULL,
        CONSTRAINT chk_merit_formula_tpl_degree_level
          CHECK (degree_level IN ('Bachelor', 'Master', 'Doctorate')),
        CONSTRAINT chk_merit_formula_tpl_status
          CHECK (status IN ('ACTIVE', 'INACTIVE'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_merit_formula_tpl_tenant
        ON merit_formula_templates (tenant_id)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_merit_formula_tpl_default
        ON merit_formula_templates (tenant_id, degree_level)
        WHERE is_default = TRUE AND status = 'ACTIVE'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS merit_formula_template_components (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        template_id UUID NOT NULL
          REFERENCES merit_formula_templates (id) ON DELETE CASCADE,
        source_type VARCHAR(30) NOT NULL,
        weight NUMERIC(5,2) NOT NULL,
        sort_order INT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_merit_tpl_component_source
          CHECK (source_type IN ('MATRIC', 'FSC', 'BACHELOR', 'MASTER', 'DOCTORATE', 'ENTRY_TEST')),
        CONSTRAINT chk_merit_tpl_component_weight
          CHECK (weight > 0 AND weight <= 100),
        CONSTRAINT uq_merit_tpl_component_source
          UNIQUE (template_id, source_type)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_merit_tpl_components_template
        ON merit_formula_template_components (template_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS offering_merit_formulas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        programme_offering_id UUID NOT NULL
          REFERENCES programme_offerings (id) ON DELETE CASCADE,
        template_id UUID NULL
          REFERENCES merit_formula_templates (id) ON DELETE SET NULL,
        degree_level VARCHAR(30) NOT NULL,
        name VARCHAR(150) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by UUID NOT NULL,
        CONSTRAINT chk_offering_merit_formula_degree_level
          CHECK (degree_level IN ('Bachelor', 'Master', 'Doctorate')),
        CONSTRAINT uq_offering_merit_formula_offering
          UNIQUE (tenant_id, programme_offering_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_offering_merit_formula_offering
        ON offering_merit_formulas (programme_offering_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS offering_merit_formula_components (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        offering_formula_id UUID NOT NULL
          REFERENCES offering_merit_formulas (id) ON DELETE CASCADE,
        source_type VARCHAR(30) NOT NULL,
        weight NUMERIC(5,2) NOT NULL,
        sort_order INT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_offering_merit_component_source
          CHECK (source_type IN ('MATRIC', 'FSC', 'BACHELOR', 'MASTER', 'DOCTORATE', 'ENTRY_TEST')),
        CONSTRAINT chk_offering_merit_component_weight
          CHECK (weight > 0 AND weight <= 100),
        CONSTRAINT uq_offering_merit_component_source
          UNIQUE (offering_formula_id, source_type)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_offering_merit_components_formula
        ON offering_merit_formula_components (offering_formula_id)
    `);

    await queryRunner.query(`
      ALTER TABLE programme_merit_lists
        ADD COLUMN IF NOT EXISTS formula_snapshot JSONB NULL
    `);
    await queryRunner.query(`
      ALTER TABLE programme_merit_list_items
        ADD COLUMN IF NOT EXISTS merit_score NUMERIC(8,4) NULL,
        ADD COLUMN IF NOT EXISTS score_breakdown JSONB NULL
    `);

    const systemUser = '00000000-0000-4000-8000-000000000000';
    const tenant = '00000000-0000-4000-8000-000000000001';

    // Seed default templates (idempotent via unique default index + ON CONFLICT not available on partial — use NOT EXISTS)
    await queryRunner.query(
      `
      INSERT INTO merit_formula_templates (
        id, tenant_id, degree_level, name, description, status, is_default, created_by, updated_by
      )
      SELECT gen_random_uuid(), $1, 'Bachelor', 'Undergraduate standard',
        'Matric 10% + FSC 45% + Entry test 45%', 'ACTIVE', TRUE, $2, $2
      WHERE NOT EXISTS (
        SELECT 1 FROM merit_formula_templates
        WHERE tenant_id = $1 AND degree_level = 'Bachelor' AND is_default = TRUE
      )
    `,
      [tenant, systemUser],
    );
    await queryRunner.query(
      `
      INSERT INTO merit_formula_templates (
        id, tenant_id, degree_level, name, description, status, is_default, created_by, updated_by
      )
      SELECT gen_random_uuid(), $1, 'Master', 'Masters standard',
        'Bachelor 50% + Entry test 50%', 'ACTIVE', TRUE, $2, $2
      WHERE NOT EXISTS (
        SELECT 1 FROM merit_formula_templates
        WHERE tenant_id = $1 AND degree_level = 'Master' AND is_default = TRUE
      )
    `,
      [tenant, systemUser],
    );
    await queryRunner.query(
      `
      INSERT INTO merit_formula_templates (
        id, tenant_id, degree_level, name, description, status, is_default, created_by, updated_by
      )
      SELECT gen_random_uuid(), $1, 'Doctorate', 'Doctorate standard',
        'Bachelor 20% + Master 40% + Entry test 40%', 'ACTIVE', TRUE, $2, $2
      WHERE NOT EXISTS (
        SELECT 1 FROM merit_formula_templates
        WHERE tenant_id = $1 AND degree_level = 'Doctorate' AND is_default = TRUE
      )
    `,
      [tenant, systemUser],
    );

    await queryRunner.query(
      `
      INSERT INTO merit_formula_template_components (tenant_id, template_id, source_type, weight, sort_order)
      SELECT t.tenant_id, t.id, v.source_type, v.weight, v.sort_order
      FROM merit_formula_templates t
      CROSS JOIN (VALUES
        ('MATRIC', 10::numeric, 1),
        ('FSC', 45::numeric, 2),
        ('ENTRY_TEST', 45::numeric, 3)
      ) AS v(source_type, weight, sort_order)
      WHERE t.tenant_id = $1 AND t.degree_level = 'Bachelor' AND t.is_default = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM merit_formula_template_components c
          WHERE c.template_id = t.id AND c.source_type = v.source_type
        )
    `,
      [tenant],
    );
    await queryRunner.query(
      `
      INSERT INTO merit_formula_template_components (tenant_id, template_id, source_type, weight, sort_order)
      SELECT t.tenant_id, t.id, v.source_type, v.weight, v.sort_order
      FROM merit_formula_templates t
      CROSS JOIN (VALUES
        ('BACHELOR', 50::numeric, 1),
        ('ENTRY_TEST', 50::numeric, 2)
      ) AS v(source_type, weight, sort_order)
      WHERE t.tenant_id = $1 AND t.degree_level = 'Master' AND t.is_default = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM merit_formula_template_components c
          WHERE c.template_id = t.id AND c.source_type = v.source_type
        )
    `,
      [tenant],
    );
    await queryRunner.query(
      `
      INSERT INTO merit_formula_template_components (tenant_id, template_id, source_type, weight, sort_order)
      SELECT t.tenant_id, t.id, v.source_type, v.weight, v.sort_order
      FROM merit_formula_templates t
      CROSS JOIN (VALUES
        ('BACHELOR', 20::numeric, 1),
        ('MASTER', 40::numeric, 2),
        ('ENTRY_TEST', 40::numeric, 3)
      ) AS v(source_type, weight, sort_order)
      WHERE t.tenant_id = $1 AND t.degree_level = 'Doctorate' AND t.is_default = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM merit_formula_template_components c
          WHERE c.template_id = t.id AND c.source_type = v.source_type
        )
    `,
      [tenant],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE programme_merit_list_items
        DROP COLUMN IF EXISTS score_breakdown,
        DROP COLUMN IF EXISTS merit_score
    `);
    await queryRunner.query(`
      ALTER TABLE programme_merit_lists
        DROP COLUMN IF EXISTS formula_snapshot
    `);
    await queryRunner.query(
      `DROP TABLE IF EXISTS offering_merit_formula_components`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS offering_merit_formulas`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS merit_formula_template_components`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS merit_formula_templates`);
  }
}
