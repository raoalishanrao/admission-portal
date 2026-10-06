import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'academic_level_requirements' })
@Unique('uq_academic_level_requirements', [
  'tenantId',
  'degreeLevel',
  'requiredAcademicCode',
])
export class AcademicLevelRequirementEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  /** Matches programmes.degree_level: Bachelor | Master | Doctorate */
  @Index()
  @Column({ type: 'varchar', length: 30, name: 'degree_level' })
  degreeLevel!: string;

  /** Controlled academic code: MATRIC | FSC | BACHELOR | MASTER | DOCTORATE */
  @Column({ type: 'varchar', length: 30, name: 'required_academic_code' })
  requiredAcademicCode!: string;

  @Column({ type: 'boolean', default: true })
  mandatory!: boolean;

  @Column({ type: 'int', name: 'sort_order', nullable: true })
  sortOrder!: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Index()
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Index()
  @Column({ type: 'uuid', name: 'updated_by' })
  updatedBy!: string;
}
