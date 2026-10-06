import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSelectionAndOffers1760000000017 implements MigrationInterface {
  name = 'CreateSelectionAndOffers1760000000017';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE programme_offerings ADD COLUMN seat_capacity INTEGER NULL,
      ADD CONSTRAINT chk_programme_offerings_seat_capacity CHECK (seat_capacity IS NULL OR seat_capacity > 0)`);
    await q.query(`ALTER TABLE intakes ADD COLUMN offer_payment_period_days INTEGER NOT NULL DEFAULT 5,
      ADD CONSTRAINT chk_intakes_offer_payment_period CHECK (offer_payment_period_days BETWEEN 1 AND 30)`);
    await q.query(`ALTER TABLE applications ADD COLUMN selection_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      ADD COLUMN selected_programme_offering_id UUID NULL REFERENCES programme_offerings(id) ON DELETE RESTRICT,
      ADD COLUMN selection_at TIMESTAMPTZ NULL, ADD COLUMN selection_by UUID NULL,
      ADD COLUMN selection_reason TEXT NULL,
      ADD CONSTRAINT chk_applications_selection_status CHECK (selection_status IN ('PENDING','SELECTED','WAITING','REJECTED')),
      ADD CONSTRAINT chk_applications_selected_offering CHECK ((selection_status='SELECTED' AND selected_programme_offering_id IS NOT NULL) OR (selection_status<>'SELECTED' AND selected_programme_offering_id IS NULL))`);
    await q.query(`CREATE TABLE result_imports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      intake_session_id UUID NOT NULL REFERENCES intakes(id) ON DELETE RESTRICT,
      test_session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE RESTRICT,
      file_name VARCHAR(255) NOT NULL, file_sha256 CHAR(64) NOT NULL,
      status VARCHAR(30) NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0, valid_rows INTEGER NOT NULL DEFAULT 0, invalid_rows INTEGER NOT NULL DEFAULT 0,
      created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmed_by UUID NULL, confirmed_at TIMESTAMPTZ NULL, correction_reason TEXT NULL,
      CONSTRAINT chk_result_import_status CHECK (status IN ('READY_TO_CONFIRM','VALIDATION_FAILED','CONFIRMED','CANCELLED','SUPERSEDED')),
      CONSTRAINT chk_result_import_counts CHECK (total_rows >= 0 AND valid_rows >= 0 AND invalid_rows >= 0)
    )`);
    await q.query(`CREATE INDEX idx_result_imports_tenant_session ON result_imports(tenant_id,test_session_id,created_at DESC)`);
    await q.query(`CREATE TABLE result_import_rows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      import_id UUID NOT NULL REFERENCES result_imports(id) ON DELETE CASCADE,
      row_number INTEGER NOT NULL, application_reference VARCHAR(100) NOT NULL,
      application_record_id UUID NULL REFERENCES applications(id) ON DELETE RESTRICT,
      raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, test_score NUMERIC(10,2) NULL,
      total_marks NUMERIC(10,2) NULL, percentage NUMERIC(5,2) NULL,
      result_status VARCHAR(10) NULL, remarks TEXT NULL,
      validation_status VARCHAR(20) NOT NULL, validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_result_import_rows_row UNIQUE(import_id,row_number),
      CONSTRAINT chk_result_import_row_status CHECK (validation_status IN ('VALID','INVALID','DUPLICATE','COMMITTED')),
      CONSTRAINT chk_result_import_row_percentage CHECK (percentage IS NULL OR percentage BETWEEN 0 AND 100),
      CONSTRAINT chk_result_import_row_status_value CHECK (result_status IS NULL OR result_status IN ('PASS','FAIL'))
    )`);
    await q.query(`CREATE INDEX idx_result_import_rows_page ON result_import_rows(tenant_id,import_id,row_number)`);
    await q.query(`CREATE TABLE application_entry_test_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      application_record_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      application_reference VARCHAR(100) NOT NULL,
      test_session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE RESTRICT,
      test_score NUMERIC(10,2) NULL, total_marks NUMERIC(10,2) NULL,
      percentage NUMERIC(5,2) NOT NULL, result_status VARCHAR(10) NOT NULL,
      remarks TEXT NULL, import_id UUID NOT NULL REFERENCES result_imports(id) ON DELETE RESTRICT,
      revision INTEGER NOT NULL DEFAULT 1, supersedes_result_id UUID NULL REFERENCES application_entry_test_results(id) ON DELETE RESTRICT,
      is_current BOOLEAN NOT NULL DEFAULT TRUE, published_at TIMESTAMPTZ NULL, published_by UUID NULL,
      created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_entry_result_pct CHECK (percentage BETWEEN 0 AND 100),
      CONSTRAINT chk_entry_result_status CHECK (result_status IN ('PASS','FAIL')),
      CONSTRAINT uq_entry_result_revision UNIQUE(tenant_id,application_record_id,test_session_id,revision)
    )`);
    await q.query(`CREATE UNIQUE INDEX uq_entry_test_result_current ON application_entry_test_results(tenant_id,application_record_id,test_session_id) WHERE is_current`);
    await q.query(`CREATE TABLE programme_merit_lists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      intake_session_id UUID NOT NULL REFERENCES intakes(id) ON DELETE RESTRICT,
      test_session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE RESTRICT,
      programme_offering_id UUID NOT NULL REFERENCES programme_offerings(id) ON DELETE RESTRICT,
      list_version INTEGER NOT NULL, capacity_snapshot INTEGER NOT NULL,
      source_import_id UUID NOT NULL REFERENCES result_imports(id) ON DELETE RESTRICT,
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', generated_by UUID NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved_by UUID NULL, approved_at TIMESTAMPTZ NULL, published_by UUID NULL, published_at TIMESTAMPTZ NULL,
      CONSTRAINT chk_merit_capacity CHECK (capacity_snapshot > 0),
      CONSTRAINT chk_merit_status CHECK (status IN ('DRAFT','APPROVED','PUBLISHED','SUPERSEDED','CANCELLED')),
      CONSTRAINT uq_merit_list_version UNIQUE(tenant_id,test_session_id,programme_offering_id,list_version)
    )`);
    await q.query(`CREATE TABLE programme_merit_list_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      merit_list_id UUID NOT NULL REFERENCES programme_merit_lists(id) ON DELETE CASCADE,
      result_id UUID NOT NULL REFERENCES application_entry_test_results(id) ON DELETE RESTRICT,
      application_record_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      application_reference VARCHAR(100) NOT NULL, preference_order SMALLINT NOT NULL,
      merit_rank INTEGER NOT NULL, percentage NUMERIC(5,2) NOT NULL,
      score_snapshot NUMERIC(10,2) NULL, total_marks_snapshot NUMERIC(10,2) NULL,
      selection_status VARCHAR(20) NOT NULL DEFAULT 'CONSIDERED', final_selection BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_merit_item_app UNIQUE(tenant_id,merit_list_id,application_record_id),
      CONSTRAINT chk_merit_item_preference CHECK (preference_order IN (1,2)),
      CONSTRAINT chk_merit_item_status CHECK (selection_status IN ('CONSIDERED','SELECTED','WAITING','REJECTED','REVIEW_REQUIRED'))
    )`);
    await q.query(`CREATE INDEX idx_merit_items_rank ON programme_merit_list_items(tenant_id,merit_list_id,merit_rank)`);
    await q.query(`CREATE TABLE application_selection_allocations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      intake_session_id UUID NOT NULL REFERENCES intakes(id) ON DELETE RESTRICT,
      test_session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE RESTRICT,
      allocation_version INTEGER NOT NULL, status VARCHAR(20) NOT NULL,
      source_merit_list_versions JSONB NOT NULL, idempotency_key VARCHAR(100) NOT NULL,
      supersedes_allocation_id UUID NULL REFERENCES application_selection_allocations(id) ON DELETE RESTRICT,
      created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TIMESTAMPTZ NULL,
      CONSTRAINT uq_selection_allocation_version UNIQUE(tenant_id,intake_session_id,test_session_id,allocation_version),
      CONSTRAINT uq_selection_allocation_idem UNIQUE(tenant_id,idempotency_key),
      CONSTRAINT chk_selection_allocation_status CHECK (status IN ('PREVIEW','CONFIRMED','FAILED','SUPERSEDED'))
    )`);
    await q.query(`CREATE UNIQUE INDEX uq_selection_allocation_current ON application_selection_allocations(tenant_id,intake_session_id,test_session_id) WHERE status='CONFIRMED'`);
    await q.query(`CREATE TABLE application_selection_allocation_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      allocation_id UUID NOT NULL REFERENCES application_selection_allocations(id) ON DELETE CASCADE,
      application_record_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      application_reference VARCHAR(100) NOT NULL, selection_status VARCHAR(20) NOT NULL,
      selected_programme_offering_id UUID NULL REFERENCES programme_offerings(id) ON DELETE RESTRICT,
      preference_order SMALLINT NULL, merit_list_item_id UUID NULL REFERENCES programme_merit_list_items(id) ON DELETE RESTRICT,
      reason TEXT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_selection_allocation_app UNIQUE(tenant_id,allocation_id,application_record_id),
      CONSTRAINT chk_selection_allocation_item_status CHECK (selection_status IN ('SELECTED','WAITING','REJECTED'))
    )`);
    await q.query(`CREATE TABLE admission_offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      application_record_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      programme_offering_id UUID NOT NULL REFERENCES programme_offerings(id) ON DELETE RESTRICT,
      offer_type VARCHAR(20) NOT NULL, offer_conditions TEXT NULL,
      offer_issue_date TIMESTAMPTZ NULL, acceptance_deadline TIMESTAMPTZ NOT NULL,
      fee_payment_instructions TEXT NULL, offer_letter_document VARCHAR(1000) NULL,
      authorized_by UUID NOT NULL, authorized_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at TIMESTAMPTZ NULL, status VARCHAR(20) NOT NULL DEFAULT 'AUTHORIZED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_admission_offer_type CHECK (offer_type IN ('CONDITIONAL','UNCONDITIONAL')),
      CONSTRAINT chk_admission_offer_status CHECK (status IN ('AUTHORIZED','PUBLISHED','ACCEPTED','DECLINED','EXPIRED','CANCELLED')),
      CONSTRAINT chk_admission_offer_deadline CHECK (acceptance_deadline > authorized_at)
    )`);
    await q.query(`CREATE UNIQUE INDEX uq_admission_offer_active_app ON admission_offers(tenant_id,application_record_id) WHERE status IN ('AUTHORIZED','PUBLISHED')`);
    await q.query(`CREATE TABLE admission_offer_events (
      event_id UUID PRIMARY KEY, tenant_id UUID NOT NULL, offer_id UUID NOT NULL REFERENCES admission_offers(id) ON DELETE CASCADE,
      event_version INTEGER NOT NULL, event_type VARCHAR(30) NOT NULL, payload JSONB NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL, processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_offer_event_version UNIQUE(offer_id,event_version)
    )`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const table of ['admission_offer_events','admission_offers','application_selection_allocation_items','application_selection_allocations','programme_merit_list_items','programme_merit_lists','application_entry_test_results','result_import_rows','result_imports']) await q.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    await q.query(`ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_applications_selected_offering, DROP CONSTRAINT IF EXISTS chk_applications_selection_status, DROP COLUMN IF EXISTS selection_status, DROP COLUMN IF EXISTS selected_programme_offering_id, DROP COLUMN IF EXISTS selection_at, DROP COLUMN IF EXISTS selection_by, DROP COLUMN IF EXISTS selection_reason`);
    await q.query(`ALTER TABLE intakes DROP CONSTRAINT IF EXISTS chk_intakes_offer_payment_period, DROP COLUMN IF EXISTS offer_payment_period_days`);
    await q.query(`ALTER TABLE programme_offerings DROP CONSTRAINT IF EXISTS chk_programme_offerings_seat_capacity, DROP COLUMN IF EXISTS seat_capacity`);
  }
}
