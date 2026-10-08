import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'test_centres' })
@Index('idx_test_centres_tenant_active', ['tenantId', 'active'])
export class TestCentreEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'varchar', length: 200, name: 'centre_name' }) centreName!: string;
  @Column({ type: 'varchar', length: 500 }) location!: string;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @Column({ type: 'uuid', name: 'created_by' }) createdBy!: string;
  @Column({ type: 'uuid', name: 'updated_by' }) updatedBy!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}
