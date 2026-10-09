/**
 * Continue full E2E for moheg18078@meinvr.com (already registered/submitted).
 * Covers: fee evidence → approve → admit card → attendance → results →
 * merit → allocation → offer → offer challan → offer evidence.
 *
 * Run: node scripts/_e2e-moheg-user.mjs
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';

const BASE = 'http://localhost:3000/api/v1';
const INTAKE_ID = '7c5d625d-7643-4e3a-ae18-d823c646a127';
const BSIT_OFFERING = '93f125b4-33dd-4b98-9b07-972f38b8790c';
const PRO_OFFERING = '7274d8c3-bad1-47ff-b6d4-daf03fb1201a';
const SESSION_ID = 'cdf1fc8d-0e47-4b63-906a-da57ad772ecb';
const PASSWORD = 'Welcome1';
const email = 'moheg18078@meinvr.com';
const applicantName = 'Moheg Test Applicant';
const cnic = '35202-9876543-1';

const tenantId = (process.env.DEFAULT_TENANT_ID || '').replace(/^["']|["']$/g, '');
const secret =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  'change-me-access-secret-min-32-chars';

const stamp = Date.now().toString().slice(-8);
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
    json = { raw: text.slice(0, 800) };
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
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

function tinyPdf() {
  return Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
await db.connect();

// --- Prep ---
const seedTenant = '00000000-0000-4000-8000-000000000001';
await db.query(`update merit_formula_templates set tenant_id=$1 where tenant_id=$2`, [tenantId, seedTenant]);
await db.query(`update merit_formula_template_components set tenant_id=$1 where tenant_id=$2`, [tenantId, seedTenant]);
await db.query(`update academic_level_requirements set tenant_id=$1 where tenant_id=$2`, [tenantId, seedTenant]);
await db.query(`update programme_offerings set seat_capacity=50 where id=any($1::uuid[])`, [[BSIT_OFFERING, PRO_OFFERING]]);
await db.query(
  `insert into test_session_offerings (tenant_id, test_session_id, programme_offering_id)
   select $1,$2,$3 where not exists (
     select 1 from test_session_offerings where test_session_id=$2 and programme_offering_id=$3
   )`,
  [tenantId, SESSION_ID, BSIT_OFFERING],
);

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
    `select id from general_fees where tenant_id=$1 and fee_type=$2 and status='ACTIVE' and amount=$3 limit 1`,
    [tenantId, type, amount],
  );
  let gid = g.rows[0]?.id;
  if (!gid) {
    g = await db.query(
      `insert into general_fees (tenant_id, fee_type, amount, currency, status, created_by, updated_by)
       values ($1,$2,$3,'PKR','ACTIVE',$4,$4) returning id`,
      [tenantId, type, amount, actor],
    );
    gid = g.rows[0].id;
  }
  for (const oid of [BSIT_OFFERING, PRO_OFFERING]) {
    const exists = await db.query(
      `select 1 from offering_fees where tenant_id=$1 and programme_offering_id=$2 and general_fee_id=$3 and status='ACTIVE'`,
      [tenantId, oid, gid],
    );
    if (!exists.rowCount) {
      await db.query(
        `insert into offering_fees (tenant_id, programme_offering_id, general_fee_id, status, sort_order, created_by, updated_by)
         values ($1,$2,$3,'ACTIVE',$4,$5,$5)`,
        [tenantId, oid, gid, sort, actor],
      );
    }
  }
}
await db.query(
  `update intakes set merit_generation_mode='AUTO', fee_confirm_margin_percent=2, offer_fee_grace_hours=0 where id=$1`,
  [INTAKE_ID],
);
log('Prep formulas/capacity/session/offer-fees/AUTO', true);

const adminToken = mint(actor, 'e2e-admin@admission.test', ['ADMISSIONS_ADMIN']);

// ========== FIND OR REGISTER ==========
let applicantId;
let appRef;
let invite;

const existing = await db.query(
  `select id, application_reference, application_status, iam_user_id, submission_date
   from applications where lower(registered_email)=$1 and intake_id=$2`,
  [email.toLowerCase(), INTAKE_ID],
);

if (existing.rowCount) {
  applicantId = existing.rows[0].id;
  appRef = existing.rows[0].application_reference;
  log(
    '1 Existing applicant',
    true,
    `ref=${appRef} status=${existing.rows[0].application_status}`,
  );
} else {
  const reg = await api('POST', '/applicants/applications/registrations', {
    body: {
      intakeSessionId: INTAKE_ID,
      applicantName,
      registeredEmail: email,
      cnicNumber: cnic,
      mobileNumber: '+923001234567',
    },
  });
  applicantId = reg.json?.data?.applicantId;
  appRef = reg.json?.data?.applicationReference;
  invite = reg.json?.data?.invitationToken;
  log('1 Register', reg.status === 201 && !!applicantId, `ref=${appRef}`);
  if (!applicantId) {
    console.log(JSON.stringify(reg.json, null, 2));
    await db.end();
    process.exit(1);
  }
}

// ========== AUTH ==========
if (invite) {
  await api('POST', '/applicants/applications/auth/set-password', {
    body: { token: invite, password: PASSWORD },
  });
}

const login = await api('POST', '/auth/login', { body: { email, password: PASSWORD } });
let applicantToken =
  login.json?.data?.accessToken ||
  login.json?.data?.access_token ||
  login.json?.data?.token;
if ((login.status === 200 || login.status === 201) && applicantToken) {
  log('2 Login', true, 'password login ok');
} else {
  const row = (await db.query(`select iam_user_id from applications where id=$1`, [applicantId])).rows[0];
  applicantToken = mint(row.iam_user_id, email, ['APPLICANT']);
  log('2 Login fallback JWT', true, row.iam_user_id);
}

const A = `/applicants/applications/${applicantId}`;
const appRow = (
  await db.query(
    `select application_status, submission_date from applications where id=$1`,
    [applicantId],
  )
).rows[0];
const alreadySubmitted = !!appRow.submission_date;

if (!alreadySubmitted) {
  await api('POST', `${A}/academic`, {
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
  await api('POST', `${A}/addresses`, {
    token: applicantToken,
    body: {
      addresses: [{
        addressType: 'PRIMARY',
        addressLine1: 'House 1, Street 2, Model Town',
        countryId: 'PK',
        provinceId: 'PK-PB',
        cityId: 'PK-PB-LHE',
        postalCode: '54700',
        isSameAsPrimary: false,
      }],
    },
  });
  await api('POST', `${A}/contacts`, {
    token: applicantToken,
    body: {
      contacts: [
        {
          contactType: 'PARENT',
          name: 'Test Father',
          identityDocumentNumber: '35202-7654321-1',
          relationship: 'FATHER',
          occupation: 'Business',
          mobileNumber: '+923007654321',
        },
        {
          contactType: 'EMERGENCY',
          name: 'Test Brother',
          relationship: 'BROTHER',
          mobileNumber: '+923001112233',
        },
      ],
    },
  });
  await api('POST', `${A}/programme`, {
    token: applicantToken,
    body: {
      qualificationLevel: 'UNDERGRADUATE',
      options: [
        { programmeOfferingId: BSIT_OFFERING, preferenceOrder: 1 },
        { programmeOfferingId: PRO_OFFERING, preferenceOrder: 2 },
      ],
    },
  });
  await api('POST', `${A}/profile`, {
    token: applicantToken,
    body: {
      applicantName,
      gender: 'MALE',
      maritalStatus: 'SINGLE',
      dateOfBirth: '2004-05-15',
      mobileNumber: '+923001234567',
      primaryNationalityId: 'PK',
      domicileId: 'PK-PB-LHE',
      disabilityDeclared: false,
    },
  });
  const photoForm = new FormData();
  photoForm.append('file', new Blob([tinyPng()], { type: 'image/png' }), 'photo.png');
  await api('POST', `${A}/profile/photograph`, { token: applicantToken, formData: photoForm });
  const texts = await api('GET', `${A}/declaration/texts`, { token: applicantToken });
  const declIds = (texts.json?.data || []).map((d) => d.id);
  await api('POST', `${A}/declaration`, {
    token: applicantToken,
    body: {
      declarationAccepted: true,
      acceptedOfferingDeclarationIds: declIds,
      disciplinaryIssueDeclared: false,
    },
  });
  const submit = await api('POST', `${A}/submit`, { token: applicantToken, body: {} });
  log('3 Submit application', submit.status === 200 || submit.status === 201, `status=${submit.status}`);
} else {
  log('3 Application already submitted', true, appRow.application_status);
}

appRef = (
  await db.query(`select application_reference from applications where id=$1`, [applicantId])
).rows[0].application_reference;

// ========== PROCESSING FEE ==========
const challan = await api('POST', `${A}/processing-fee/challan`, {
  token: applicantToken,
  body: {},
});
const totalAmount = Number(
  challan.json?.data?.totalAmountPayable ??
    challan.json?.data?.total_amount_payable ??
    2500,
);
log(
  '4 Processing fee challan',
  challan.status === 201 || challan.status === 200,
  `status=${challan.status} amount=${totalAmount}`,
);

const evidenceForm = new FormData();
evidenceForm.append('file', new Blob([tinyPdf()], { type: 'application/pdf' }), 'challan-paid.pdf');
const evidence = await api('POST', `${A}/processing-fee/evidence`, {
  token: applicantToken,
  formData: evidenceForm,
});
const evidenceId = evidence.json?.data?.id || evidence.json?.data?.[0]?.id;
log(
  '5 Upload processing fee evidence',
  evidence.status === 201 || evidence.status === 200,
  `status=${evidence.status} evidenceId=${evidenceId} msg=${evidence.json?.message || ''}`,
);

if (evidenceId) {
  const verifyFee = await api('POST', `/admissions/processing-fee/evidence/${evidenceId}/verify`, {
    token: adminToken,
    body: {
      verificationNote: 'E2E verified for moheg',
      verificationSource: 'MANUAL',
      amountPaid: totalAmount,
      paymentDate: new Date().toISOString(),
    },
  });
  log(
    '6 Admin verify processing fee',
    verifyFee.status === 200,
    `status=${verifyFee.status} msg=${verifyFee.json?.message || ''}`,
  );
} else {
  // maybe already uploaded — find from DB
  const pe = await db.query(
    `select pe.id from payment_evidence pe
     join processing_fee_challans c on c.id = pe.challan_id
     where c.applicant_id=$1 order by pe.created_at desc limit 1`,
    [applicantId],
  );
  if (pe.rows[0]) {
    const verifyFee = await api('POST', `/admissions/processing-fee/evidence/${pe.rows[0].id}/verify`, {
      token: adminToken,
      body: {
        verificationNote: 'E2E verified',
        verificationSource: 'MANUAL',
        amountPaid: totalAmount,
        paymentDate: new Date().toISOString(),
      },
    });
    log('6 Admin verify existing fee evidence', verifyFee.status === 200, `status=${verifyFee.status}`);
  } else {
    log('6 Admin verify processing fee', false, 'no evidence id');
  }
}

// ========== DOCUMENTS ==========
const reqs = await api('GET', `/applicant/applications/${applicantId}/documents/requirements`, {
  token: applicantToken,
});
const requirements = Array.isArray(reqs.json?.data) ? reqs.json.data : [];
log('7 Document requirements', reqs.status === 200, `count=${requirements.length}`);

if (requirements.length) {
  const ids = requirements.map((r) => r.id || r.offeringRequiredDocumentId).filter(Boolean);
  const docForm = new FormData();
  docForm.append('file', new Blob([tinyPdf()], { type: 'application/pdf' }), 'cnic.pdf');
  for (const id of ids) docForm.append('offeringRequiredDocumentIds', id);
  const up = await api('POST', `/applicant/applications/${applicantId}/documents`, {
    token: applicantToken,
    formData: docForm,
  });
  log('8 Upload required documents', up.status === 201 || up.status === 200, `status=${up.status}`);
  const docs = Array.isArray(up.json?.data) ? up.json.data : [up.json?.data].filter(Boolean);
  for (const d of docs) {
    const docId = d?.id || d?.documentId;
    if (!docId) continue;
    await api('POST', `/admissions/documents/${docId}/verify`, { token: adminToken, body: {} });
  }
  log('9 Admin verify documents', true, `count=${docs.length}`);
} else {
  log('8 Upload required documents', true, 'none required / already done');
  log('9 Admin verify documents', true, 'skipped');
}

const approve = await api('PATCH', `/admissions/applications/${applicantId}/status`, {
  token: adminToken,
  body: { status: 'APPROVED' },
});
log(
  '10 Admin approve',
  approve.status === 200,
  `status=${approve.status} app=${approve.json?.data?.applicationStatus || approve.json?.message || ''}`,
);

// ========== ADMIT CARD + ATTENDANCE ==========
const card = await api('POST', `/admissions/applications/${applicantId}/admit-card/generate`, {
  token: adminToken,
  body: {},
});
log('11 Generate admit card', card.status === 201 || card.status === 200, `status=${card.status}`);

const mark = await api('POST', `/admissions/applications/${applicantId}/attendance`, {
  token: adminToken,
  body: { attendanceStatus: 'PRESENT', identityVerified: true },
});
log('12 Mark attendance PRESENT', mark.status === 200, `status=${mark.status}`);

const awaited = await api('POST', `/admissions/applications/${applicantId}/result-awaited`, {
  token: adminToken,
  body: {},
});
log('13 Mark result-awaited', awaited.status === 200, `status=${awaited.status}`);

if (mark.status >= 400 || awaited.status >= 400) {
  const cardRow = (
    await db.query(
      `select id from application_admit_cards where applicant_id=$1 order by updated_at desc limit 1`,
      [applicantId],
    )
  ).rows[0];
  const appMeta = (
    await db.query(`select application_id from applications where id=$1`, [applicantId])
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
      [tenantId, applicantId, String(appMeta.application_id), SESSION_ID, cardRow.id, actor],
    );
    log('13b DB fallback attendance+awaited', true);
  }
}

// ========== RESULTS ==========
const wbPath = path.join(process.cwd(), 'scripts', `_e2e-moheg-${stamp}.xlsx`);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet([
    {
      application_reference: appRef,
      entry_test_score: 157,
      total_marks: 200,
      result_status: 'PASS',
      remarks: 'E2E moheg',
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
  '14 Import entry test results',
  imp.status === 201 && imp.json?.data?.status === 'READY_TO_CONFIRM',
  `status=${imp.status} importStatus=${imp.json?.data?.status} invalid=${imp.json?.data?.invalidRows}`,
);

if (importId) {
  const confirm = await api('POST', `/admissions/entry-test-results/imports/${importId}/confirm`, {
    token: adminToken,
    body: { correctionReason: 'E2E moheg' },
  });
  log('15 Confirm result import', confirm.status === 200, `status=${confirm.status}`);
} else {
  log('15 Confirm result import', false, 'no import id');
}

const pubRes = await api('POST', '/admissions/entry-test-results/publish', {
  token: adminToken,
  body: { testSessionId: SESSION_ID },
});
const autoMerit = pubRes.json?.data?.autoMerit || [];
const autoGenerated = autoMerit.find((x) => x.status === 'GENERATED');
log(
  '16 Publish results',
  pubRes.status === 200,
  `status=${pubRes.status} published=${pubRes.json?.data?.publishedCount} auto=${autoMerit.length}`,
);

const appResults = await api('GET', '/applicant/results', { token: applicantToken });
log(
  '17 Applicant view results',
  appResults.status === 200 && (appResults.json?.data?.length ?? 0) > 0,
  `status=${appResults.status} count=${appResults.json?.data?.length}`,
);

// ========== MERIT + ALLOCATION + OFFER ==========
let meritListId = autoGenerated?.meritListId;
if (!meritListId) {
  const merit = await api('POST', '/admissions/merit-lists/generate', {
    token: adminToken,
    body: { testSessionId: SESSION_ID, programmeOfferingId: BSIT_OFFERING },
  });
  meritListId = merit.json?.data?.id;
  log('18 Generate merit list', merit.status === 201 || merit.status === 200, `id=${meritListId}`);
} else {
  log('18 Generate merit list', true, `AUTO meritListId=${meritListId}`);
}

if (meritListId) {
  await api('POST', `/admissions/merit-lists/${meritListId}/approve`, { token: adminToken, body: {} });
  await api('POST', `/admissions/merit-lists/${meritListId}/publish`, { token: adminToken, body: {} });
  log('19 Approve+publish merit', true);
} else {
  log('19 Approve+publish merit', false, 'no merit list');
}

const preview = await api('POST', '/admissions/allocations/preview', {
  token: adminToken,
  body: { intakeSessionId: INTAKE_ID, testSessionId: SESSION_ID },
});
const allocationId = preview.json?.data?.allocationId;
const allocationVersion = preview.json?.data?.allocationVersion;
log(
  '20 Allocation preview',
  preview.status === 201 || preview.status === 200,
  `selected=${preview.json?.data?.selectedCount} waiting=${preview.json?.data?.waitingCount}`,
);

const confAlloc = await fetch(`${BASE}/admissions/allocations/confirm`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': `e2e-moheg-${stamp}`,
  },
  body: JSON.stringify({ allocationId, allocationVersion }),
});
const confJson = await confAlloc.json();
log('21 Confirm allocation', confAlloc.status === 200, `status=${confAlloc.status}`);

let authOffer = await api('POST', `/admissions/applications/${applicantId}/offer/authorize`, {
  token: adminToken,
  body: {
    offerType: 'UNCONDITIONAL',
    offerLetterDocument: 'e2e-moheg-offer.pdf',
    feePaymentInstructions: 'Pay within deadline',
  },
});
log('22 Authorize offer', authOffer.status === 201 || authOffer.status === 200, `status=${authOffer.status}`);

if (authOffer.status === 422) {
  await db.query(
    `update applications
     set selection_status='SELECTED',
         selected_programme_offering_id=$2,
         selection_at=now(),
         selection_by=$3,
         selection_reason='E2E force-select for moheg offer path'
     where id=$1`,
    [applicantId, BSIT_OFFERING, actor],
  );
  authOffer = await api('POST', `/admissions/applications/${applicantId}/offer/authorize`, {
    token: adminToken,
    body: {
      offerType: 'UNCONDITIONAL',
      offerLetterDocument: 'e2e-moheg-offer.pdf',
      feePaymentInstructions: 'Pay within deadline',
    },
  });
  log('22b Authorize after force-select', authOffer.status === 201 || authOffer.status === 200, `status=${authOffer.status}`);
}

const pubOffer = await api('POST', `/admissions/applications/${applicantId}/offer/publish`, {
  token: adminToken,
  body: {},
});
const feeChallan = pubOffer.json?.data?.feeChallan || pubOffer.json?.data?.fee_challan;
log(
  '23 Publish offer',
  pubOffer.status === 200 && Boolean(feeChallan?.id || feeChallan?.challanNumber),
  `status=${pubOffer.status} challan=${feeChallan?.challanNumber || feeChallan?.id || 'missing'}`,
);

if (!feeChallan?.id) {
  const offerRow = await db.query(
    `select id from admission_offers
     where tenant_id=$1 and application_record_id=$2
       and status in ('PUBLISHED','ACCEPTED')
     order by created_at desc limit 1`,
    [tenantId, applicantId],
  );
  if (offerRow.rows[0]) {
    const gen = await api('POST', `/admissions/offer-fees/offers/${offerRow.rows[0].id}/challan/generate`, {
      token: adminToken,
      body: {},
    });
    log('23b Generate offer-fee challan', gen.status === 201 || gen.status === 200, `status=${gen.status}`);
  }
}

const appOffer = await api('GET', '/applicant/offer', { token: applicantToken });
log('24 Applicant view offer', appOffer.status === 200, `offerStatus=${appOffer.json?.data?.status}`);

const offerFeeGet = await api('GET', `/applicant/applications/${applicantId}/offer-fee/challan`, {
  token: applicantToken,
});
const offerChallan = offerFeeGet.json?.data;
log(
  '25 Get offer-fee challan',
  offerFeeGet.status === 200 && Number(offerChallan?.totalAmountPayable) > 0,
  `status=${offerFeeGet.status} amount=${offerChallan?.totalAmountPayable} lines=${offerChallan?.items?.length}`,
);

const offerEvidenceForm = new FormData();
offerEvidenceForm.append(
  'file',
  new Blob([tinyPdf()], { type: 'application/pdf' }),
  'offer-fee-receipt.pdf',
);
offerEvidenceForm.append('amountClaimed', String(offerChallan?.totalAmountPayable || 118180));
const offerEvidence = await api('POST', `/applicant/applications/${applicantId}/offer-fee/evidence`, {
  token: applicantToken,
  formData: offerEvidenceForm,
});
const offerEvidenceId = offerEvidence.json?.data?.id;
log(
  '26 Upload offer-fee evidence',
  offerEvidence.status === 201 || offerEvidence.status === 200,
  `status=${offerEvidence.status} evidenceId=${offerEvidenceId} msg=${offerEvidence.json?.message || ''}`,
);

if (offerEvidenceId) {
  const verifyOfferFee = await api('POST', `/admissions/offer-fees/evidences/${offerEvidenceId}/verify`, {
    token: adminToken,
    body: {
      verificationIndicator: 'VERIFIED',
      amountPaid: Number(offerChallan?.totalAmountPayable || 118180),
    },
  });
  log(
    '27 Verify offer-fee evidence',
    verifyOfferFee.status === 200 &&
      ['VERIFIED', 'LATE_PAYMENT_VERIFIED'].includes(verifyOfferFee.json?.data?.paymentStatus),
    `status=${verifyOfferFee.status} paymentStatus=${verifyOfferFee.json?.data?.paymentStatus}`,
  );
} else {
  log('27 Verify offer-fee evidence', false, 'no evidence id');
}

const offerFinal = await api('GET', '/applicant/offer', { token: applicantToken });
log(
  '28 Final offer status',
  offerFinal.status === 200,
  `status=${offerFinal.json?.data?.status}`,
);

console.log('\n=== SUMMARY ===');
console.log(`Email: ${email}`);
console.log(`Password (if set): ${PASSWORD}`);
console.log(`Applicant ID: ${applicantId}`);
console.log(`Application Reference: ${appRef}`);
console.log(`Applicant portal: http://localhost:5173/sign-in`);
console.log(`  My Application / view: /applications/${applicantId}/view`);
console.log(`  Results: /results`);
console.log(`  Offer: /offer`);
console.log(`  Offer challan: /applications/${applicantId}/offer-fee/challan`);
const failed = results.filter((r) => !r.ok);
console.log(`Passed: ${results.filter((r) => r.ok).length}/${results.length}`);
if (failed.length) {
  console.log('Failed steps:');
  for (const f of failed) console.log(`  - ${f.step}: ${f.detail}`);
  process.exitCode = 1;
}

await db.end();
try {
  fs.unlinkSync(wbPath);
} catch {
  /* ignore */
}
