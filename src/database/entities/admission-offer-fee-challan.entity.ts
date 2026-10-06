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
import { OfferFeeStatus } from '../../common/enums/offer-fee.enum.js';
import { ApplicationEntity } from './application.entity.js';

@Entity({ name: 'admission_offer_fee_challans' })
@Index('uq_offer_fee_per_offer', ['tenantId', 'offerId'], { unique: true })
export class AdmissionOfferFeeChallanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'offer_id' })
  offerId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'applicant_id' })
  applicantId!: string;

  @ManyToOne(() => ApplicationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicant_id' })
  application!: ApplicationEntity;

  @Index()
  @Column({ type: 'uuid', name: 'programme_offering_id' })
  programmeOfferingId!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, name: 'challan_number' })
  challanNumber!: string;

  @Column({ type: 'timestamptz', name: 'issue_date' })
  issueDate!: Date;

  @Column({ type: 'timestamptz', name: 'due_date' })
  dueDate!: Date;

  @Column({ type: 'uuid', name: 'designated_bank_id' })
  designatedBankId!: string;

  @Column({ type: 'varchar', length: 150, name: 'collection_bank_name' })
  collectionBankName!: string;

  @Column({ type: 'varchar', length: 150, name: 'collection_bank_branch' })
  collectionBankBranch!: string;

  @Column({ type: 'varchar', length: 100, name: 'collection_bank_account' })
  collectionBankAccount!: string;

  @Column({ type: 'varchar', length: 50, name: 'branch_code' })
  branchCode!: string;

  @Column({ type: 'varchar', length: 50, name: 'institution_code', nullable: true })
  institutionCode!: string | null;

  @Column({ type: 'varchar', length: 150, name: 'applicant_name' })
  applicantName!: string;

  @Column({ type: 'varchar', length: 30, name: 'applicant_contact_number' })
  applicantContactNumber!: string;

  @Column({ type: 'varchar', length: 100, name: 'registration_number' })
  registrationNumber!: string;

  @Column({ type: 'varchar', length: 255, name: 'intake_session' })
  intakeSession!: string;

  @Column({ type: 'text', name: 'programme_name' })
  programmeName!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_amount_payable' })
  totalAmountPayable!: string;

  @Column({ type: 'varchar', length: 255, name: 'amount_in_words' })
  amountInWords!: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 40,
    name: 'payment_status',
    default: OfferFeeStatus.UNPAID,
  })
  paymentStatus!: OfferFeeStatus;

  @Column({ type: 'timestamptz', name: 'payment_date', nullable: true })
  paymentDate!: Date | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'amount_paid', nullable: true })
  amountPaid!: string | null;

  @Column({ type: 'boolean', name: 'late_payment_flag', default: false })
  latePaymentFlag!: boolean;

  @Column({ type: 'varchar', length: 100, name: 'verified_by', nullable: true })
  verifiedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'verification_date', nullable: true })
  verificationDate!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
