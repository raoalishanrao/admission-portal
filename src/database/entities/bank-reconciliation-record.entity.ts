import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  ReconciliationMatchStatus,
  ReconciliationResolutionStatus,
} from '../../common/enums/processing-fee.enum.js';
import { BankReconciliationImportEntity } from './bank-reconciliation-import.entity.js';

@Entity({ name: 'bank_reconciliation_records' })
@Index('idx_bank_reconciliation_import_receipt', ['importId', 'receiptNo'])
export class BankReconciliationRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'import_id' })
  importId!: string;

  @ManyToOne(() => BankReconciliationImportEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_id' })
  import!: BankReconciliationImportEntity;

  @Index()
  @Column({ type: 'varchar', length: 100, name: 'receipt_no' })
  receiptNo!: string;

  @Column({ type: 'varchar', length: 100, name: 'consumer_no' })
  consumerNo!: string;

  @Column({ type: 'varchar', length: 255, name: 'class_name' })
  className!: string;

  @Column({ type: 'varchar', length: 255, name: 'student_name' })
  studentName!: string;

  @Column({ type: 'date', name: 'valid_date_of_voucher' })
  validDateOfVoucher!: string;

  @Column({ type: 'date', name: 'due_date' })
  dueDate!: string;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    name: 'amount_within_dd',
  })
  amountWithinDd!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'amount_after_dd' })
  amountAfterDd!: string;

  @Column({ type: 'varchar', length: 50, name: 'campus_code' })
  campusCode!: string;

  @Column({ type: 'date', name: 'date_paid' })
  datePaid!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 50, name: 'payment_mode' })
  paymentMode!: string;

  @Column({ type: 'varchar', length: 50, name: 'branch_code' })
  branchCode!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  usertext1!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  usertext2!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  usertext3!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  usertext4!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  usertext5!: string | null;

  @Index()
  @Column({ type: 'uuid', name: 'matched_challan_id', nullable: true })
  matchedChallanId!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'matched_challan_kind',
    nullable: true,
  })
  matchedChallanKind!: 'PROCESSING' | 'OFFER' | null;

  @Column({ type: 'varchar', length: 40, name: 'match_status' })
  matchStatus!: ReconciliationMatchStatus;

  @Column({ type: 'boolean', name: 'registration_match', nullable: true })
  registrationMatch!: boolean | null;

  @Column({ type: 'boolean', name: 'amount_match', nullable: true })
  amountMatch!: boolean | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'duplicate_key',
    nullable: true,
  })
  duplicateKey!: string | null;

  @Column({
    type: 'varchar',
    length: 60,
    name: 'exception_type',
    nullable: true,
  })
  exceptionType!: string | null;

  @Index()
  @Column({
    type: 'varchar',
    length: 30,
    name: 'resolution_status',
    default: ReconciliationResolutionStatus.OPEN,
  })
  resolutionStatus!: ReconciliationResolutionStatus;

  @Column({ type: 'varchar', length: 100, name: 'resolved_by', nullable: true })
  resolvedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'resolution_date', nullable: true })
  resolutionDate!: Date | null;
}
