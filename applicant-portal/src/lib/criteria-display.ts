import type { ApplicantCriterion } from '@/lib/api/types'

const OPERATOR_LABELS: Record<string, string> = {
  EQUALS: 'exactly',
  GREATER_THAN: 'more than',
  GREATER_THAN_OR_EQUAL: 'at least',
  LESS_THAN: 'less than',
  LESS_THAN_OR_EQUAL: 'at most',
  REQUIRED: 'required',
  BETWEEN: 'between',
}

const UNIT_LABELS: Record<string, string> = {
  PERCENTAGE: '%',
  PERCENT: '%',
  MARKS: 'marks',
  GPA: 'GPA',
  CGPA: 'CGPA',
  YEARS: 'years',
  YEAR: 'years',
}

function looksLikeProse(value: string) {
  return /[a-zA-Z]{3,}/.test(value) && /[\s,]/.test(value)
}

/** Applicant-facing criterion body — never show raw enum tokens. */
export function formatCriterionDescription(item: ApplicantCriterion): string | null {
  const requirement = item.criteriaRequirement?.trim() ?? ''
  if (requirement && looksLikeProse(requirement)) {
    return requirement
  }

  const operator = item.criteriaOperator?.trim().toUpperCase() ?? ''
  const unit = item.criteriaUnit?.trim().toUpperCase() ?? ''
  const operatorLabel = OPERATOR_LABELS[operator]
  const unitLabel = UNIT_LABELS[unit] ?? (unit ? unit.toLowerCase().replace(/_/g, ' ') : '')

  if (operator === 'REQUIRED') {
    return 'This requirement must be met.'
  }

  if (requirement && operatorLabel) {
    if (unitLabel === '%') return `${operatorLabel} ${requirement}%`
    if (unitLabel) return `${operatorLabel} ${requirement} ${unitLabel}`
    return `${operatorLabel} ${requirement}`
  }

  return requirement || null
}
