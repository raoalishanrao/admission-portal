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
import type { MeritFormulaTemplateEntity } from './merit-formula-template.entity.js';

@Entity({ name: 'merit_formula_template_components' })
@Unique('uq_merit_tpl_component_source', ['templateId', 'sourceType'])
export class MeritFormulaTemplateComponentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'template_id' })
  templateId!: string;

  @ManyToOne('MeritFormulaTemplateEntity', 'components', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template!: MeritFormulaTemplateEntity;

  @Column({ type: 'varchar', length: 30, name: 'source_type' })
  sourceType!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  weight!: string;

  @Column({ type: 'int', name: 'sort_order', nullable: true })
  sortOrder!: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
