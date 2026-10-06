import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'application_attendance_scans' })
@Index('idx_attendance_scans_card_time', ['tenantId', 'admitCardId', 'scannedAt'])
export class ApplicationAttendanceScanEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'attendance_id', nullable: true }) attendanceId!: string | null;
  @Column({ type: 'uuid', name: 'applicant_id', nullable: true }) applicantId!: string | null;
  @Column({ type: 'varchar', length: 100, name: 'application_id', nullable: true }) applicationId!: string | null;
  @Column({ type: 'uuid', name: 'admit_card_id', nullable: true }) admitCardId!: string | null;
  @Column({ type: 'uuid', name: 'test_session_id', nullable: true }) testSessionId!: string | null;
  @Column({ type: 'char', length: 64, name: 'scan_token_hash' }) scanTokenHash!: string;
  @Column({ type: 'varchar', length: 30, name: 'scan_status' }) scanStatus!: string;
  @Column({ type: 'uuid', name: 'scanned_by' }) scannedBy!: string;
  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true }) ipAddress!: string | null;
  @Column({ type: 'varchar', length: 500, name: 'user_agent', nullable: true }) userAgent!: string | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'scanned_at' }) scannedAt!: Date;
}
