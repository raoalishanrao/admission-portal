import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DegreeLevel } from '../../common/enums/master-data.enum.js';
import { ApplicationEntity } from './application.entity.js';
import { IntakeEntity } from './intake.entity.js';

@Entity({ name: 'application_programme_selection' })
export class ApplicationProgrammeSelectionEntity {
  @PrimaryColumn({ type: 'uuid', name: 'applicant_id' })
  applicantId!: string;

  @ManyToOne(() => ApplicationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicant_id' })
  application!: ApplicationEntity;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'intake_session_id' })
  intakeSessionId!: string;

  @ManyToOne(() => IntakeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'intake_session_id' })
  intake!: IntakeEntity;

  /** Same canonical values as programmes.degree_level. */
  @Column({ type: 'varchar', length: 30, name: 'degree_level' })
  degreeLevel!: DegreeLevel;

  @Column({
    type: 'timestamptz',
    name: 'applied_date',
    default: () => 'CURRENT_TIMESTAMP',
  })
  appliedDate!: Date;

  @Column({ type: 'boolean', name: 'step_saved', default: false })
  stepSaved!: boolean;

  @Column({ type: 'timestamptz', name: 'saved_at', nullable: true })
  savedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
