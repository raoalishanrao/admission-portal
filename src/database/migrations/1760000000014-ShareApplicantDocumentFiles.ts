import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ShareApplicantDocumentFiles1760000000014 implements MigrationInterface {
  name = 'ShareApplicantDocumentFiles1760000000014';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE applicant_document_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      applicant_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      document_type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT,
      source_module VARCHAR(10) NOT NULL,
      source_document_id UUID NULL,
      file_reference VARCHAR(1000) NULL,
      file_name VARCHAR(255) NULL,
      mime_type VARCHAR(100) NULL,
      file_size_bytes BIGINT NULL,
      checksum_sha256 CHAR(64) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_applicant_document_file_source CHECK (
        (source_module='F002' AND source_document_id IS NOT NULL AND file_reference IS NULL) OR
        (source_module='F004' AND source_document_id IS NULL AND file_reference IS NOT NULL)
      )
    )`);
    await q.query('CREATE INDEX idx_applicant_document_files_owner ON applicant_document_files(tenant_id, applicant_id)');
    await q.query('ALTER TABLE applicant_documents ADD COLUMN document_file_id UUID NULL');
    await q.query(`INSERT INTO applicant_document_files
      (id, tenant_id, applicant_id, document_type_id, source_module, source_document_id, file_reference, file_name, mime_type, file_size_bytes, checksum_sha256, created_at, updated_at)
      SELECT id, tenant_id, applicant_id, document_type_id, source_module, source_document_id, file_reference, file_name, mime_type, file_size_bytes, checksum_sha256, created_at, updated_at
      FROM applicant_documents WHERE status <> 'NOT_SUBMITTED'`);
    await q.query(`UPDATE applicant_documents SET document_file_id = id WHERE status <> 'NOT_SUBMITTED'`);
    await q.query(`ALTER TABLE applicant_documents ADD CONSTRAINT fk_applicant_documents_file
      FOREIGN KEY (document_file_id) REFERENCES applicant_document_files(id) ON DELETE RESTRICT`);
    await q.query('CREATE INDEX idx_applicant_documents_document_file ON applicant_documents(document_file_id)');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE applicant_documents DROP CONSTRAINT IF EXISTS fk_applicant_documents_file');
    await q.query('DROP INDEX IF EXISTS idx_applicant_documents_document_file');
    await q.query('ALTER TABLE applicant_documents DROP COLUMN IF EXISTS document_file_id');
    await q.query('DROP TABLE IF EXISTS applicant_document_files');
  }
}
