import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allow bank reconciliation to match processing OR offer-fee challans.
 */
export class BankReconOfferFeeSupport1760000000021 implements MigrationInterface {
  name = 'BankReconOfferFeeSupport1760000000021';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE bank_reconciliation_records
        DROP CONSTRAINT IF EXISTS bank_reconciliation_records_matched_challan_id_fkey
    `);
    // Migration 0010 may have named the FK differently
    await q.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          WHERE rel.relname = 'bank_reconciliation_records'
            AND con.contype = 'f'
            AND pg_get_constraintdef(con.oid) ILIKE '%matched_challan_id%'
        LOOP
          EXECUTE format('ALTER TABLE bank_reconciliation_records DROP CONSTRAINT %I', r.conname);
        END LOOP;
      END $$
    `);

    await q.query(`
      ALTER TABLE bank_reconciliation_records
        ADD COLUMN IF NOT EXISTS matched_challan_kind VARCHAR(20) NULL
    `);
    await q.query(`
      ALTER TABLE bank_reconciliation_records
        DROP CONSTRAINT IF EXISTS chk_bank_matched_challan_kind
    `);
    await q.query(`
      ALTER TABLE bank_reconciliation_records
        ADD CONSTRAINT chk_bank_matched_challan_kind CHECK (
          matched_challan_kind IS NULL
          OR matched_challan_kind IN ('PROCESSING', 'OFFER')
        )
    `);
    await q.query(`
      UPDATE bank_reconciliation_records
      SET matched_challan_kind = 'PROCESSING'
      WHERE matched_challan_id IS NOT NULL AND matched_challan_kind IS NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE bank_reconciliation_records
        DROP CONSTRAINT IF EXISTS chk_bank_matched_challan_kind,
        DROP COLUMN IF EXISTS matched_challan_kind
    `);
    await q.query(`
      ALTER TABLE bank_reconciliation_records
        ADD CONSTRAINT bank_reconciliation_records_matched_challan_id_fkey
        FOREIGN KEY (matched_challan_id)
        REFERENCES processing_fee_challans(id) ON DELETE SET NULL
    `);
  }
}
