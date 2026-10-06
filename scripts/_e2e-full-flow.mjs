import 'dotenv/config';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const BASE = 'http://localhost:3000/api/v1';
const tenantId = (process.env.DEFAULT_TENANT_ID || '').replace(/^["']|["']$/g, '');
const secret =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  'change-me-access-secret-min-32-chars';

const results = [];
function log(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`);
}

async function api(method, urlPath, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let bodyInit;
  if (formData) {
    bodyInit = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyInit = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${urlPath}`, { method, headers, body: bodyInit });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function mint(userId, email, roles = []) {
  return jwt.sign(
    { sub: userId, email, tenantId, type: 'oauth', roles },
    secret,
    { expiresIn: '2h' },
  );
}

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
});
await c.connect();

// --- Fix seed tenant mismatch ---
const seedTenant = '00000000-0000-4000-8000-000000000001';
await c.query(
  `update merit_formula_templates set tenant_id=$1 where tenant_id=$2`,
  [tenantId, seedTenant],
);
await c.query(
  `update merit_formula_template_components set tenant_id=$1 where tenant_id=$2`,
  [tenantId, seedTenant],
);
await c.query(
  `update academic_level_requirements set tenant_id=$1 where tenant_id=$2`,
  [tenantId, seedTenant],
);
log('Fix seed tenant_id for formulas/levels', true, tenantId);

const appId = '392d1d6e-afa3-46d8-a19c-a93fb709b870';
const app = (
  await c.query(
    `select a.*, i.id as intake_id from applications a join intakes i on i.id=a.intake_id where a.id=$1`,
    [appId],
  )
).rows[0];
const offering = (
  await c.query(
    `select apo.programme_offering_id, apo.preference_order, po.programme_id, p.code, p.degree_level
     from application_programme_options apo
     join programme_offerings po on po.id=apo.programme_offering_id
     join programmes p on p.id=po.programme_id
     where apo.applicant_id=$1 order by apo.preference_order`,
    [appId],
  )
).rows;
const primaryOfferingId = offering[0].programme_offering_id;
const programmeId = offering[0].programme_id;

// Ensure academics for bachelor formula
const academics = (
  await c.query(
    `select degree_type, percentage from application_academic_information where applicant_id=$1`,
    [appId],
  )
).rows;
log(
  'Applicant academics present',
  academics.length > 0,
  JSON.stringify(academics),
);
if (!academics.some((a) => a.degree_type === 'MATRIC')) {
  await c.query(
    `insert into application_academic_information
      (tenant_id, applicant_id, degree_type, qualification_name, board_or_institution, passing_year, division, grade, marks_or_gpa_obtained, marks_or_gpa_total, percentage)
     values ($1,$2,'MATRIC','Matric','BISE','2020','1st','A','900','1100',81.82)`,
    [tenantId, appId],
  );
}
if (!academics.some((a) => a.degree_type === 'FSC')) {
  await c.query(
    `insert into application_academic_information
      (tenant_id, applicant_id, degree_type, qualification_name, board_or_institution, passing_year, division, grade, marks_or_gpa_obtained, marks_or_gpa_total, percentage)
     values ($1,$2,'FSC','FSc Pre-Eng','BISE','2022','1st','A','950','1100',86.36)`,
    [tenantId, appId],
  );
}
log('Ensure MATRIC+FSC academics', true);

// Profile fields required for admit card
await c.query(
  `update applications
   set gender=coalesce(gender,'Male'),
       profile_photograph=coalesce(profile_photograph,'e2e/photo.jpg')
   where id=$1`,
  [appId],
);
const parent = await c.query(
  `select id from application_contacts
   where applicant_id=$1 and contact_type in ('PARENT','GUARDIAN') limit 1`,
  [appId],
);
if (!parent.rows[0]) {
  await c.query(
    `insert into application_contacts
      (tenant_id, applicant_id, contact_type, name, relationship, mobile_number)
     values ($1,$2,'PARENT','E2E Father','FATHER','+923001112233')`,
    [tenantId, appId],
  );
}
log('Ensure gender/photo/parent for admit card', true);

// Seat capacity required for merit
await c.query(
  `update programme_offerings set seat_capacity=2 where id=$1`,
  [primaryOfferingId],
);
log('Set seat_capacity=2 on primary offering', true, primaryOfferingId);

const session = (
  await c.query(
    `select s.id, c.id as centre_id from test_sessions s
     join test_centres c on c.id=s.test_centre_id
     where c.intake_session_id=$1 and s.status='PUBLISHED' limit 1`,
    [app.intake_id],
  )
).rows[0];
if (!session) throw new Error('No published test session for intake');
await c.query(
  `insert into test_session_programmes (tenant_id, test_session_id, programme_id)
   values ($1,$2,$3) on conflict do nothing`,
  [tenantId, session.id, programmeId],
);
// unique constraint may differ - check
try {
  await c.query(
    `insert into test_session_programmes (tenant_id, test_session_id, programme_id)
     select $1,$2,$3 where not exists (
       select 1 from test_session_programmes where test_session_id=$2 and programme_id=$3
     )`,
    [tenantId, session.id, programmeId],
  );
} catch {
  /* ignore */
}
log('Test session linked to programme', true, session.id);

const adminToken = mint(
  '00000000-0000-4000-8000-0000000000aa',
  'e2e-admin@admission.test',
  ['ADMISSIONS_ADMIN'],
);
const applicantToken = mint(app.iam_user_id, app.registered_email, ['APPLICANT']);

await c.end();

// --- Admin: resolve formula ---
{
  const r = await api('GET', `/admissions/offerings/${primaryOfferingId}/merit-formula`, {
    token: adminToken,
  });
  log(
    'Admin GET offering merit formula',
    r.status === 200 && r.json?.success,
    `status=${r.status} sources=${r.json?.data?.components?.map((x) => x.sourceType).join(',')}`,
  );
}

// --- Admin: generate admit card ---
{
  const r = await api(
    'POST',
    `/admissions/applications/${appId}/admit-card/generate`,
    { token: adminToken, body: {} },
  );
  const ok = r.status === 200 || r.status === 201 || r.status === 409;
  log(
    'Admin generate admit card',
    ok || r.json?.success,
    `status=${r.status} ${r.json?.message || r.json?.code || ''}`,
  );
}

// --- Admin: mark attendance (PRESENT + identity verified + result awaited) ---
{
  // Get admit card QR / attendance path
  const card = await api('GET', `/admissions/applications/${appId}/admit-card`, {
    token: adminToken,
  });
  log(
    'Admin get admit card',
    card.status === 200 && card.json?.success,
    `status=${card.status}`,
  );

  // Mark via attendance endpoint if available
  const mark = await api(
    'POST',
    `/admissions/applications/${appId}/attendance`,
    {
      token: adminToken,
      body: {
        attendanceStatus: 'PRESENT',
        identityVerified: true,
      },
    },
  );
  log(
    'Admin mark attendance PRESENT',
    mark.status === 200,
    `status=${mark.status} ${JSON.stringify(mark.json).slice(0, 220)}`,
  );
  const awaited = await api(
    'POST',
    `/admissions/applications/${appId}/result-awaited`,
    { token: adminToken, body: {} },
  );
  log(
    'Admin mark result-awaited',
    awaited.status === 200,
    `status=${awaited.status} ${JSON.stringify(awaited.json).slice(0, 180)}`,
  );
}

// If attendance API fails, ensure DB eligibility using admit card row
{
  const c2 = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await c2.connect();
  const card = await c2.query(
    `select id from application_admit_cards where applicant_id=$1 order by updated_at desc limit 1`,
    [appId],
  );
  if (card.rows[0]) {
    await c2.query(
      `insert into application_attendance
        (tenant_id, applicant_id, application_id, test_session_id, admit_card_id,
         attendance_status, identity_verified, result_awaited_at, marked_at, marked_by)
       values ($1,$2,$3,$4,$5,'PRESENT',true,now(),now(),$6)
       on conflict (tenant_id, applicant_id, test_session_id) do update set
         attendance_status='PRESENT',
         identity_verified=true,
         result_awaited_at=coalesce(application_attendance.result_awaited_at, now()),
         marked_at=now()`,
      [
        tenantId,
        appId,
        String(app.application_id),
        session.id,
        card.rows[0].id,
        '00000000-0000-4000-8000-0000000000aa',
      ],
    );
    log('DB ensure attendance PRESENT+awaited', true);
  } else {
    log('DB ensure attendance PRESENT+awaited', false, 'no admit card');
  }
  await c2.end();
}

// --- Build RESULT workbook and upload ---
const wbPath = path.join(process.cwd(), 'scripts', '_e2e-result.xlsx');
{
  const wb = XLSX.utils.book_new();
  const rows = [
    {
      application_reference: app.application_reference,
      percentage: 88.5,
      result_status: 'PASS',
      test_score: 177,
      total_marks: 200,
      remarks: 'E2E',
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, 'RESULT');
  XLSX.writeFile(wb, wbPath);
  log('Create RESULT workbook', true, wbPath);
}

let importId;
{
  const form = new FormData();
  form.append('testSessionId', session.id);
  const buf = fs.readFileSync(wbPath);
  form.append(
    'file',
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'e2e-result.xlsx',
  );
  const r = await api('POST', `/admissions/entry-test-results/import`, {
    token: adminToken,
    formData: form,
  });
  importId = r.json?.data?.id;
  log(
    'Admin upload result import',
    r.status === 201 && r.json?.data?.status === 'READY_TO_CONFIRM',
    `status=${r.status} importStatus=${r.json?.data?.status} invalid=${r.json?.data?.invalidRows} id=${importId}`,
  );
}

{
  const r = await api(
    'POST',
    `/admissions/entry-test-results/imports/${importId}/confirm`,
    { token: adminToken, body: { correctionReason: 'E2E confirm' } },
  );
  log(
    'Admin confirm import',
    r.status === 200 && (r.json?.data?.status === 'CONFIRMED' || r.json?.success),
    `status=${r.status} ${r.json?.data?.status || r.json?.message || ''}`,
  );
}

{
  const r = await api('POST', `/admissions/entry-test-results/publish`, {
    token: adminToken,
    body: { testSessionId: session.id },
  });
  log(
    'Admin publish results',
    r.status === 200 && r.json?.success !== false,
    `status=${r.status} published=${r.json?.data?.publishedCount}`,
  );
}

{
  const r = await api('GET', `/applicant/results`, { token: applicantToken });
  log(
    'Applicant view published results',
    r.status === 200 && Array.isArray(r.json?.data) && r.json.data.length > 0,
    `status=${r.status} count=${r.json?.data?.length}`,
  );
}

let meritListId;
{
  const r = await api('POST', `/admissions/merit-lists/generate`, {
    token: adminToken,
    body: {
      testSessionId: session.id,
      programmeOfferingId: primaryOfferingId,
    },
  });
  meritListId = r.json?.data?.id;
  const score = r.json?.data?.formulaSnapshot || r.json?.data?.formula_snapshot;
  log(
    'Admin generate merit list (weighted score)',
    r.status === 201 || r.status === 200,
    `status=${r.status} candidates=${r.json?.data?.candidateCount} meritListId=${meritListId} formula=${score ? 'yes' : 'no'} msg=${r.json?.message || ''}`,
  );
}

{
  const r = await api('GET', `/admissions/merit-lists/${meritListId}`, {
    token: adminToken,
  });
  const item = r.json?.data?.items?.[0];
  log(
    'Admin merit list details has merit_score',
    r.status === 200 && item?.merit_score != null,
    `status=${r.status} merit_score=${item?.merit_score} rank=${item?.merit_rank} breakdown=${item?.score_breakdown ? 'yes' : 'no'}`,
  );
}

{
  const r = await api('POST', `/admissions/merit-lists/${meritListId}/approve`, {
    token: adminToken,
    body: {},
  });
  log('Admin approve merit', r.status === 200, `status=${r.status}`);
}

{
  const r = await api('POST', `/admissions/merit-lists/${meritListId}/publish`, {
    token: adminToken,
    body: {},
  });
  log('Admin publish merit', r.status === 200, `status=${r.status}`);
}

let allocationId;
let allocationVersion;
{
  const r = await api('POST', `/admissions/allocations/preview`, {
    token: adminToken,
    body: { intakeSessionId: app.intake_id, testSessionId: session.id },
  });
  allocationId = r.json?.data?.allocationId;
  allocationVersion = r.json?.data?.allocationVersion;
  log(
    'Admin allocation preview',
    r.status === 201 || r.status === 200,
    `status=${r.status} selected=${r.json?.data?.selectedCount} waiting=${r.json?.data?.waitingCount} id=${allocationId}`,
  );
}

{
  const r = await api('POST', `/admissions/allocations/confirm`, {
    token: adminToken,
    body: { allocationId, allocationVersion },
    // header via fetch - need Idempotency-Key
  });
  // retry with header
}
{
  const res = await fetch(`${BASE}/admissions/allocations/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `e2e-${Date.now()}`,
    },
    body: JSON.stringify({ allocationId, allocationVersion }),
  });
  const json = await res.json();
  log(
    'Admin confirm allocation',
    res.status === 200 && (json?.data?.status === 'CONFIRMED' || json?.success),
    `status=${res.status} ${json?.data?.status || json?.message || ''}`,
  );
}

{
  const r = await api(
    'POST',
    `/admissions/applications/${appId}/offer/authorize`,
    {
      token: adminToken,
      body: {
        offerType: 'UNCONDITIONAL',
        offerLetterDocument: 'e2e-offer.pdf',
        feePaymentInstructions: 'Pay within deadline',
      },
    },
  );
  log(
    'Admin authorize offer',
    r.status === 201 || r.status === 200,
    `status=${r.status} ${r.json?.message || r.json?.data?.status || ''}`,
  );
}

{
  const r = await api(
    'POST',
    `/admissions/applications/${appId}/offer/publish`,
    { token: adminToken, body: {} },
  );
  log(
    'Admin publish offer',
    r.status === 200,
    `status=${r.status} ${r.json?.message || r.json?.data?.status || ''}`,
  );
}

{
  const r = await api('GET', `/applicant/offer`, { token: applicantToken });
  log(
    'Applicant view published offer',
    r.status === 200 && r.json?.success !== false,
    `status=${r.status} offerStatus=${r.json?.data?.status}`,
  );
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log('\n=== SUMMARY ===');
console.log(`PASS ${passed} / FAIL ${failed} / TOTAL ${results.length}`);
process.exit(failed ? 1 : 0);
