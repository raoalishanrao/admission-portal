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
 * Links a tenant special category to a programme offering.
 * Applicants only see (and earn bonus for) categories linked to their selected offerings.
 */
@Entity({ name: 'offering_special_categories' })
@Unique('uq_offering_special_category', [
  'tenantId',
  'programmeOfferingId',
  'specialCategoryId',
])
export class OfferingSpecialCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'programme_offering_id' })
  programmeOfferingId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'special_category_id' })
  specialCategoryId!: string;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'uuid', name: 'updated_by' })
  updatedBy!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
