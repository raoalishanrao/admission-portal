export type ProgrammeLevel = 'Bachelor' | 'Master' | 'Doctorate'
export type ProgrammeStatus = 'Active' | 'Inactive'

export type Programme = {
  name: string
  code: string
  department: string
  level: ProgrammeLevel
  duration: string
  status: ProgrammeStatus
}

export const programmeLevels: ProgrammeLevel[] = ['Bachelor', 'Master', 'Doctorate']

export const programmeDepartments = [
  'Business Administration',
  'Computer Science',
  'Education',
  'Engineering',
  'Health Sciences',
  'Law',
  'Liberal Arts',
  'Medicine',
  'Nursing',
  'Pharmacy',
  'Social Sciences',
  'Arts & Design',
] as const

export const programmes: Programme[] = [
  { name: 'Bachelor of Computer Science', code: 'BCS', department: 'Computer Science', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Business Administration', code: 'BBA', department: 'Business Administration', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Engineering', code: 'BENG', department: 'Engineering', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Education', code: 'BED', department: 'Education', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Master of Business Administration', code: 'MBA', department: 'Business Administration', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Computer Science', code: 'MCS', department: 'Computer Science', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Education', code: 'MED', department: 'Education', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Science in Engineering', code: 'MENG', department: 'Engineering', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'PhD in Business Administration', code: 'PHD-BBA', department: 'Business Administration', level: 'Doctorate', duration: '3 Years', status: 'Active' },
  { name: 'PhD in Computer Science', code: 'PHD-CS', department: 'Computer Science', level: 'Doctorate', duration: '3 Years', status: 'Inactive' },
  { name: 'PhD in Education', code: 'PHD-EDU', department: 'Education', level: 'Doctorate', duration: '3 Years', status: 'Active' },
  { name: 'PhD in Engineering', code: 'PHD-ENG', department: 'Engineering', level: 'Doctorate', duration: '3 Years', status: 'Active' },
  { name: 'Bachelor of Health Sciences', code: 'BHS', department: 'Health Sciences', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Law', code: 'BLAW', department: 'Law', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Liberal Arts', code: 'BLA', department: 'Liberal Arts', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Medicine', code: 'BMED', department: 'Medicine', level: 'Bachelor', duration: '5 Years', status: 'Active' },
  { name: 'Bachelor of Nursing', code: 'BNUR', department: 'Nursing', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Pharmacy', code: 'BPHR', department: 'Pharmacy', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Social Sciences', code: 'BSS', department: 'Social Sciences', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Arts & Design', code: 'BAAD', department: 'Arts & Design', level: 'Bachelor', duration: '4 Years', status: 'Inactive' },
  { name: 'Master of Health Sciences', code: 'MHS', department: 'Health Sciences', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Law', code: 'MLAW', department: 'Law', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Liberal Arts', code: 'MLA', department: 'Liberal Arts', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Nursing', code: 'MNUR', department: 'Nursing', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Pharmacy', code: 'MPHR', department: 'Pharmacy', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Social Sciences', code: 'MSS', department: 'Social Sciences', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'PhD in Health Sciences', code: 'PHD-HS', department: 'Health Sciences', level: 'Doctorate', duration: '3 Years', status: 'Active' },
  { name: 'PhD in Law', code: 'PHD-LAW', department: 'Law', level: 'Doctorate', duration: '3 Years', status: 'Active' },
  { name: 'Bachelor of Software Engineering', code: 'BSE', department: 'Computer Science', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Data Science', code: 'BDS', department: 'Computer Science', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Finance', code: 'BFIN', department: 'Business Administration', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Marketing', code: 'BMKT', department: 'Business Administration', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Civil Engineering', code: 'BCVE', department: 'Engineering', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Mechanical Engineering', code: 'BME', department: 'Engineering', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Early Childhood Education', code: 'BECE', department: 'Education', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Master of Data Analytics', code: 'MDA', department: 'Computer Science', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Bachelor of Information Technology', code: 'BIT', department: 'Computer Science', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Master of Software Engineering', code: 'MSE', department: 'Computer Science', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Public Administration', code: 'MPA', department: 'Social Sciences', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Public Health', code: 'MPH', department: 'Health Sciences', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'PhD in Social Sciences', code: 'PHD-SS', department: 'Social Sciences', level: 'Doctorate', duration: '3 Years', status: 'Inactive' },
  { name: 'PhD in Medicine', code: 'PHD-MED', department: 'Medicine', level: 'Doctorate', duration: '4 Years', status: 'Active' },
  { name: 'Bachelor of Architecture', code: 'BARCH', department: 'Engineering', level: 'Bachelor', duration: '5 Years', status: 'Active' },
  { name: 'Bachelor of Psychology', code: 'BPSY', department: 'Social Sciences', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Master of Clinical Pharmacy', code: 'MCP', department: 'Pharmacy', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'Master of Fine Arts', code: 'MFA', department: 'Arts & Design', level: 'Master', duration: '2 Years', status: 'Inactive' },
  { name: 'Bachelor of International Relations', code: 'BIR', department: 'Social Sciences', level: 'Bachelor', duration: '4 Years', status: 'Active' },
  { name: 'Master of Human Resource Management', code: 'MHRM', department: 'Business Administration', level: 'Master', duration: '2 Years', status: 'Active' },
  { name: 'PhD in Nursing', code: 'PHD-NUR', department: 'Nursing', level: 'Doctorate', duration: '3 Years', status: 'Inactive' },
  { name: 'Bachelor of Graphic Design', code: 'BGD', department: 'Arts & Design', level: 'Bachelor', duration: '4 Years', status: 'Inactive' },
]

export const programmeStats = {
  totalProgrammes: 50,
  activeProgrammes: 44,
  inactiveProgrammes: 6,
  departments: 12,
}

export function getProgrammesByDepartment(departmentName: string) {
  return programmes.filter(prog => prog.department === departmentName)
}

export const departmentFilterOptions = ['All', ...programmeDepartments]
export const levelFilterOptions = ['All', ...programmeLevels]
export const statusFilterOptions = ['All', 'Active', 'Inactive']
