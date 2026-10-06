import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { MeritFormulaTemplateEntity } from './merit-formula-template.entity.js';
import { OfferingMeritFormulaComponentEntity } from './offering-merit-formula-component.entity.js';
import { ProgrammeOfferingEntity } from './programme-offering.entity.js';

@Entity({ name: 'offering_merit_formulas' })
@Unique('uq_offering_merit_formula_offering', ['tenantId', 'programmeOfferingId'])
export class OfferingMeritFormulaEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'programme_offering_id' })
  programmeOfferingId!: string;

  @ManyToOne(() => ProgrammeOfferingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'programme_offering_id' })
  programmeOffering!: ProgrammeOfferingEntity;

  @Column({ type: 'uuid', name: 'template_id', nullable: true })
  templateId!: string | null;

  @ManyToOne('MeritFormulaTemplateEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'template_id' })
  template!: MeritFormulaTemplateEntity | null;

  @Column({ type: 'varchar', length: 30, name: 'degree_level' })
  degreeLevel!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  name!: string | null;

  @OneToMany(
    () => OfferingMeritFormulaComponentEntity,
    (c) => c.offeringFormula,
    { cascade: true },
  )
  components!: OfferingMeritFormulaComponentEntity[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'uuid', name: 'updated_by' })
  updatedBy!: string;
}
