import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align application_programme_selection with programme DegreeLevel
 * (Bachelor | Master | Doctorate) instead of UNDERGRADUATE/POSTGRADUATE/PHD.
 */
export class ProgrammeSelectionDegreeLevel1760000000023
  implements MigrationInterface
{
  name = 'ProgrammeSelectionDegreeLevel1760000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE application_programme_selection
        DROP CONSTRAINT IF EXISTS chk_programme_selection_level
    `);

    await queryRunner.query(`
      UPDATE application_programme_selection
      SET qualification_level = CASE
        WHEN UPPER(TRIM(qualification_level)) IN ('UNDERGRADUATE', 'BACHELOR', 'UG')
          THEN 'Bachelor'
        WHEN UPPER(TRIM(qualification_level)) IN ('POSTGRADUATE', 'MASTER', 'PG')
          THEN 'Master'
        WHEN UPPER(TRIM(qualification_level)) IN ('PHD', 'DOCTORATE', 'DOCTORAL')
          THEN 'Doctorate'
        WHEN qualification_level IN ('Bachelor', 'Master', 'Doctorate')
          THEN qualification_level
        ELSE 'Bachelor'
      END
    `);

    await queryRunner.query(`
      ALTER TABLE application_programme_selection
        RENAME COLUMN qualification_level TO degree_level
    `);

    await queryRunner.query(`
      ALTER TABLE application_programme_selection
        ADD CONSTRAINT chk_programme_selection_degree_level
        CHECK (degree_level IN ('Bachelor', 'Master', 'Doctorate'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE application_programme_selection
        DROP CONSTRAINT IF EXISTS chk_programme_selection_degree_level
    `);

    await queryRunner.query(`
      ALTER TABLE application_programme_selection
        RENAME COLUMN degree_level TO qualification_level
    `);

    await queryRunner.query(`
      UPDATE application_programme_selection
      SET qualification_level = CASE
        WHEN qualification_level = 'Bachelor' THEN 'UNDERGRADUATE'
        WHEN qualification_level = 'Master' THEN 'POSTGRADUATE'
        WHEN qualification_level = 'Doctorate' THEN 'PHD'
        ELSE 'UNDERGRADUATE'
      END
    `);

    await queryRunner.query(`
      ALTER TABLE application_programme_selection
        ADD CONSTRAINT chk_programme_selection_level
        CHECK (qualification_level IN (
          'UNDERGRADUATE', 'POSTGRADUATE', 'PHD'
        ))
    `);
  }
}
