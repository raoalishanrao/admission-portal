import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Link special categories to programme offerings.
 * An empty link set means that offering does not offer those bonus categories.
 */
export class OfferingSpecialCategories1760000000026
  implements MigrationInterface
{
  name = 'OfferingSpecialCategories1760000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE offering_special_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        programme_offering_id UUID NOT NULL
          REFERENCES programme_offerings (id) ON DELETE CASCADE,
        special_category_id UUID NOT NULL
          REFERENCES special_categories (id) ON DELETE CASCADE,
        created_by UUID NOT NULL,
        updated_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_offering_special_category
          UNIQUE (tenant_id, programme_offering_id, special_category_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_offering_special_categories_offering
        ON offering_special_categories (tenant_id, programme_offering_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_offering_special_categories_category
        ON offering_special_categories (tenant_id, special_category_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS offering_special_categories`,
    );
  }
}
