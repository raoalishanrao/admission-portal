import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'application_special_category_claims' })
@Unique('uq_special_category_claim_app_cat', [
  'tenantId',
  'applicantId',
  'specialCategoryId',
])
export class ApplicationSpecialCategoryClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'applicant_id' })
  applicantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'special_category_id' })
  specialCategoryId!: string;

  /** CLAIMED | VERIFIED | REJECTED */
  @Column({ type: 'varchar', length: 20, default: 'CLAIMED' })
  status!: string;

  @Column({ type: 'text', name: 'rejection_reason', nullable: true })
  rejectionReason!: string | null;

  @Column({ type: 'uuid', name: 'reviewed_by', nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'uuid', name: 'updated_by' })
  updatedBy!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
