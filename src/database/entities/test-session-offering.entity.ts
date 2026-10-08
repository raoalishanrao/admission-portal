import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'test_session_offerings' })
@Index('uq_test_session_offerings_session_offering', ['tenantId', 'testSessionId', 'programmeOfferingId'], { unique: true })
export class TestSessionOfferingEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'test_session_id' }) testSessionId!: string;
  @Column({ type: 'uuid', name: 'programme_offering_id' }) programmeOfferingId!: string;
}
