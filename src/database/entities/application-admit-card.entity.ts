import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'application_admit_cards' })
@Index('idx_admit_cards_tenant_applicant', ['tenantId', 'applicantId'])
export class ApplicationAdmitCardEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'applicant_id' }) applicantId!: string;
  @Column({ type: 'varchar', length: 100, name: 'application_id' }) applicationId!: string;
  @Column({ type: 'uuid', name: 'test_session_id' }) testSessionId!: string;
  @Column({ type: 'varchar', length: 100, name: 'serial_number' }) serialNumber!: string;
  @Column({ type: 'varchar', length: 150, name: 'intake_session' }) intakeSession!: string;
  @Column({ type: 'varchar', length: 250, name: 'applicant_name' }) applicantName!: string;
  @Column({ type: 'varchar', length: 250, name: 'father_guardian_name' }) fatherGuardianName!: string;
  @Column({ type: 'varchar', length: 30 }) gender!: string;
  @Column({ type: 'varchar', length: 1000, name: 'photograph_reference' }) photographReference!: string;
  @Column({ type: 'jsonb', name: 'programme_options' }) programmeOptions!: Array<{ preferenceOrder: number; programmeId: string; programmeCode: string; programmeName: string }>;
  @Column({ type: 'varchar', length: 500, name: 'test_venue' }) testVenue!: string;
  @Column({ type: 'date', name: 'test_date' }) testDate!: string;
  @Column({ type: 'time', name: 'reporting_time' }) reportingTime!: string;
  @Column({ type: 'time', name: 'test_time' }) testTime!: string;
  @Column({ type: 'varchar', length: 100 }) room!: string;
  @Column({ type: 'date', name: 'issue_date' }) issueDate!: string;
  @Column({ type: 'text' }) instructions!: string;
  @Column({ type: 'varchar', length: 30, default: 'PUBLISHED' }) status!: string;
  @Column({ type: 'varchar', length: 100, name: 'qr_token' }) qrToken!: string;
  @Column({ type: 'timestamptz', name: 'qr_generated_at' }) qrGeneratedAt!: Date;
  @Column({ type: 'uuid', name: 'generated_by' }) generatedBy!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'generated_at' }) generatedAt!: Date;
  @Column({ type: 'timestamptz', name: 'published_at' }) publishedAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}
