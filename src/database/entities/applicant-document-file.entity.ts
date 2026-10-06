import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AdmissionDocumentSource } from '../../common/enums/admission-document.enum.js';

@Entity({ name: 'applicant_document_files' })
@Index('idx_applicant_document_files_owner', ['tenantId', 'applicantId'])
export class ApplicantDocumentFileEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'applicant_id' }) applicantId!: string;
  @Column({ type: 'uuid', name: 'document_type_id' }) documentTypeId!: string;
  @Column({ type: 'varchar', length: 10, name: 'source_module', default: AdmissionDocumentSource.F004 }) sourceModule!: AdmissionDocumentSource;
  @Column({ type: 'uuid', name: 'source_document_id', nullable: true }) sourceDocumentId!: string | null;
  @Column({ type: 'varchar', length: 1000, name: 'file_reference', nullable: true }) fileReference!: string | null;
  @Column({ type: 'varchar', length: 255, name: 'file_name', nullable: true }) fileName!: string | null;
  @Column({ type: 'varchar', length: 100, name: 'mime_type', nullable: true }) mimeType!: string | null;
  @Column({ type: 'bigint', name: 'file_size_bytes', nullable: true }) fileSizeBytes!: string | null;
  @Column({ type: 'char', length: 64, name: 'checksum_sha256', nullable: true }) checksumSha256!: string | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}
