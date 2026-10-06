import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEntryTestManagement1760000000015 implements MigrationInterface {
  name = 'CreateEntryTestManagement1760000000015';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE test_centres (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      intake_session_id UUID NOT NULL REFERENCES intakes(id) ON DELETE RESTRICT,
      centre_name VARCHAR(200) NOT NULL, location VARCHAR(500) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE, created_by UUID NOT NULL, updated_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await q.query('CREATE INDEX idx_test_centres_tenant_intake ON test_centres(tenant_id, intake_session_id, active)');
    await q.query(`CREATE TABLE test_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      test_centre_id UUID NOT NULL REFERENCES test_centres(id) ON DELETE RESTRICT,
      programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE RESTRICT,
      test_date DATE NOT NULL, reporting_time TIME NOT NULL, test_time TIME NOT NULL,
      room VARCHAR(100) NOT NULL, capacity INTEGER NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', created_by UUID NOT NULL, updated_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_test_session_capacity CHECK (capacity IS NULL OR capacity > 0),
      CONSTRAINT chk_test_session_status CHECK (status IN ('DRAFT','PUBLISHED','CLOSED','CANCELLED')),
      CONSTRAINT chk_test_session_times CHECK (reporting_time < test_time)
    )`);
    await q.query('CREATE INDEX idx_test_sessions_tenant_centre_status ON test_sessions(tenant_id, test_centre_id, status)');
    await q.query(`CREATE TABLE application_admit_cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      applicant_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      application_id VARCHAR(100) NOT NULL, test_session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE RESTRICT,
      serial_number VARCHAR(100) NOT NULL, intake_session VARCHAR(150) NOT NULL,
      applicant_name VARCHAR(250) NOT NULL, father_guardian_name VARCHAR(250) NOT NULL,
      gender VARCHAR(30) NOT NULL, photograph_reference VARCHAR(1000) NOT NULL,
      programme_options JSONB NOT NULL, test_venue VARCHAR(500) NOT NULL,
      test_date DATE NOT NULL, reporting_time TIME NOT NULL, test_time TIME NOT NULL,
      room VARCHAR(100) NOT NULL, issue_date DATE NOT NULL, instructions TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED', qr_token VARCHAR(100) NOT NULL UNIQUE,
      qr_generated_at TIMESTAMPTZ NOT NULL, generated_by UUID NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_admit_card_status CHECK (status IN ('PUBLISHED','SUPERSEDED'))
    )`);
    await q.query(`CREATE UNIQUE INDEX uq_active_admit_card_application ON application_admit_cards(tenant_id, applicant_id) WHERE status='PUBLISHED'`);
    await q.query('CREATE INDEX idx_admit_cards_tenant_session ON application_admit_cards(tenant_id, test_session_id)');
    await q.query(`CREATE TABLE application_attendance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      applicant_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      application_id VARCHAR(100) NOT NULL, test_session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE RESTRICT,
      admit_card_id UUID NOT NULL REFERENCES application_admit_cards(id) ON DELETE RESTRICT,
      attendance_status VARCHAR(20) NOT NULL DEFAULT 'PENDING', identity_verified BOOLEAN NULL,
      verification_failure_reason VARCHAR(500) NULL, scan_count INTEGER NOT NULL DEFAULT 0,
      first_scanned_at TIMESTAMPTZ NULL, last_scanned_at TIMESTAMPTZ NULL,
      marked_by UUID NULL, marked_at TIMESTAMPTZ NULL, recorded_by UUID NULL,
      result_awaited_at TIMESTAMPTZ NULL, result_awaited_by UUID NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_application_attendance_app_session UNIQUE (tenant_id, applicant_id, test_session_id),
      CONSTRAINT chk_application_attendance_status CHECK (attendance_status IN ('PENDING','PRESENT','ABSENT')),
      CONSTRAINT chk_application_attendance_scan_count CHECK (scan_count >= 0),
      CONSTRAINT chk_application_attendance_failure CHECK (identity_verified IS NOT FALSE OR (verification_failure_reason IS NOT NULL AND btrim(verification_failure_reason) <> ''))
    )`);
    await q.query('CREATE INDEX idx_application_attendance_session_status ON application_attendance(tenant_id, test_session_id, attendance_status)');
    await q.query(`CREATE TABLE application_attendance_audits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      attendance_id UUID NOT NULL REFERENCES application_attendance(id) ON DELETE CASCADE,
      from_status VARCHAR(20) NULL, to_status VARCHAR(20) NOT NULL,
      identity_verified BOOLEAN NULL, reason TEXT NULL, acted_by UUID NOT NULL,
      acted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await q.query('CREATE INDEX idx_application_attendance_audits_history ON application_attendance_audits(tenant_id, attendance_id, acted_at)');
    await q.query(`CREATE TABLE application_attendance_scans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      attendance_id UUID NULL REFERENCES application_attendance(id) ON DELETE SET NULL,
      applicant_id UUID NULL REFERENCES applications(id) ON DELETE SET NULL,
      application_id VARCHAR(100) NULL,
      admit_card_id UUID NULL REFERENCES application_admit_cards(id) ON DELETE SET NULL,
      test_session_id UUID NULL REFERENCES test_sessions(id) ON DELETE SET NULL,
      scan_token_hash CHAR(64) NOT NULL,
      scan_status VARCHAR(30) NOT NULL,
      scanned_by UUID NOT NULL, scanned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(64) NULL, user_agent VARCHAR(500) NULL,
      CONSTRAINT chk_attendance_scan_status CHECK (scan_status IN ('SCANNED','INVALID','EXPIRED','ALREADY_ATTENDED'))
    )`);
    await q.query('CREATE INDEX idx_attendance_scans_card_time ON application_attendance_scans(tenant_id, admit_card_id, scanned_at DESC)');
    await q.query(`CREATE TABLE application_entry_test_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
      applicant_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      application_id VARCHAR(100) NOT NULL,
      attendance_id UUID NOT NULL REFERENCES application_attendance(id) ON DELETE RESTRICT,
      outcome_status VARCHAR(50) NOT NULL, outcome_details TEXT NULL, outcome_date DATE NULL,
      recorded_by UUID NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_entry_test_outcomes_attendance UNIQUE (tenant_id, attendance_id)
    )`);
    await q.query('ALTER TABLE application_declarations ADD COLUMN selected_test_centre_id UUID NULL REFERENCES test_centres(id) ON DELETE RESTRICT');
    await q.query('CREATE INDEX idx_application_declarations_test_centre ON application_declarations(tenant_id, selected_test_centre_id)');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX IF EXISTS idx_application_declarations_test_centre');
    await q.query('ALTER TABLE application_declarations DROP COLUMN IF EXISTS selected_test_centre_id');
    await q.query('DROP TABLE IF EXISTS application_entry_test_outcomes');
    await q.query('DROP TABLE IF EXISTS application_attendance_scans');
    await q.query('DROP TABLE IF EXISTS application_attendance_audits');
    await q.query('DROP TABLE IF EXISTS application_attendance');
    await q.query('DROP TABLE IF EXISTS application_admit_cards');
    await q.query('DROP TABLE IF EXISTS test_sessions');
    await q.query('DROP TABLE IF EXISTS test_centres');
  }
}
