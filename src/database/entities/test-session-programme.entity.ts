import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'test_session_programmes' })
@Index('uq_test_session_programmes_session_programme', ['tenantId', 'testSessionId', 'programmeId'], { unique: true })
export class TestSessionProgrammeEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'test_session_id' }) testSessionId!: string;
  @Column({ type: 'uuid', name: 'programme_id' }) programmeId!: string;
}
