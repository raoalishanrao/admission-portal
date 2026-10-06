import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'application_entry_test_outcomes' })
@Index('uq_entry_test_outcomes_attendance', ['tenantId', 'attendanceId'], { unique: true })
export class ApplicationEntryTestOutcomeEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'applicant_id' }) applicantId!: string;
  @Column({ type: 'varchar', length: 100, name: 'application_id' }) applicationId!: string;
  @Column({ type: 'uuid', name: 'attendance_id' }) attendanceId!: string;
  @Column({ type: 'varchar', length: 50, name: 'outcome_status' }) outcomeStatus!: string;
  @Column({ type: 'text', name: 'outcome_details', nullable: true }) outcomeDetails!: string | null;
  @Column({ type: 'date', name: 'outcome_date', nullable: true }) outcomeDate!: string | null;
  @Column({ type: 'uuid', name: 'recorded_by' }) recordedBy!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'recorded_at' }) recordedAt!: Date;
}
