import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'test_sessions' })
@Index('idx_test_sessions_tenant_centre_status', ['tenantId', 'testCentreId', 'status'])
@Index('idx_test_sessions_tenant_intake_status', ['tenantId', 'intakeSessionId', 'status'])
export class TestSessionEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'test_centre_id' }) testCentreId!: string;
  @Column({ type: 'uuid', name: 'intake_session_id' }) intakeSessionId!: string;
  @Column({ type: 'date', name: 'test_date' }) testDate!: string;
  @Column({ type: 'time', name: 'reporting_time' }) reportingTime!: string;
  @Column({ type: 'time', name: 'test_time' }) testTime!: string;
  @Column({ type: 'varchar', length: 100 }) room!: string;
  @Column({ type: 'integer', nullable: true }) capacity!: number | null;
  @Column({ type: 'varchar', length: 20, default: 'DRAFT' }) status!: string;
  @Column({ type: 'uuid', name: 'created_by' }) createdBy!: string;
  @Column({ type: 'uuid', name: 'updated_by' }) updatedBy!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}
