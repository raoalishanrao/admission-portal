import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Degree-level document templates (Bachelor / Master / Doctorate).
 * Applied onto offering_required_documents for offerings of that programme degree level.
 */
@Entity({ name: 'degree_level_required_documents' })
@Unique('uq_degree_level_required_document', [
  'tenantId',
  'degreeLevel',
  'documentTypeId',
])
export class DegreeLevelRequiredDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  /** Matches programmes.degree_level: Bachelor | Master | Doctorate */
  @Index()
  @Column({ type: 'varchar', length: 30, name: 'degree_level' })
  degreeLevel!: string;

  @Column({ type: 'uuid', name: 'document_type_id' })
  documentTypeId!: string;

  @Column({ type: 'boolean', default: true })
  mandatory!: boolean;

  @Column({
    type: 'varchar',
    length: 60,
    name: 'condition_code',
    nullable: true,
  })
  conditionCode!: string | null;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Index()
  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'uuid', name: 'updated_by' })
  updatedBy!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
