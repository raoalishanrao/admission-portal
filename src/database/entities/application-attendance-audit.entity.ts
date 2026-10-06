import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'application_attendance_audits' })
@Index('idx_application_attendance_audits_history', ['tenantId', 'attendanceId', 'actedAt'])
export class ApplicationAttendanceAuditEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'attendance_id' }) attendanceId!: string;
  @Column({ type: 'varchar', length: 20, name: 'from_status', nullable: true }) fromStatus!: string | null;
  @Column({ type: 'varchar', length: 20, name: 'to_status' }) toStatus!: string;
  @Column({ type: 'boolean', name: 'identity_verified', nullable: true }) identityVerified!: boolean | null;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ type: 'uuid', name: 'acted_by' }) actedBy!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'acted_at' }) actedAt!: Date;
}
