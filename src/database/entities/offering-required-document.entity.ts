import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'offering_required_documents' })
@Index('uq_offering_required_document_type', ['tenantId', 'programmeOfferingId', 'documentTypeId'], { unique: true })
export class OfferingRequiredDocumentEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Index() @Column({ type: 'uuid', name: 'programme_offering_id' }) programmeOfferingId!: string;
  @Column({ type: 'uuid', name: 'document_type_id' }) documentTypeId!: string;
  @Column({ type: 'boolean', default: true }) mandatory!: boolean;
  @Column({ type: 'varchar', length: 60, name: 'condition_code', nullable: true }) conditionCode!: string | null;
  @Column({ type: 'int', name: 'sort_order', default: 0 }) sortOrder!: number;
  @Index() @Column({ type: 'boolean', default: true }) active!: boolean;
  /** MANUAL = configured on offering; DEGREE_LEVEL = synced from degree template. */
  @Column({ type: 'varchar', length: 30, default: 'MANUAL' }) source!: string;
  @Column({
    type: 'uuid',
    name: 'source_degree_level_requirement_id',
    nullable: true,
  })
  sourceDegreeLevelRequirementId!: string | null;
  @Column({ type: 'uuid', name: 'created_by' }) createdBy!: string;
  @Column({ type: 'uuid', name: 'updated_by' }) updatedBy!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}
