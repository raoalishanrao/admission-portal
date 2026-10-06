import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IntakeEntity } from './intake.entity.js';
import { ProgrammeEntity } from './programme.entity.js';

@Entity({ name: 'programme_offerings' })
export class ProgrammeOfferingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'intake_id' })
  intakeId!: string;

  @ManyToOne(() => IntakeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'intake_id' })
  intake!: IntakeEntity;

  @Index()
  @Column({ type: 'uuid', name: 'programme_id' })
  programmeId!: string;

  @ManyToOne(() => ProgrammeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'programme_id' })
  programme!: ProgrammeEntity;

  @Index()
  @Column({ type: 'varchar', length: 30, name: 'offering_status', default: 'DRAFT' })
  offeringStatus!: string;

  @Index()
  @Column({ type: 'int', name: 'display_order', nullable: true })
  displayOrder!: number | null;

  @Column({ type: 'int', name: 'seat_capacity', nullable: true })
  seatCapacity!: number | null;

  @Column({ type: 'text', name: 'published_description' })
  publishedDescription!: string;

  @Index()
  @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
  publishedAt!: Date | null;

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
