import { Building2, CircleDollarSign, FileCheck2, GraduationCap } from 'lucide-react'
import type { CatalogModule, CatalogRow, ModuleKey } from '@/types/catalog'

export const catalogModules: CatalogModule[] = [
  {
    name: 'Departments',
    icon: Building2,
    description: 'Manage academic departments. Departments can have multiple programmes.',
    action: 'Create Department',
    columns: ['Department Name', 'Code', 'Description', 'Programmes'],
    breadcrumbSection: 'Academic Catalogue',
  },
  {
    name: 'Programmes',
    icon: GraduationCap,
    description: 'Manage academic programmes and their department associations.',
    action: 'Create Programme',
    columns: ['Programme Name', 'Code', 'Department', 'Duration'],
    breadcrumbSection: 'Academic Catalogue',
  },
  {
    name: 'Admission criteria',
    icon: FileCheck2,
    description: 'Manage reusable admission criteria for programme offerings.',
    action: 'Create Admission Criterion',
    columns: ['Criterion Type', 'Criteria Requirement', 'Mandatory', 'Effective From'],
    breadcrumbSection: 'Configuration',
    pageTitle: 'Admission Criteria',
  },
  {
    name: 'Application fees',
    icon: CircleDollarSign,
    description: 'Manage fee types used in the admissions process. These fee types can be associated with programme offerings.',
    action: 'Create Fee Type',
    columns: ['Fee Type', 'Description', 'Status', 'Created On'],
    breadcrumbSection: 'Configuration',
  },
]

export const catalogData: Record<ModuleKey, CatalogRow[]> = {
  Departments: [
    { name: 'Business Administration', code: 'BBA', detail: 'Department of business and management studies.', value: '6', status: 'Active' },
    { name: 'Computer Science', code: 'CS', detail: 'Department of computer science and technology.', value: '8', status: 'Active' },
    { name: 'Education', code: 'EDU', detail: 'Department of education and teacher training.', value: '5', status: 'Active' },
    { name: 'Engineering', code: 'ENG', detail: 'Department of engineering and applied sciences.', value: '7', status: 'Active' },
    { name: 'Arts & Design', code: 'ART', detail: 'Department of arts, design and creative studies.', value: '4', status: 'Inactive' },
  ],
  Programmes: [
    { name: 'Bachelor of Computer Science', code: 'BCS', detail: 'Computer Science', value: 'Bachelor', status: 'Active' },
    { name: 'Bachelor of Business Administration', code: 'BBA', detail: 'Business Administration', value: 'Bachelor', status: 'Active' },
    { name: 'Master of Computer Science', code: 'MCS', detail: 'Computer Science', value: 'Master', status: 'Active' },
    { name: 'Master of Education', code: 'MED', detail: 'Education', value: 'Master', status: 'Inactive' },
  ],
  'Admission criteria': [
    { name: 'Academic Qualification', code: 'AQ-01', detail: 'Minimum 60% in Intermediate', value: 'Yes', status: 'Active' },
    { name: 'Subject Requirement', code: 'SR-01', detail: 'Mathematics required', value: 'Yes', status: 'Active' },
    { name: 'English Proficiency', code: 'EP-01', detail: 'IELTS 6.0 or equivalent', value: 'No', status: 'Active' },
    { name: 'Work Experience', code: 'WE-01', detail: 'Minimum 2 years relevant experience', value: 'No', status: 'Inactive' },
  ],
  'Application fees': [
    { name: 'Application Fee', code: 'APP', detail: 'Fee for submitting an application', value: 'Jan 10, 2024', status: 'Active' },
    { name: 'Processing Fee', code: 'PROC', detail: 'Administrative processing fee', value: 'Jan 10, 2024', status: 'Active' },
    { name: 'Entry Test Fee', code: 'TEST', detail: 'Fee for entry test', value: 'Jan 15, 2024', status: 'Active' },
    { name: 'Document Verification Fee', code: 'DOC', detail: 'Fee for document verification', value: 'Feb 01, 2024', status: 'Inactive' },
  ],
}

export function getCatalogModule(key: ModuleKey) {
  return catalogModules.find(item => item.name === key)!
}
