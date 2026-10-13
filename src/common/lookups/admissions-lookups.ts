import { AcademicDegreeType } from '../enums/application-completion.enum.js';
import { DegreeLevel } from '../enums/master-data.enum.js';

/**
 * Canonical programme degree levels for admin + applicant portals.
 * Always use `code` in APIs (create/update/filter responses).
 */
export const DEGREE_LEVEL_OPTIONS = [
  { code: DegreeLevel.Bachelor, label: 'Bachelor' },
  { code: DegreeLevel.Master, label: 'Master' },
  { code: DegreeLevel.Doctorate, label: 'Doctorate' },
] as const;

/**
 * Academic history codes an applicant can submit (not programme degree level).
 */
export const ACADEMIC_DEGREE_TYPE_OPTIONS = [
  { code: AcademicDegreeType.MATRIC, label: 'Matric / SSC' },
  { code: AcademicDegreeType.FSC, label: 'Intermediate / FSc / HSSC' },
  { code: AcademicDegreeType.BACHELOR, label: 'Bachelor' },
  { code: AcademicDegreeType.MASTER, label: 'Master' },
  { code: AcademicDegreeType.DOCTORATE, label: 'Doctorate / PhD' },
] as const;

export function lookupListResponse<T extends { code: string; label: string }>(
  items: readonly T[],
) {
  return {
    items: items.map((item) => ({ code: item.code, label: item.label })),
    meta: {
      page: 1,
      limit: items.length,
      total: items.length,
      totalPages: 1,
    },
  };
}
