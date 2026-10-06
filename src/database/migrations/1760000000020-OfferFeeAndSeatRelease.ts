import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Post-offer admission fee challans, intake selection/fee settings,
 * and seat-release audit for waitlist promotion.
 */
export class OfferFeeAndSeatRelease1760000000020 implements MigrationInterface {
  name = 'OfferFeeAndSeatRelease1760000000020';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      INSERT INTO fee_types (name) VALUES
        ('ADMISSION'),
        ('TUITION'),
        ('SEMESTER_REGISTRATION'),
        ('ID_CARD'),
        ('COUNCIL')
      ON CONFLICT (name) DO NOTHING
    `);

    await q.query(`
      ALTER TABLE intakes
        ADD COLUMN IF NOT EXISTS merit_generation_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
        ADD COLUMN IF NOT EXISTS fee_confirm_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS offer_fee_grace_hours INTEGER NOT NULL DEFAULT 0
    `);
    await q.query(`
      ALTER TABLE intakes
        DROP CONSTRAINT IF EXISTS chk_intakes_merit_mode,
        DROP CONSTRAINT IF EXISTS chk_intakes_fee_margin,
        DROP CONSTRAINT IF EXISTS chk_intakes_offer_fee_grace
    `);
    await q.query(`
      ALTER TABLE intakes
        ADD CONSTRAINT chk_intakes_merit_mode
          CHECK (merit_generation_mode IN ('MANUAL','AUTO')),
        ADD CONSTRAINT chk_intakes_fee_margin
          CHECK (fee_confirm_margin_percent BETWEEN 0 AND 100),
        ADD CONSTRAINT chk_intakes_offer_fee_grace
          CHECK (offer_fee_grace_hours BETWEEN 0 AND 168)
    `);

    await q.query(`
      CREATE TABLE admission_offer_fee_challans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        offer_id UUID NOT NULL REFERENCES admission_offers(id) ON DELETE CASCADE,
        applicant_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        programme_offering_id UUID NOT NULL REFERENCES programme_offerings(id) ON DELETE RESTRICT,
        challan_number VARCHAR(100) NOT NULL,
        issue_date TIMESTAMPTZ NOT NULL,
        due_date TIMESTAMPTZ NOT NULL,
        designated_bank_id UUID NOT NULL REFERENCES designated_banks(id) ON DELETE RESTRICT,
        collection_bank_name VARCHAR(150) NOT NULL,
        collection_bank_branch VARCHAR(150) NOT NULL,
        collection_bank_account VARCHAR(100) NOT NULL,
        branch_code VARCHAR(50) NOT NULL,
        institution_code VARCHAR(50) NULL,
        applicant_name VARCHAR(150) NOT NULL,
        applicant_contact_number VARCHAR(30) NOT NULL,
        registration_number VARCHAR(100) NOT NULL,
        intake_session VARCHAR(255) NOT NULL,
        programme_name TEXT NOT NULL,
        total_amount_payable NUMERIC(14,2) NOT NULL,
        amount_in_words VARCHAR(255) NOT NULL,
        payment_status VARCHAR(40) NOT NULL DEFAULT 'UNPAID',
        payment_date TIMESTAMPTZ NULL,
        amount_paid NUMERIC(14,2) NULL,
        late_payment_flag BOOLEAN NOT NULL DEFAULT FALSE,
        verified_by VARCHAR(100) NULL,
        verification_date TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_offer_fee_challan_number UNIQUE (challan_number),
        CONSTRAINT uq_offer_fee_per_offer UNIQUE (tenant_id, offer_id),
        CONSTRAINT chk_offer_fee_challan_status CHECK (payment_status IN (
          'UNPAID','PARTIALLY_PAID','EVIDENCE_SUBMITTED','VERIFIED','LATE_PAYMENT_VERIFIED','EXPIRED'
        ))
      )
    `);
    await q.query(
      `CREATE INDEX idx_offer_fee_challans_tenant ON admission_offer_fee_challans(tenant_id)`,
    );
    await q.query(
      `CREATE INDEX idx_offer_fee_challans_applicant ON admission_offer_fee_challans(applicant_id)`,
    );
    await q.query(
      `CREATE INDEX idx_offer_fee_challans_status ON admission_offer_fee_challans(payment_status)`,
    );
    await q.query(
      `CREATE INDEX idx_offer_fee_challans_due ON admission_offer_fee_challans(tenant_id, due_date, payment_status)`,
    );

    await q.query(`
      CREATE TABLE admission_offer_fee_challan_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        challan_id UUID NOT NULL REFERENCES admission_offer_fee_challans(id) ON DELETE CASCADE,
        fee_type_code VARCHAR(50) NOT NULL,
        description VARCHAR(200) NOT NULL,
        quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
        unit_amount NUMERIC(14,2) NOT NULL,
        amount NUMERIC(14,2) NOT NULL,
        currency CHAR(3) NOT NULL,
        due_date TIMESTAMPTZ NULL,
        source_reference VARCHAR(100) NULL,
        offering_fee_id UUID NULL REFERENCES offering_fees(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await q.query(
      `CREATE INDEX idx_offer_fee_items_challan ON admission_offer_fee_challan_items(challan_id)`,
    );

    await q.query(`
      CREATE TABLE admission_offer_fee_evidences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        applicant_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        challan_id UUID NOT NULL REFERENCES admission_offer_fee_challans(id) ON DELETE CASCADE,
        storage_key VARCHAR(500) NOT NULL,
        file_format VARCHAR(10) NOT NULL,
        evidence_source VARCHAR(30) NOT NULL DEFAULT 'BANK_RECEIPT',
        amount_claimed NUMERIC(14,2) NULL,
        deposited_at TIMESTAMPTZ NULL,
        upload_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        verification_indicator VARCHAR(30) NOT NULL DEFAULT 'UNVERIFIED',
        verified_by VARCHAR(100) NULL,
        verification_date TIMESTAMPTZ NULL,
        review_notes TEXT NULL,
        replaced_by UUID NULL,
        is_current BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT chk_offer_fee_evidence_source CHECK (evidence_source IN ('BANK_RECEIPT','ONLINE_RECEIPT')),
        CONSTRAINT chk_offer_fee_evidence_indicator CHECK (verification_indicator IN ('UNVERIFIED','VERIFIED','REJECTED'))
      )
    `);
    await q.query(
      `CREATE INDEX idx_offer_fee_evidence_challan ON admission_offer_fee_evidences(challan_id, is_current)`,
    );
    await q.query(
      `CREATE UNIQUE INDEX uq_offer_fee_evidence_one_current ON admission_offer_fee_evidences(challan_id) WHERE is_current = TRUE`,
    );

    await q.query(`
      ALTER TABLE admission_offers
        ADD COLUMN IF NOT EXISTS fee_challan_id UUID NULL,
        ADD COLUMN IF NOT EXISTS fee_verified_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS expired_reason VARCHAR(40) NULL
    `);
    await q.query(`
      ALTER TABLE admission_offers
        DROP CONSTRAINT IF EXISTS fk_admission_offers_fee_challan,
        DROP CONSTRAINT IF EXISTS chk_offer_expired_reason
    `);
    await q.query(`
      ALTER TABLE admission_offers
        ADD CONSTRAINT fk_admission_offers_fee_challan
          FOREIGN KEY (fee_challan_id) REFERENCES admission_offer_fee_challans(id) ON DELETE SET NULL,
        ADD CONSTRAINT chk_offer_expired_reason CHECK (
          expired_reason IS NULL OR expired_reason IN (
            'ACCEPTANCE_DEADLINE','FEE_UNPAID','ADMIN_CANCEL'
          )
        )
    `);

    await q.query(`
      CREATE TABLE selection_seat_release_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        intake_session_id UUID NOT NULL REFERENCES intakes(id) ON DELETE RESTRICT,
        programme_offering_id UUID NOT NULL REFERENCES programme_offerings(id) ON DELETE RESTRICT,
        trigger_type VARCHAR(30) NOT NULL,
        seats_freed INTEGER NOT NULL DEFAULT 0,
        promoted_count INTEGER NOT NULL DEFAULT 0,
        expired_offer_id UUID NULL REFERENCES admission_offers(id) ON DELETE SET NULL,
        promoted_application_id UUID NULL REFERENCES applications(id) ON DELETE SET NULL,
        new_offer_id UUID NULL REFERENCES admission_offers(id) ON DELETE SET NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_seat_release_trigger CHECK (trigger_type IN (
          'OFFER_EXPIRED','FEE_UNPAID','MANUAL'
        ))
      )
    `);
    await q.query(
      `CREATE INDEX idx_seat_release_offering ON selection_seat_release_runs(tenant_id, programme_offering_id, created_at DESC)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS selection_seat_release_runs`);
    await q.query(
      `ALTER TABLE admission_offers DROP CONSTRAINT IF EXISTS fk_admission_offers_fee_challan`,
    );
    await q.query(
      `ALTER TABLE admission_offers DROP CONSTRAINT IF EXISTS chk_offer_expired_reason`,
    );
    await q.query(`
      ALTER TABLE admission_offers
        DROP COLUMN IF EXISTS fee_challan_id,
        DROP COLUMN IF EXISTS fee_verified_at,
        DROP COLUMN IF EXISTS expired_reason
    `);
    await q.query(`DROP TABLE IF EXISTS admission_offer_fee_evidences`);
    await q.query(`DROP TABLE IF EXISTS admission_offer_fee_challan_items`);
    await q.query(`DROP TABLE IF EXISTS admission_offer_fee_challans`);
    await q.query(`
      ALTER TABLE intakes
        DROP CONSTRAINT IF EXISTS chk_intakes_merit_mode,
        DROP CONSTRAINT IF EXISTS chk_intakes_fee_margin,
        DROP CONSTRAINT IF EXISTS chk_intakes_offer_fee_grace,
        DROP COLUMN IF EXISTS merit_generation_mode,
        DROP COLUMN IF EXISTS fee_confirm_margin_percent,
        DROP COLUMN IF EXISTS offer_fee_grace_hours
    `);
    await q.query(`
      DELETE FROM fee_types
      WHERE name IN ('ADMISSION','TUITION','SEMESTER_REGISTRATION','ID_CARD','COUNCIL')
    `);
  }
}
