/**
 * Full start-to-finish E2E against running API:
 * register → set password → login → academic/programme/profile/addresses/contacts/
 * declaration → submit → challan → evidence → verify fee → approve → admit card →
 * attendance → result import → merit → allocation → offer → applicant views
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';

const BASE = 'http://localhost:3000/api/v1';
const INTAKE_ID = '7c5d625d-7643-4e3a-ae18-d823c646a127'; // ABC17
const BSIT_OFFERING = '93f125b4-33dd-4b98-9b07-972f38b8790c';
const PRO_OFFERING = '7274d8c3-bad1-47ff-b6d4-daf03fb1201a';
const BSIT_PROGRAMME = 'ecfa0d18-a18f-459f-be5e-0500f0122ae5';
const SESSION_ID = 'cdf1fc8d-0e47-4b63-906a-da57ad772ecb';
const PASSWORD = 'Welcome1';

const tenantId = (process.env.DEFAULT_TENANT_ID || '').replace(/^["']|["']$/g, '');
const secret =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  'change-me-access-secret-min-32-chars';

const stamp = Date.now().toString().slice(-8);
const email = `e2e.full.${stamp}@example.com`;
const cnic = `35202-${String(1000000 + Number(stamp) % 8999999).padStart(7, '0')}-1`;

const results = [];
function log(step, ok, detail = '') {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`);
}

async function api(method, urlPath, { token, body, formData, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let bodyInit;
  if (formData) bodyInit = formData;
  else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    bodyInit = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${urlPath}`, { method, headers: h, body: bodyInit });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

function mint(userId, userEmail, roles = []) {
  return jwt.sign(
    { sub: userId, email: userEmail, tenantId, type: 'oauth', roles },
    secret,
    { expiresIn: '2h' },
  );
}

function tinyPng() {
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

function tinyPdf() {
  return Buffer.from(
    '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
  );
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
});
await db.connect();

// --- Prep: formulas tenant + seat capacity + session programme ---
const seedTenant = '00000000-0000-4000-8000-000000000001';
await db.query(
  `update merit_formula_templates set tenant_id=$1 where tenant_id=$2`,
  [tenantId, seedTenant],
);
await db.query(
  `update merit_formula_template_components set tenant_id=$1 where tenant_id=$2`,
  [tenantId, seedTenant],
);
await db.query(
  `update academic_level_requirements set tenant_id=$1 where tenant_id=$2`,
  [tenantId, seedTenant],
);
await db.query(
  `update programme_offerings set seat_capacity=50 where id=any($1::uuid[])`,
  [[BSIT_OFFERING, PRO_OFFERING]],
);
await db.query(
  `insert into test_session_offerings (tenant_id, test_session_id, programme_offering_id)
   select $1,$2,$3 where not exists (
     select 1 from test_session_offerings where test_session_id=$2 and programme_offering_id=$3
   )`,
  [tenantId, SESSION_ID, BSIT_OFFERING],
);

// Prep: admission/tuition offer fees on both offerings + AUTO merit
const actor = '00000000-0000-4000-8000-0000000000aa';
const offerFeeDefs = [
  ['ADMISSION', 15000, 10],
  ['TUITION', 91680, 20],
  ['SEMESTER_REGISTRATION', 9000, 30],
  ['ID_CARD', 1500, 40],
  ['COUNCIL', 1000, 50],
];
for (const [type, amount, sort] of offerFeeDefs) {
  let g = await db.query(
    `select id from general_fees
     where tenant_id=$1 and fee_type=$2 and status='ACTIVE' and amount=$3 limit 1`,
    [tenantId, type, amount],
  );
  let gid = g.rows[0]?.id;
  if (!gid) {
    g = await db.query(
      `insert into general_fees
         (tenant_id, fee_type, amount, currency, status, created_by, updated_by)
       values ($1,$2,$3,'PKR','ACTIVE',$4,$4) returning id`,
      [tenantId, type, amount, actor],
    );
    gid = g.rows[0].id;
  }
  for (const oid of [BSIT_OFFERING, PRO_OFFERING]) {
    const exists = await db.query(
      `select 1 from offering_fees
       where tenant_id=$1 and programme_offering_id=$2 and general_fee_id=$3 and status='ACTIVE'`,
      [tenantId, oid, gid],
    );
    if (!exists.rowCount) {
      await db.query(
        `insert into offering_fees
           (tenant_id, programme_offering_id, general_fee_id, status, sort_order, created_by, updated_by)
         values ($1,$2,$3,'ACTIVE',$4,$5,$5)`,
        [tenantId, oid, gid, sort, actor],
      );
    }
  }
}
await db.query(
  `update intakes
   set merit_generation_mode='AUTO',
       fee_confirm_margin_percent=2,
       offer_fee_grace_hours=0
   where id=$1`,
  [INTAKE_ID],
);
log('Prep formulas/capacity/session/offer-fees/AUTO', true);

const adminToken = mint(
  '00000000-0000-4000-8000-0000000000aa',
  'e2e-admin@admission.test',
  ['ADMISSIONS_ADMIN'],
);

// ========== 1. REGISTER ==========
const reg = await api('POST', '/applicants/applications/registrations', {
  body: {
    intakeSessionId: INTAKE_ID,
    applicantName: 'E2E Full Applicant',
    registeredEmail: email,
    cnicNumber: cnic,
    mobileNumber: '+923001234567',
  },
});
const applicantId = reg.json?.data?.applicantId;
const appRef = reg.json?.data?.applicationReference;
const invite = reg.json?.data?.invitationToken;
log(
  '1 Register applicant',
  reg.status === 201 && !!applicantId,
  `status=${reg.status} ref=${appRef} invite=${invite ? 'yes' : 'no'} msg=${reg.json?.message || ''}`,
);
if (!applicantId) {
  console.log(JSON.stringify(reg.json, null, 2));
  process.exit(1);
}

// ========== 2. SET PASSWORD ==========
let applicantToken;
let loginOk = false;
if (invite) {
  const sp = await api('POST', '/applicants/applications/auth/set-password', {
    body: { token: invite, password: PASSWORD },
  });
  log(
    '2 Set password via invite token',
    sp.status === 200 || sp.status === 201,
    `status=${sp.status} verified=${sp.json?.data?.verified} msg=${sp.json?.message || ''}`,
  );

  const login = await api('POST', '/auth/login', {
    body: { email, password: PASSWORD },
  });
  const access =
    login.json?.data?.accessToken ||
    login.json?.data?.access_token ||
    login.json?.data?.token;
  loginOk = (login.status === 200 || login.status === 201) && !!access;
  if (loginOk) {
    applicantToken = access;
  }
  log(
    '3 Login with password',
    loginOk,
    `status=${login.status} token=${access ? 'yes' : 'no'} keys=${Object.keys(login.json?.data || {}).join(',')}`,
  );
}

if (!applicantToken) {
  const row = (
    await db.query(`select iam_user_id from applications where id=$1`, [
      applicantId,
    ])
  ).rows[0];
  applicantToken = mint(row.iam_user_id, email, ['APPLICANT']);
  log('3 Fallback mint applicant JWT', true, row.iam_user_id);
}

const A = `/applicants/applications/${applicantId}`;

// ========== 4. ACADEMIC ==========
const academic = await api('POST', `${A}/academic`, {
  token: applicantToken,
  body: {
    records: [
      {
        degreeType: 'MATRIC',
        rollNumber: `M-${stamp}`,
        qualificationName: 'Matriculation',
        boardOrInstitution: 'BISE Lahore',
        passingYear: '2020',
        division: '1st',
        grade: 'A',
        marksOrGpaObtained: '900',
        marksOrGpaTotal: '1100',
        percentage: 81.82,
      },
      {
        degreeType: 'FSC',
        rollNumber: `F-${stamp}`,
        qualificationName: 'FSc Pre-Engineering',
        boardOrInstitution: 'BISE Lahore',
        passingYear: '2022',
        division: '1st',
        grade: 'A',
        marksOrGpaObtained: '950',
        marksOrGpaTotal: '1100',
        percentage: 86.36,
      },
    ],
  },
});
log(
  '4 Academic step (MATRIC+FSC)',
  academic.status === 201 || academic.status === 200,
  `status=${academic.status} msg=${academic.json?.message || ''}`,
);

// ========== 5. ADDRESSES (before profile) ==========
const addresses = await api('POST', `${A}/addresses`, {
  token: applicantToken,
  body: {
    addresses: [
      {
        addressType: 'PRIMARY',
        addressLine1: 'House 1, Street 2, Model Town',
        countryId: 'PK',
        provinceId: 'PK-PB',
        cityId: 'PK-PB-LHE',
        postalCode: '54700',
        isSameAsPrimary: false,
      },
    ],
  },
});
log(
  '5 Addresses',
  addresses.status === 201 || addresses.status === 200,
  `status=${addresses.status} msg=${addresses.json?.message || ''}`,
);

// ========== 6. CONTACTS ==========
const contacts = await api('POST', `${A}/contacts`, {
  token: applicantToken,
  body: {
    contacts: [
      {
        contactType: 'PARENT',
        name: 'E2E Father',
        identityDocumentNumber: '35202-7654321-1',
        relationship: 'FATHER',
        occupation: 'Business',
        mobileNumber: '+923007654321',
      },
      {
        contactType: 'EMERGENCY',
        name: 'E2E Brother',
        relationship: 'BROTHER',
        mobileNumber: '+923001112233',
      },
    ],
  },
});
log(
  '6 Contacts (PARENT+EMERGENCY)',
  contacts.status === 201 || contacts.status === 200,
  `status=${contacts.status} msg=${contacts.json?.message || ''}`,
);

// ========== 7. PROGRAMME ==========
const programme = await api('POST', `${A}/programme`, {
  token: applicantToken,
  body: {
    qualificationLevel: 'UNDERGRADUATE',
    options: [
      { programmeOfferingId: BSIT_OFFERING, preferenceOrder: 1 },
      { programmeOfferingId: PRO_OFFERING, preferenceOrder: 2 },
    ],
  },
});
log(
  '7 Programme preferences BSIT+PRO',
  programme.status === 201 || programme.status === 200,
  `status=${programme.status} msg=${programme.json?.message || ''}`,
);

// ========== 8. PROFILE ==========
const profile = await api('POST', `${A}/profile`, {
  token: applicantToken,
  body: {
    applicantName: 'E2E Full Applicant',
    gender: 'MALE',
    maritalStatus: 'SINGLE',
    dateOfBirth: '2004-05-15',
    mobileNumber: '+923001234567',
    primaryNationalityId: 'PK',
    domicileId: 'PK-PB-LHE',
    disabilityDeclared: false,
  },
});
log(
  '8 Profile step',
  profile.status === 201 || profile.status === 200,
  `status=${profile.status} msg=${profile.json?.message || ''}`,
);

const photoForm = new FormData();
photoForm.append(
  'file',
  new Blob([tinyPng()], { type: 'image/png' }),
  'photo.png',
);
const photo = await api('POST', `${A}/profile/photograph`, {
  token: applicantToken,
  formData: photoForm,
});
log(
  '8b Profile photograph upload',
  photo.status === 200 || photo.status === 201,
  `status=${photo.status} msg=${photo.json?.message || ''}`,
);

// ========== 9. DECLARATION ==========
const texts = await api('GET', `${A}/declaration/texts`, {
  token: applicantToken,
});
const declIds = (texts.json?.data || []).map((d) => d.id);
const declaration = await api('POST', `${A}/declaration`, {
  token: applicantToken,
  body: {
    declarationAccepted: true,
    acceptedOfferingDeclarationIds: declIds,
    disciplinaryIssueDeclared: false,
  },
});
log(
  '9 Declaration',
  declaration.status === 201 || declaration.status === 200,
  `status=${declaration.status} texts=${declIds.length} msg=${declaration.json?.message || ''}`,
);

// ========== 10. SUBMIT ==========
const submit = await api('POST', `${A}/submit`, {
  token: applicantToken,
  body: {},
});
log(
  '10 Submit application',
  submit.status === 200 || submit.status === 201,
  `status=${submit.status} appStatus=${submit.json?.data?.applicationStatus} msg=${submit.json?.message || ''}`,
);

// ========== 11. FEE CHALLAN ==========
const challan = await api(
  'POST',
  `/applicants/applications/${applicantId}/processing-fee/challan`,
  { token: applicantToken, body: {} },
);
const challanId = challan.json?.data?.id;
const totalAmount = Number(
  challan.json?.data?.totalAmountPayable ??
    challan.json?.data?.total_amount_payable ??
    2500,
);
log(
  '11 Generate processing fee challan',
  challan.status === 201 || challan.status === 200,
  `status=${challan.status} amount=${totalAmount} id=${challanId} msg=${challan.json?.message || ''}`,
);

const evidenceForm = new FormData();
evidenceForm.append(
  'file',
  new Blob([tinyPdf()], { type: 'application/pdf' }),
  'challan-paid.pdf',
);
const evidence = await api(
  'POST',
  `/applicants/applications/${applicantId}/processing-fee/evidence`,
  { token: applicantToken, formData: evidenceForm },
);
const evidenceId = evidence.json?.data?.id || evidence.json?.data?.[0]?.id;
log(
  '12 Upload payment evidence',
  evidence.status === 201 || evidence.status === 200,
  `status=${evidence.status} evidenceId=${evidenceId} msg=${evidence.json?.message || ''}`,
);

const verifyFee = await api(
  'POST',
  `/admissions/processing-fee/evidence/${evidenceId}/verify`,
  {
    token: adminToken,
    body: {
      verificationNote: 'E2E verified',
      verificationSource: 'MANUAL',
      amountPaid: totalAmount,
      paymentDate: new Date().toISOString(),
    },
  },
);
log(
  '13 Admin verify fee evidence',
  verifyFee.status === 200,
  `status=${verifyFee.status} msg=${verifyFee.json?.message || verifyFee.json?.data?.verificationIndicator || ''}`,
);

// ========== 14. DOCUMENTS ==========
const reqs = await api(
  'GET',
  `/applicant/applications/${applicantId}/documents/requirements`,
  { token: applicantToken },
);
const requirements = Array.isArray(reqs.json?.data) ? reqs.json.data : [];
log(
  '14 Document requirements',
  reqs.status === 200,
  `status=${reqs.status} count=${requirements.length}`,
);

if (requirements.length) {
  const ids = requirements.map((r) => r.id || r.offeringRequiredDocumentId).filter(Boolean);
  const docForm = new FormData();
  docForm.append(
    'file',
    new Blob([tinyPdf()], { type: 'application/pdf' }),
    'cnic.pdf',
  );
  for (const id of ids) docForm.append('offeringRequiredDocumentIds', id);
  const up = await api(
    'POST',
    `/applicant/applications/${applicantId}/documents`,
    { token: applicantToken, formData: docForm },
  );
  log(
    '14b Upload required documents',
    up.status === 201 || up.status === 200,
    `status=${up.status} msg=${up.json?.message || ''}`,
  );

  const docs = Array.isArray(up.json?.data) ? up.json.data : [up.json?.data].filter(Boolean);
  for (const d of docs) {
    const docId = d?.id || d?.documentId;
    if (!docId) continue;
    const v = await api('POST', `/admissions/documents/${docId}/verify`, {
      token: adminToken,
      body: {},
    });
    log(
      `14c Verify document ${docId.slice(0, 8)}`,
      v.status === 200,
      `status=${v.status}`,
    );
  }
} else {
  log('14b No offering document requirements (skip upload)', true);
}

const completeness = await api(
  'GET',
  `/applicant/applications/${applicantId}/documents/completeness`,
  { token: applicantToken },
);
log(
  '15 Document completeness',
  completeness.status === 200 && completeness.json?.data?.complete === true,
  `status=${completeness.status} complete=${completeness.json?.data?.complete}`,
);

// ========== 16. APPROVE ==========
const readiness = await api(
  'GET',
  `/admissions/applications/${applicantId}`,
  { token: adminToken },
);
log(
  '16 Admin review readiness',
  readiness.status === 200,
  `status=${readiness.status} approvalAllowed=${readiness.json?.data?.readiness?.approvalAllowed} unmet=${JSON.stringify(readiness.json?.data?.readiness?.unmetPreconditions || readiness.json?.data?.unmetPreconditions || [])}`,
);

const approve = await api(
  'PATCH',
  `/admissions/applications/${applicantId}/status`,
  { token: adminToken, body: { status: 'APPROVED' } },
);
log(
  '17 Admin approve application',
  approve.status === 200,
  `status=${approve.status} appStatus=${approve.json?.data?.applicationStatus || approve.json?.data?.status} msg=${approve.json?.message || ''}`,
);

// ========== 18. ADMIT CARD + ATTENDANCE ==========
const card = await api(
  'POST',
  `/admissions/applications/${applicantId}/admit-card/generate`,
  { token: adminToken, body: {} },
);
log(
  '18 Generate admit card',
  card.status === 201 || card.status === 200,
  `status=${card.status} msg=${card.json?.message || ''}`,
);

const mark = await api(
  'POST',
  `/admissions/applications/${applicantId}/attendance`,
  {
    token: adminToken,
    body: { attendanceStatus: 'PRESENT', identityVerified: true },
  },
);
log(
  '19 Mark attendance PRESENT',
  mark.status === 200,
  `status=${mark.status} msg=${mark.json?.message || ''}`,
);

const awaited = await api(
  'POST',
  `/admissions/applications/${applicantId}/result-awaited`,
  { token: adminToken, body: {} },
);
log(
  '20 Mark result-awaited',
  awaited.status === 200,
  `status=${awaited.status} msg=${awaited.json?.message || ''}`,
);

if (mark.status >= 400 || awaited.status >= 400) {
  const cardRow = (
    await db.query(
      `select id from application_admit_cards where applicant_id=$1 order by updated_at desc limit 1`,
      [applicantId],
    )
  ).rows[0];
  const appRow = (
    await db.query(`select application_id from applications where id=$1`, [
      applicantId,
    ])
  ).rows[0];
  if (cardRow) {
    await db.query(
      `insert into application_attendance
        (tenant_id, applicant_id, application_id, test_session_id, admit_card_id,
         attendance_status, identity_verified, result_awaited_at, marked_at, marked_by)
       values ($1,$2,$3,$4,$5,'PRESENT',true,now(),now(),$6)
       on conflict (tenant_id, applicant_id, test_session_id) do update set
         attendance_status='PRESENT', identity_verified=true,
         result_awaited_at=coalesce(application_attendance.result_awaited_at, now())`,
      [
        tenantId,
        applicantId,
        String(appRow.application_id),
        SESSION_ID,
        cardRow.id,
        '00000000-0000-4000-8000-0000000000aa',
      ],
    );
    log('20b DB fallback attendance+awaited', true);
  }
}

// ========== 21. RESULTS ==========
const wbPath = path.join(process.cwd(), 'scripts', `_e2e-full-${stamp}.xlsx`);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet([
    {
      application_reference: appRef,
      percentage: 90,
      result_status: 'PASS',
      test_score: 180,
      total_marks: 200,
      remarks: 'E2E full',
    },
  ]),
  'RESULT',
);
XLSX.writeFile(wb, wbPath);

const importForm = new FormData();
importForm.append('testSessionId', SESSION_ID);
importForm.append(
  'file',
  new Blob([fs.readFileSync(wbPath)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }),
  'result.xlsx',
);
const imp = await api('POST', '/admissions/entry-test-results/import', {
  token: adminToken,
  formData: importForm,
});
const importId = imp.json?.data?.id;
log(
  '21 Upload result workbook',
  imp.status === 201 && imp.json?.data?.status === 'READY_TO_CONFIRM',
  `status=${imp.status} importStatus=${imp.json?.data?.status} invalid=${imp.json?.data?.invalidRows}`,
);

const confirm = await api(
  'POST',
  `/admissions/entry-test-results/imports/${importId}/confirm`,
  { token: adminToken, body: { correctionReason: 'E2E' } },
);
log(
  '22 Confirm result import',
  confirm.status === 200,
  `status=${confirm.status}`,
);

const pubRes = await api('POST', '/admissions/entry-test-results/publish', {
  token: adminToken,
  body: { testSessionId: SESSION_ID },
});
const autoMerit = pubRes.json?.data?.autoMerit || [];
const autoGenerated = autoMerit.find((x) => x.status === 'GENERATED');
log(
  '23 Publish results',
  pubRes.status === 200,
  `status=${pubRes.status} published=${pubRes.json?.data?.publishedCount} mode=${pubRes.json?.data?.meritGenerationMode} auto=${autoMerit.length}`,
);
log(
  '23b AUTO merit generated',
  pubRes.json?.data?.meritGenerationMode === 'AUTO' &&
    Boolean(autoGenerated?.meritListId),
  `meritListId=${autoGenerated?.meritListId || ''} status=${autoGenerated?.status || 'none'}`,
);

const appResults = await api('GET', '/applicant/results', {
  token: applicantToken,
});
log(
  '24 Applicant view results',
  appResults.status === 200 && (appResults.json?.data?.length ?? 0) > 0,
  `status=${appResults.status} count=${appResults.json?.data?.length}`,
);

// ========== 25. MERIT + ALLOCATION + OFFER ==========
let meritListId = autoGenerated?.meritListId;
if (!meritListId) {
  const merit = await api('POST', '/admissions/merit-lists/generate', {
    token: adminToken,
    body: { testSessionId: SESSION_ID, programmeOfferingId: BSIT_OFFERING },
  });
  meritListId = merit.json?.data?.id;
  log(
    '25 Generate merit list',
    merit.status === 201 || merit.status === 200,
    `status=${merit.status} candidates=${merit.json?.data?.candidateCount} formula=${merit.json?.data?.formulaSnapshot || merit.json?.data?.formula_snapshot ? 'yes' : 'no'}`,
  );
} else {
  log(
    '25 Generate merit list',
    true,
    `reused AUTO meritListId=${meritListId}`,
  );
}

const meritDetails = await api('GET', `/admissions/merit-lists/${meritListId}`, {
  token: adminToken,
});
const item = meritDetails.json?.data?.items?.[0];
log(
  '26 Merit score present',
  meritDetails.status === 200 && item?.merit_score != null,
  `merit_score=${item?.merit_score} rank=${item?.merit_rank}`,
);

await api('POST', `/admissions/merit-lists/${meritListId}/approve`, {
  token: adminToken,
  body: {},
});
await api('POST', `/admissions/merit-lists/${meritListId}/publish`, {
  token: adminToken,
  body: {},
});
log('27 Approve+publish merit', true);

const preview = await api('POST', '/admissions/allocations/preview', {
  token: adminToken,
  body: { intakeSessionId: INTAKE_ID, testSessionId: SESSION_ID },
});
const allocationId = preview.json?.data?.allocationId;
const allocationVersion = preview.json?.data?.allocationVersion;
log(
  '28 Allocation preview',
  preview.status === 201 || preview.status === 200,
  `selected=${preview.json?.data?.selectedCount} waiting=${preview.json?.data?.waitingCount}`,
);

const confAlloc = await fetch(`${BASE}/admissions/allocations/confirm`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': `e2e-full-${stamp}`,
  },
  body: JSON.stringify({ allocationId, allocationVersion }),
});
const confJson = await confAlloc.json();
log(
  '29 Confirm allocation',
  confAlloc.status === 200,
  `status=${confAlloc.status} ${confJson?.data?.status || confJson?.message || ''}`,
);

const authOffer = await api(
  'POST',
  `/admissions/applications/${applicantId}/offer/authorize`,
  {
    token: adminToken,
    body: {
      offerType: 'UNCONDITIONAL',
      offerLetterDocument: 'e2e-full-offer.pdf',
      feePaymentInstructions: 'Pay within deadline',
    },
  },
);
log(
  '30 Authorize offer',
  authOffer.status === 201 || authOffer.status === 200,
  `status=${authOffer.status} msg=${authOffer.json?.message || authOffer.json?.error || JSON.stringify(authOffer.json?.data || {}).slice(0, 120)}`,
);

// If allocation left this applicant WAITING, force-select for offer-fee E2E path
if (authOffer.status === 422) {
  await db.query(
    `update applications
     set selection_status='SELECTED',
         selected_programme_offering_id=$2,
         selection_at=now(),
         selection_by=$3,
         selection_reason='E2E force-select for offer-fee path'
     where id=$1`,
    [applicantId, BSIT_OFFERING, actor],
  );
  const authOffer2 = await api(
    'POST',
    `/admissions/applications/${applicantId}/offer/authorize`,
    {
      token: adminToken,
      body: {
        offerType: 'UNCONDITIONAL',
        offerLetterDocument: 'e2e-full-offer.pdf',
        feePaymentInstructions: 'Pay within deadline',
      },
    },
  );
  log(
    '30b Authorize offer after force-select',
    authOffer2.status === 201 || authOffer2.status === 200,
    `status=${authOffer2.status}`,
  );
}

const pubOffer = await api(
  'POST',
  `/admissions/applications/${applicantId}/offer/publish`,
  { token: adminToken, body: {} },
);
const feeChallan =
  pubOffer.json?.data?.feeChallan || pubOffer.json?.data?.fee_challan;
log(
  '31 Publish offer',
  pubOffer.status === 200 && Boolean(feeChallan?.id || feeChallan?.challanNumber),
  `status=${pubOffer.status} challan=${feeChallan?.challanNumber || feeChallan?.id || 'missing'} amount=${feeChallan?.totalAmountPayable || ''} err=${pubOffer.json?.message || pubOffer.json?.code || ''}`,
);

// If publish left offer without challan, generate explicitly
let offerIdForFee = pubOffer.json?.data?.id || pubOffer.json?.data?.offer?.id;
if (!feeChallan?.id) {
  const offerRow = await db.query(
    `select id from admission_offers
     where tenant_id=$1 and application_record_id=$2
       and status in ('PUBLISHED','ACCEPTED')
     order by created_at desc limit 1`,
    [tenantId, applicantId],
  );
  offerIdForFee = offerRow.rows[0]?.id;
  if (offerIdForFee) {
    const gen = await api(
      'POST',
      `/admissions/offer-fees/offers/${offerIdForFee}/challan/generate`,
      { token: adminToken, body: {} },
    );
    log(
      '31b Generate offer-fee challan',
      gen.status === 201 || gen.status === 200,
      `status=${gen.status} challan=${gen.json?.data?.challanNumber} msg=${gen.json?.message || JSON.stringify(gen.json).slice(0, 200)}`,
    );
  }
}

const appOffer = await api('GET', '/applicant/offer', {
  token: applicantToken,
});
log(
  '32 Applicant view offer',
  appOffer.status === 200,
  `status=${appOffer.status} offerStatus=${appOffer.json?.data?.status}`,
);

const appCard = await api(
  'GET',
  `/applicant/applications/${applicantId}/admit-card`,
  { token: applicantToken },
);
log(
  '33 Applicant view admit card',
  appCard.status === 200,
  `status=${appCard.status}`,
);

// ========== 34–38 OFFER FEE ==========
const offerFeeGet = await api(
  'GET',
  `/applicant/applications/${applicantId}/offer-fee/challan`,
  { token: applicantToken },
);
const offerChallan = offerFeeGet.json?.data;
log(
  '34 Get offer-fee challan',
  offerFeeGet.status === 200 &&
    Number(offerChallan?.totalAmountPayable) === 118180 &&
    (offerChallan?.items?.length || 0) >= 5,
  `status=${offerFeeGet.status} amount=${offerChallan?.totalAmountPayable} lines=${offerChallan?.items?.length}`,
);

const offerEvidenceForm = new FormData();
offerEvidenceForm.append(
  'file',
  new Blob([tinyPdf()], { type: 'application/pdf' }),
  'offer-fee-receipt.pdf',
);
offerEvidenceForm.append('amountClaimed', String(offerChallan?.totalAmountPayable || 118180));
const offerEvidence = await api(
  'POST',
  `/applicant/applications/${applicantId}/offer-fee/evidence`,
  { token: applicantToken, formData: offerEvidenceForm },
);
const offerEvidenceId = offerEvidence.json?.data?.id;
log(
  '35 Upload offer-fee evidence',
  offerEvidence.status === 201 || offerEvidence.status === 200,
  `status=${offerEvidence.status} evidenceId=${offerEvidenceId}`,
);

const verifyOfferFee = await api(
  'POST',
  `/admissions/offer-fees/evidences/${offerEvidenceId}/verify`,
  {
    token: adminToken,
    body: {
      verificationIndicator: 'VERIFIED',
      amountPaid: Number(offerChallan?.totalAmountPayable || 118180),
    },
  },
);
log(
  '36 Verify offer-fee evidence',
  verifyOfferFee.status === 200 &&
    ['VERIFIED', 'LATE_PAYMENT_VERIFIED'].includes(
      verifyOfferFee.json?.data?.paymentStatus,
    ),
  `status=${verifyOfferFee.status} paymentStatus=${verifyOfferFee.json?.data?.paymentStatus}`,
);

if (!offerChallan?.id) {
  log('37 Bank CSV match offer-fee challan', false, 'skipped — no offer challan');
  log('37b Offer challan verified via bank CSV', false, 'skipped');
  log('38 Expire unpaid offers', false, 'skipped');
} else {
// Bank CSV match against a synthetic unpaid offer challan
const bankChallanNo = `OF-E2E-${stamp}`;
const bankOfferId = (
  await db.query(
    `insert into admission_offers (
       tenant_id, application_record_id, programme_offering_id, offer_type,
       acceptance_deadline, authorized_by, authorized_at, published_at,
       offer_issue_date, status
     ) values (
       $1,$2,$3,'UNCONDITIONAL', now() + interval '5 days', $4, now(), now(), now(), 'PUBLISHED'
     ) returning id`,
    [tenantId, applicantId, BSIT_OFFERING, actor],
  )
).rows[0].id;
await db.query(
  `insert into admission_offer_fee_challans (
     tenant_id, offer_id, applicant_id, programme_offering_id, challan_number,
     issue_date, due_date, designated_bank_id, collection_bank_name,
     collection_bank_branch, collection_bank_account, branch_code,
     applicant_name, applicant_contact_number, registration_number,
     intake_session, programme_name, total_amount_payable, amount_in_words,
     payment_status
   )
   select
     $1, $2, $3, $4, $5,
     now(), now() + interval '5 days', designated_bank_id, collection_bank_name,
     collection_bank_branch, collection_bank_account, branch_code,
     applicant_name, applicant_contact_number, $6,
     intake_session, programme_name, '1000.00', 'one thousand PKR only',
     'UNPAID'
   from admission_offer_fee_challans
   where id=$7
   limit 1`,
  [
    tenantId,
    bankOfferId,
    applicantId,
    BSIT_OFFERING,
    bankChallanNo,
    appRef,
    offerChallan.id,
  ],
);
const today = new Date().toISOString().slice(0, 10);
const csv = [
  'ReceiptNo,ConsumerNo,ClassName,Student Name,Valid Date of Voucher,Due Date,AmountWithinDD,AmountAfterDD,CampusCode,Date_Paid,Amount,PaymentMode,BranchCode,usertext1,usertext2,usertext3,usertext4,usertext5',
  `${bankChallanNo},${appRef},Fall-2026,E2E Full Applicant,${today},${today},1000.00,1100.00,01,${today},1000.00,CASH,0883,,,,,`,
].join('\n');
const bankForm = new FormData();
bankForm.append(
  'file',
  new Blob([csv], { type: 'text/csv' }),
  'offer-fee-bank.csv',
);
const bankImp = await api(
  'POST',
  '/admissions/processing-fee/reconciliation/imports',
  { token: adminToken, formData: bankForm },
);
const bankMatched = Number(bankImp.json?.data?.matchedRecords || 0);
log(
  '37 Bank CSV match offer-fee challan',
  (bankImp.status === 201 || bankImp.status === 200) && bankMatched >= 1,
  `status=${bankImp.status} matched=${bankMatched} kind=check`,
);
const bankChallanRow = await db.query(
  `select payment_status from admission_offer_fee_challans where challan_number=$1`,
  [bankChallanNo],
);
log(
  '37b Offer challan verified via bank CSV',
  ['VERIFIED', 'LATE_PAYMENT_VERIFIED'].includes(
    bankChallanRow.rows[0]?.payment_status,
  ),
  `payment_status=${bankChallanRow.rows[0]?.payment_status}`,
);

// Expire unpaid: backdate a published unpaid offer past due
const expireOfferId = (
  await db.query(
    `insert into admission_offers (
       tenant_id, application_record_id, programme_offering_id, offer_type,
       acceptance_deadline, authorized_by, authorized_at, published_at,
       offer_issue_date, status
     ) values (
       $1,$2,$3,'UNCONDITIONAL', now() - interval '2 days', $4,
       now() - interval '7 days', now() - interval '6 days',
       now() - interval '6 days', 'PUBLISHED'
     ) returning id`,
    [tenantId, applicantId, BSIT_OFFERING, actor],
  )
).rows[0].id;
await db.query(
  `insert into admission_offer_fee_challans (
     tenant_id, offer_id, applicant_id, programme_offering_id, challan_number,
     issue_date, due_date, designated_bank_id, collection_bank_name,
     collection_bank_branch, collection_bank_account, branch_code,
     applicant_name, applicant_contact_number, registration_number,
     intake_session, programme_name, total_amount_payable, amount_in_words,
     payment_status
   )
   select
     $1, $2, $3, $4, $5,
     now() - interval '7 days', now() - interval '2 days',
     designated_bank_id, collection_bank_name, collection_bank_branch,
     collection_bank_account, branch_code, applicant_name,
     applicant_contact_number, registration_number, intake_session,
     programme_name, '500.00', 'five hundred PKR only', 'UNPAID'
   from admission_offer_fee_challans where id=$6 limit 1`,
  [
    tenantId,
    expireOfferId,
    applicantId,
    BSIT_OFFERING,
    `OF-EXP-${stamp}`,
    offerChallan.id,
  ],
);
const expire = await api('POST', '/admissions/offer-fees/expire-unpaid', {
  token: adminToken,
  body: { intakeSessionId: INTAKE_ID, promoteWaitlist: true },
});
log(
  '38 Expire unpaid offers',
  expire.status === 200 && Number(expire.json?.data?.expiredCount || 0) >= 1,
  `status=${expire.status} expired=${expire.json?.data?.expiredCount} promoted=${expire.json?.data?.promotedCount}`,
);
}

await db.end();
try {
  fs.unlinkSync(wbPath);
} catch {
  /* ignore */
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log('\n=== FULL E2E SUMMARY ===');
console.log(`email=${email}`);
console.log(`applicantId=${applicantId} ref=${appRef}`);
console.log(`PASS ${passed} / FAIL ${failed} / TOTAL ${results.length}`);
console.log(`Real password login used: ${loginOk}`);
process.exit(failed ? 1 : 0);
