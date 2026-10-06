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
import { ApplicationAcademicDocumentEntity } from './application-academic-document.entity.js';
import { ApplicationEntity } from './application.entity.js';

@Entity({ name: 'application_academic_information' })
@Unique('uq_academic_info_applicant_degree_type', ['applicantId', 'degreeType'])
export class ApplicationAcademicInformationEntity {
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

  /** Controlled code: MATRIC | FSC | BACHELOR | MASTER | DOCTORATE */
  @Column({ type: 'varchar', length: 80, name: 'degree_type' })
  degreeType!: string;

  @Column({ type: 'varchar', length: 80, name: 'roll_number', nullable: true })
  rollNumber!: string | null;

  @Column({ type: 'varchar', length: 200, name: 'qualification_name' })
  qualificationName!: string;

  @Column({ type: 'varchar', length: 255, name: 'board_or_institution' })
  boardOrInstitution!: string;

  @Column({ type: 'varchar', length: 10, name: 'passing_year' })
  passingYear!: string;

  @Column({ type: 'varchar', length: 50 })
  division!: string;

  @Column({ type: 'varchar', length: 50 })
  grade!: string;

  @Column({ type: 'varchar', length: 50, name: 'marks_or_gpa_obtained' })
  marksOrGpaObtained!: string;

  @Column({ type: 'varchar', length: 50, name: 'marks_or_gpa_total' })
  marksOrGpaTotal!: string;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  percentage!: string;

  @OneToMany(
    () => ApplicationAcademicDocumentEntity,
    (doc) => doc.academicInformation,
  )
  documents!: ApplicationAcademicDocumentEntity[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
