import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AdmissionDocumentSource } from '../../common/enums/admission-document.enum.js';

@Entity({ name: 'applicant_documents' })
@Index('uq_applicant_document_requirement', ['tenantId', 'applicantId', 'offeringRequiredDocumentId'], { unique: true })
export class ApplicantDocumentEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Index() @Column({ type: 'uuid', name: 'applicant_id' }) applicantId!: string;
  @Column({ type: 'bigint', name: 'application_id' }) applicationId!: string;
  @Column({ type: 'uuid', name: 'programme_offering_id' }) programmeOfferingId!: string;
  @Column({ type: 'uuid', name: 'offering_required_document_id' }) offeringRequiredDocumentId!: string;
  @Column({ type: 'uuid', name: 'document_type_id' }) documentTypeId!: string;
  @Index() @Column({ type: 'uuid', name: 'document_file_id', nullable: true }) documentFileId!: string | null;
  @Column({ type: 'varchar', length: 10, name: 'source_module', default: AdmissionDocumentSource.F004 }) sourceModule!: AdmissionDocumentSource;
  @Column({ type: 'uuid', name: 'source_document_id', nullable: true }) sourceDocumentId!: string | null;
  @Column({ type: 'varchar', length: 1000, name: 'file_reference', nullable: true }) fileReference!: string | null;
  @Column({ type: 'varchar', length: 255, name: 'file_name', nullable: true }) fileName!: string | null;
  @Column({ type: 'varchar', length: 100, name: 'mime_type', nullable: true }) mimeType!: string | null;
  @Column({ type: 'bigint', name: 'file_size_bytes', nullable: true }) fileSizeBytes!: string | null;
  @Column({ type: 'char', length: 64, name: 'checksum_sha256', nullable: true }) checksumSha256!: string | null;
  @Index() @Column({ type: 'varchar', length: 30, default: 'NOT_SUBMITTED' }) status!: string;
  @Column({ type: 'uuid', name: 'submitted_by', nullable: true }) submittedBy!: string | null;
  @Column({ type: 'timestamptz', name: 'submitted_at', nullable: true }) submittedAt!: Date | null;
  @Column({ type: 'text', name: 'resubmission_reason', nullable: true }) resubmissionReason!: string | null;
  @Column({ type: 'timestamptz', name: 'resubmission_requested_at', nullable: true }) resubmissionRequestedAt!: Date | null;
  @Column({ type: 'uuid', name: 'verified_by', nullable: true }) verifiedBy!: string | null;
  @Column({ type: 'timestamptz', name: 'verified_at', nullable: true }) verifiedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}
