/**
 * Generates entry-test result import Excel files under docs/.
 * Run: node scripts/generate-result-import-templates.mjs
 */
import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const headers = [
  'application_reference',
  'entry_test_score',
  'total_marks',
  'result_status',
  'remarks',
];

const readmeRows = [
  ['Entry test result import — column guide'],
  [],
  ['Sheet', 'RESULT — one row per applicant (required sheet name)'],
  [],
  ['Column', 'Required', 'Description'],
  [
    'application_reference',
    'Yes',
    'Applicant application reference from registration (must match intake)',
  ],
  [
    'entry_test_score',
    'Yes*',
    'Marks obtained in the entry test. *Or use percentage column instead of score + total_marks',
  ],
  [
    'total_marks',
    'Yes*',
    'Maximum marks for the entry test (same for all rows today; intake-level default may come later)',
  ],
  [
    'result_status',
    'Yes',
    'PASS or FAIL — only PASS rows are included in merit list generation',
  ],
  ['remarks', 'No', 'Optional note stored with the result'],
  [],
  ['Alternative', '', 'You may use percentage (0–100) instead of entry_test_score + total_marks'],
  [],
  [
    'Merit weighting',
    '',
    'NOT in this file. Configure merit formula separately (e.g. 10% entry test, 45% MATRIC, 45% FSC).',
  ],
  [],
  ['Prerequisites', '', 'Applicant must have verified PRESENT attendance marked Result Awaited'],
];

const sampleRows = [
  {
    application_reference: 'APP-2026-000001',
    entry_test_score: 157,
    total_marks: 200,
    result_status: 'PASS',
    remarks: 'Replace with real application_reference from your intake',
  },
  {
    application_reference: 'APP-2026-000002',
    entry_test_score: 84,
    total_marks: 200,
    result_status: 'FAIL',
    remarks: 'Below cutoff',
  },
  {
    application_reference: 'APP-2026-000003',
    entry_test_score: 183,
    total_marks: 200,
    result_status: 'PASS',
    remarks: '',
  },
];

function writeWorkbook(path, resultRows) {
  const wb = XLSX.utils.book_new();
  const resultSheet = XLSX.utils.json_to_sheet(resultRows, { header: headers });
  XLSX.utils.book_append_sheet(wb, resultSheet, 'RESULT');
  const readmeSheet = XLSX.utils.aoa_to_sheet(readmeRows);
  XLSX.utils.book_append_sheet(wb, readmeSheet, 'README');
  XLSX.writeFile(wb, path);
}

const docsDir = join(process.cwd(), 'docs');
writeWorkbook(join(docsDir, 'entry-test-result-import-template.xlsx'), []);
writeWorkbook(join(docsDir, 'entry-test-result-import-sample.xlsx'), sampleRows);

console.log('Wrote docs/entry-test-result-import-template.xlsx');
console.log('Wrote docs/entry-test-result-import-sample.xlsx');
