import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'application_attendance' })
@Index('uq_application_attendance_app_session', ['tenantId', 'applicantId', 'testSessionId'], { unique: true })
export class ApplicationAttendanceEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'applicant_id' }) applicantId!: string;
  @Column({ type: 'varchar', length: 100, name: 'application_id' }) applicationId!: string;
  @Column({ type: 'uuid', name: 'test_session_id' }) testSessionId!: string;
  @Column({ type: 'uuid', name: 'admit_card_id' }) admitCardId!: string;
  @Column({ type: 'varchar', length: 20, name: 'attendance_status', default: 'PENDING' }) attendanceStatus!: string;
  @Column({ type: 'boolean', name: 'identity_verified', nullable: true }) identityVerified!: boolean | null;
  @Column({ type: 'varchar', length: 500, name: 'verification_failure_reason', nullable: true }) verificationFailureReason!: string | null;
  @Column({ type: 'integer', name: 'scan_count', default: 0 }) scanCount!: number;
  @Column({ type: 'timestamptz', name: 'first_scanned_at', nullable: true }) firstScannedAt!: Date | null;
  @Column({ type: 'timestamptz', name: 'last_scanned_at', nullable: true }) lastScannedAt!: Date | null;
  @Column({ type: 'uuid', name: 'marked_by', nullable: true }) markedBy!: string | null;
  @Column({ type: 'timestamptz', name: 'marked_at', nullable: true }) markedAt!: Date | null;
  @Column({ type: 'uuid', name: 'recorded_by', nullable: true }) recordedBy!: string | null;
  @Column({ type: 'timestamptz', name: 'result_awaited_at', nullable: true }) resultAwaitedAt!: Date | null;
  @Column({ type: 'uuid', name: 'result_awaited_by', nullable: true }) resultAwaitedBy!: string | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'recorded_at' }) recordedAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}
