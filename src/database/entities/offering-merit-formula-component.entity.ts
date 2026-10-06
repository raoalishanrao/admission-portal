import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { OfferingMeritFormulaEntity } from './offering-merit-formula.entity.js';

@Entity({ name: 'offering_merit_formula_components' })
@Unique('uq_offering_merit_component_source', [
  'offeringFormulaId',
  'sourceType',
])
export class OfferingMeritFormulaComponentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'offering_formula_id' })
  offeringFormulaId!: string;

  @ManyToOne('OfferingMeritFormulaEntity', 'components', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'offering_formula_id' })
  offeringFormula!: OfferingMeritFormulaEntity;

  @Column({ type: 'varchar', length: 30, name: 'source_type' })
  sourceType!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  weight!: string;

  @Column({ type: 'int', name: 'sort_order', nullable: true })
  sortOrder!: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
