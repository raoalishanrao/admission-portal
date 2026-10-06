import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  PaymentEvidenceSource,
  PaymentEvidenceVerificationIndicator,
} from '../../common/enums/processing-fee.enum.js';
import { AdmissionOfferFeeChallanEntity } from './admission-offer-fee-challan.entity.js';
import { ApplicationEntity } from './application.entity.js';

@Entity({ name: 'admission_offer_fee_evidences' })
export class AdmissionOfferFeeEvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'applicant_id' })
  applicantId!: string;

  @ManyToOne(() => ApplicationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicant_id' })
  application!: ApplicationEntity;

  @Index()
  @Column({ type: 'uuid', name: 'challan_id' })
  challanId!: string;

  @ManyToOne(() => AdmissionOfferFeeChallanEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challan_id' })
  challan!: AdmissionOfferFeeChallanEntity;

  @Column({ type: 'varchar', length: 500, name: 'storage_key' })
  storageKey!: string;

  @Column({ type: 'varchar', length: 10, name: 'file_format' })
  fileFormat!: string;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'evidence_source',
    default: PaymentEvidenceSource.BANK_RECEIPT,
  })
  evidenceSource!: PaymentEvidenceSource;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'amount_claimed', nullable: true })
  amountClaimed!: string | null;

  @Column({ type: 'timestamptz', name: 'deposited_at', nullable: true })
  depositedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'upload_date' })
  uploadDate!: Date;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'verification_indicator',
    default: PaymentEvidenceVerificationIndicator.UNVERIFIED,
  })
  verificationIndicator!: PaymentEvidenceVerificationIndicator;

  @Column({ type: 'varchar', length: 100, name: 'verified_by', nullable: true })
  verifiedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'verification_date', nullable: true })
  verificationDate!: Date | null;

  @Column({ type: 'text', name: 'review_notes', nullable: true })
  reviewNotes!: string | null;

  @Column({ type: 'uuid', name: 'replaced_by', nullable: true })
  replacedBy!: string | null;

  @Column({ type: 'boolean', name: 'is_current', default: true })
  isCurrent!: boolean;
}
