import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SeatReleaseTrigger } from '../../common/enums/offer-fee.enum.js';

@Entity({ name: 'selection_seat_release_runs' })
export class SelectionSeatReleaseRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'intake_session_id' })
  intakeSessionId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'programme_offering_id' })
  programmeOfferingId!: string;

  @Column({ type: 'varchar', length: 30, name: 'trigger_type' })
  triggerType!: SeatReleaseTrigger;

  @Column({ type: 'integer', name: 'seats_freed', default: 0 })
  seatsFreed!: number;

  @Column({ type: 'integer', name: 'promoted_count', default: 0 })
  promotedCount!: number;

  @Column({ type: 'uuid', name: 'expired_offer_id', nullable: true })
  expiredOfferId!: string | null;

  @Column({ type: 'uuid', name: 'promoted_application_id', nullable: true })
  promotedApplicationId!: string | null;

  @Column({ type: 'uuid', name: 'new_offer_id', nullable: true })
  newOfferId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details!: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
