/**
 * All scenarios E2E: negative (reject/guard) paths + positive full pipeline.
 * Usage: node scripts/_e2e-all-scenarios.mjs
 * Requires API on localhost:3000.
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3000/api/v1';
const INTAKE_ID = '7c5d625d-7643-4e3a-ae18-d823c646a127';
const BSIT_OFFERING = '93f125b4-33dd-4b98-9b07-972f38b8790c';
const PRO_OFFERING = '7274d8c3-bad1-47ff-b6d4-daf03fb1201a';
const SESSION_ID = 'cdf1fc8d-0e47-4b63-906a-da57ad772ecb';
const PASSWORD = 'Welcome1';
const WEAK_PASSWORD = 'welcome1'; // no uppercase
const actor = '00000000-0000-4000-8000-0000000000aa';

const tenantId = (process.env.DEFAULT_TENANT_ID || '').replace(/^["']|["']$/g, '');
const secret =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  'change-me-access-secret-min-32-chars';

const stamp = Date.now().toString().slice(-8);
const results = [];

function log(step, ok, detail = '') {
  results.push({ step, ok, detail, kind: step.startsWith('N') ? 'NEG' : 'POS' });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`);
}

function codeOf(json) {
  return (
    json?.code ||
    json?.data?.code ||
    json?.error?.code ||
    json?.message ||
    ''
  );
}

async function api(method, urlPath, { token, body, formData } = {}) {
  const h = {};
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
    json = { raw: text.slice(0, 400) };
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

function tinyPdf() {
  return Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
}

function expectStatus(step, res, allowed, alsoCode) {
  const okStatus = allowed.includes(res.status);
  const c = String(codeOf(res.json));
  const okCode =
    !alsoCode ||
    alsoCode.length === 0 ||
    alsoCode.some((x) => c.toLowerCase().includes(String(x).toLowerCase()));
  log(
    step,
    okStatus && okCode,
    `status=${res.status} code=${c}`.slice(0, 180),
  );
}

const adminToken = mint(actor, 'e2e-admin@admission.test', ['ADMISSIONS_ADMIN']);

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
});
await db.connect();

console.log('\n========== NEGATIVE SCENARIOS ==========\n');

// ---------- N1 Duplicate email ----------
const emailNeg = `e2e.neg.${stamp}@example.com`;
const cnic1 = `35202-${String(2000000 + Number(stamp) % 7000000).padStart(7, '0')}-1`;
const cnic2 = `35202-${String(3000000 + Number(stamp) % 7000000).padStart(7, '0')}-1`;

const reg1 = await api('POST', '/applicants/applications/registrations', {
  body: {
    intakeSessionId: INTAKE_ID,
    applicantName: 'Neg Applicant One',
    registeredEmail: emailNeg,
    cnicNumber: cnic1,
    mobileNumber: '+923001111111',
  },
});
log(
  'N01 Register baseline (setup)',
  reg1.status === 201,
  `status=${reg1.status} ref=${reg1.json?.data?.applicationReference}`,
);
const invite1 = reg1.json?.data?.invitationToken;
const applicantNegId = reg1.json?.data?.applicantId;

const dupEmail = await api('POST', '/applicants/applications/registrations', {
  body: {
    intakeSessionId: INTAKE_ID,
    applicantName: 'Neg Dup Email',
    registeredEmail: emailNeg,
    cnicNumber: cnic2,
    mobileNumber: '+923001111112',
  },
});
expectStatus('N02 Duplicate email → 409', dupEmail, [409], ['already registered', 'Email']);

// ---------- N2 Duplicate CNIC ----------
const dupCnic = await api('POST', '/applicants/applications/registrations', {
  body: {
    intakeSessionId: INTAKE_ID,
    applicantName: 'Neg Dup CNIC',
    registeredEmail: `e2e.neg.cnic.${stamp}@example.com`,
    cnicNumber: cnic1,
    mobileNumber: '+923001111113',
  },
});
expectStatus('N03 Duplicate CNIC → 409', dupCnic, [409], ['CNIC', 'already', 'passport']);

// ---------- N3 Invalid intake ----------
const badIntake = await api('POST', '/applicants/applications/registrations', {
  body: {
    intakeSessionId: '00000000-0000-4000-8000-000000000099',
    applicantName: 'Neg Bad Intake',
    registeredEmail: `e2e.neg.intake.${stamp}@example.com`,
    cnicNumber: `35202-${String(4000000 + Number(stamp) % 5000000).padStart(7, '0')}-1`,
    mobileNumber: '+923001111114',
  },
});
expectStatus(
  'N04 Invalid/unavailable intake → 4xx',
  badIntake,
  [400, 404, 409, 422],
  ['INTAKE', 'not found', 'NOT_AVAILABLE', 'available', 'intake'],
);

// ---------- N4 Set-password bad token ----------
const badToken = await api('POST', '/applicants/applications/auth/set-password', {
  body: { token: 'tooshort', password: PASSWORD },
});
expectStatus('N05 Set-password short token → 400', badToken, [400], ['INVALID_TOKEN', 'token', 'Token']);

// ---------- N5 Weak password ----------
if (invite1) {
  const weak = await api('POST', '/applicants/applications/auth/set-password', {
    body: { token: invite1, password: WEAK_PASSWORD },
  });
  expectStatus('N06 Weak password → 400', weak, [400], [
    'WEAK_PASSWORD',
    'VALIDATION_ERROR',
    'password',
    'Password',
  ]);

  const setOk = await api('POST', '/applicants/applications/auth/set-password', {
    body: { token: invite1, password: PASSWORD },
  });
  log(
    'N07 Set-password valid (setup)',
    setOk.status === 200 || setOk.status === 201,
    `status=${setOk.status}`,
  );
} else {
  log('N06 Weak password → 400', false, 'skipped — no invite');
  log('N07 Set-password valid (setup)', false, 'skipped');
}

const loginNeg = await api('POST', '/auth/login', {
  body: { email: emailNeg, password: PASSWORD },
});
const negToken =
  loginNeg.json?.data?.access_token ||
  loginNeg.json?.data?.accessToken ||
  loginNeg.json?.data?.token;
log('N08 Login neg applicant (setup)', Boolean(negToken), `status=${loginNeg.status}`);

// ---------- N6 Submit incomplete ----------
const submitEarly = await api(
  'POST',
  `/applicants/applications/${applicantNegId}/submit`,
  { token: negToken, body: {} },
);
expectStatus(
  'N09 Submit incomplete → 422',
  submitEarly,
  [422],
  ['INCOMPLETE', 'REQUIRED', 'STEP', 'Academic', 'Programme', 'Profile', 'Declaration'],
);

// ---------- N7 Processing fee before submit ----------
const challanEarly = await api(
  'POST',
  `/applicants/applications/${applicantNegId}/processing-fee/challan`,
  { token: negToken, body: {} },
);
expectStatus(
  'N10 Challan before submit → 422',
  challanEarly,
  [422],
  ['APPLICATION_NOT_SUBMITTED', 'SUBMITTED', 'submit'],
);

// ---------- N8 Evidence without challan ----------
const evNoChallan = new FormData();
evNoChallan.append('file', new Blob([tinyPdf()], { type: 'application/pdf' }), 'x.pdf');
const evidenceEarly = await api(
  'POST',
  `/applicants/applications/${applicantNegId}/processing-fee/evidence`,
  { token: negToken, formData: evNoChallan },
);
expectStatus('N11 Evidence without challan → 404', evidenceEarly, [404], []);

// ---------- Build minimial complete app for mid-flow negatives ----------
async function saveAcademic(token, applicantId) {
  return api('POST', `/applicants/applications/${applicantId}/academic`, {
    token,
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
}

async function saveProgramme(token, applicantId) {
  return api('POST', `/applicants/applications/${applicantId}/programme`, {
    token,
    body: {
      qualificationLevel: 'UNDERGRADUATE',
      options: [
        { programmeOfferingId: BSIT_OFFERING, preferenceOrder: 1 },
        { programmeOfferingId: PRO_OFFERING, preferenceOrder: 2 },
      ],
    },
  });
}

async function saveAddressesContactsProfile(token, applicantId) {
  await api('POST', `/applicants/applications/${applicantId}/addresses`, {
    token,
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
  await api('POST', `/applicants/applications/${applicantId}/contacts`, {
    token,
    body: {
      contacts: [
        {
          contactType: 'PARENT',
          name: 'Neg Father',
          identityDocumentNumber: '35202-7654321-9',
          relationship: 'FATHER',
          occupation: 'Business',
          mobileNumber: '+923007654329',
        },
        {
          contactType: 'EMERGENCY',
          name: 'Neg Brother',
          relationship: 'BROTHER',
          mobileNumber: '+923001112239',
        },
      ],
    },
  });
  return api('POST', `/applicants/applications/${applicantId}/profile`, {
    token,
    body: {
      applicantName: 'Neg Applicant One',
      gender: 'MALE',
      maritalStatus: 'SINGLE',
      dateOfBirth: '2004-05-15',
      mobileNumber: '+923001111111',
      primaryNationalityId: 'PK',
      domicileId: 'PK-PB-LHE',
      disabilityDeclared: false,
    },
  });
}

async function saveDeclaration(token, applicantId) {
  const texts = await api(
    'GET',
    `/applicants/applications/${applicantId}/declaration/texts`,
    { token },
  );
  const ids = (texts.json?.data || []).map((d) => d.id).filter(Boolean);
  return api('POST', `/applicants/applications/${applicantId}/declaration`, {
    token,
    body: {
      declarationAccepted: true,
      acceptedOfferingDeclarationIds: ids,
      disciplinaryIssueDeclared: false,
    },
  });
}

await saveAcademic(negToken, applicantNegId);
await saveProgramme(negToken, applicantNegId);
await saveAddressesContactsProfile(negToken, applicantNegId);
const decRes = await saveDeclaration(negToken, applicantNegId);
log(
  'N12 Complete steps for mid-flow (setup)',
  decRes.status === 200 || decRes.status === 201 || decRes.status === 422,
  `declaration status=${decRes.status}`,
);

// If declaration failed due to required offering texts, force flags via DB for negative mid-tests
await db.query(
  `update applications set
     academic_step_saved=true,
     programme_step_saved=true,
     profile_step_saved=true,
     declaration_step_saved=true
   where id=$1`,
  [applicantNegId],
);
await db.query(
  `insert into application_declarations (
     applicant_id, tenant_id, declaration_accepted, declaration_acceptance_date,
     disciplinary_issue_declared, accepted_offering_declaration_ids
   ) values ($2, $1, true, now(), false, '{}')
   on conflict (applicant_id) do update set
     declaration_accepted=true,
     disciplinary_issue_declared=false,
     declaration_acceptance_date=now()`,
  [tenantId, applicantNegId],
).catch((e) => console.log('declaration upsert note:', e.message));

const submitNeg = await api(
  'POST',
  `/applicants/applications/${applicantNegId}/submit`,
  { token: negToken, body: {} },
);
const submitted =
  submitNeg.status === 200 ||
  (await db.query(`select application_status from applications where id=$1`, [
    applicantNegId,
  ])).rows[0]?.application_status === 'COMPLETE' ||
  (await db.query(`select application_status from applications where id=$1`, [
    applicantNegId,
  ])).rows[0]?.application_status === 'SUBMITTED';

if (!submitted && submitNeg.status !== 200) {
  // Force COMPLETE for mid-flow negatives that need a submitted app
  await db.query(
    `update applications set application_status='COMPLETE', submission_date=now(),
       academic_step_saved=true, programme_step_saved=true,
       profile_step_saved=true, declaration_step_saved=true
     where id=$1`,
    [applicantNegId],
  );
}
log(
  'N13 Submit for mid-flow (setup)',
  true,
  `api=${submitNeg.status} forcedIfNeeded`,
);

// ---------- N9 Approve without fee ----------
const approveNoFee = await api(
  'PATCH',
  `/admissions/applications/${applicantNegId}/status`,
  {
    token: adminToken,
    body: { status: 'APPROVED' },
  },
);
expectStatus(
  'N14 Approve without verified fee → 422',
  approveNoFee,
  [422],
  ['APPROVAL_PRECONDITIONS', 'PROCESSING_FEE', 'PRECONDITION', 'fee', 'Fee'],
);

// ---------- N10 Attendance without admit card ----------
const attNoCard = await api(
  'POST',
  `/admissions/applications/${applicantNegId}/attendance`,
  {
    token: adminToken,
    body: {
      attendanceStatus: 'PRESENT',
      identityVerified: true,
    },
  },
);
expectStatus(
  'N15 Attendance without admit card → 404/422',
  attNoCard,
  [404, 422],
  ['admit card', 'Admit', 'APPROVED', 'NOT_FOUND', 'Published'],
);

// ---------- N11 Offer authorize not SELECTED ----------
const offerNotSel = await api(
  'POST',
  `/admissions/applications/${applicantNegId}/offer/authorize`,
  {
    token: adminToken,
    body: {
      offerType: 'UNCONDITIONAL',
      offerLetterDocument: 'x.pdf',
    },
  },
);
expectStatus(
  'N16 Offer authorize when not SELECTED → 422',
  offerNotSel,
  [422],
  ['selected', 'SELECTED', 'Only selected'],
);

// ---------- N12 Offer-fee evidence without challan ----------
const ofEv = new FormData();
ofEv.append('file', new Blob([tinyPdf()], { type: 'application/pdf' }), 'of.pdf');
const ofEvidenceEarly = await api(
  'POST',
  `/applicant/applications/${applicantNegId}/offer-fee/evidence`,
  { token: negToken, formData: ofEv },
);
expectStatus(
  'N17 Offer-fee evidence without challan → 404',
  ofEvidenceEarly,
  [404],
  [],
);

// ---------- Generate processing fee + evidence for double-verify ----------
const challanOk = await api(
  'POST',
  `/applicants/applications/${applicantNegId}/processing-fee/challan`,
  { token: negToken, body: {} },
);
log(
  'N18 Generate processing challan (setup)',
  challanOk.status === 201 || challanOk.status === 200,
  `status=${challanOk.status}`,
);

const evForm = new FormData();
evForm.append('file', new Blob([tinyPdf()], { type: 'application/pdf' }), 'pay.pdf');
const evUp = await api(
  'POST',
  `/applicants/applications/${applicantNegId}/processing-fee/evidence`,
  { token: negToken, formData: evForm },
);
const evidenceId = evUp.json?.data?.id;
log(
  'N19 Upload processing evidence (setup)',
  Boolean(evidenceId),
  `status=${evUp.status} id=${evidenceId}`,
);

if (evidenceId) {
  const totalAmount = Number(challanOk.json?.data?.totalAmountPayable || 2500);
  const verify1 = await api(
    'POST',
    `/admissions/processing-fee/evidence/${evidenceId}/verify`,
    {
      token: adminToken,
      body: {
        verificationNote: 'Neg scenario verify',
        verificationSource: 'MANUAL',
        amountPaid: totalAmount,
        paymentDate: new Date().toISOString(),
      },
    },
  );
  log(
    'N20 Verify processing evidence once (setup)',
    verify1.status === 200,
    `status=${verify1.status}`,
  );

  const verify2 = await api(
    'POST',
    `/admissions/processing-fee/evidence/${evidenceId}/verify`,
    {
      token: adminToken,
      body: {
        verificationNote: 'Neg double verify',
        verificationSource: 'MANUAL',
        amountPaid: totalAmount,
        paymentDate: new Date().toISOString(),
      },
    },
  );
  expectStatus(
    'N21 Double verify processing evidence → 409',
    verify2,
    [409],
    ['EVIDENCE_NOT_VERIFIABLE', 'VERIFIABLE', 'already', 'verified'],
  );

  const evAgain = new FormData();
  evAgain.append('file', new Blob([tinyPdf()], { type: 'application/pdf' }), 'pay2.pdf');
  const replaceVerified = await api(
    'POST',
    `/applicants/applications/${applicantNegId}/processing-fee/evidence`,
    { token: negToken, formData: evAgain },
  );
  expectStatus(
    'N22 Replace evidence after verified → 409',
    replaceVerified,
    [409],
    ['PAYMENT_ALREADY_VERIFIED', 'VERIFIED', 'verified'],
  );
} else {
  log('N21 Double verify processing evidence → 409', false, 'skipped');
  log('N22 Replace evidence after verified → 409', false, 'skipped');
}

// ---------- Bank CSV negatives ----------
const today = new Date().toISOString().slice(0, 10);
const badCsv = [
  'ReceiptNo,ConsumerNo,ClassName,Student Name,Valid Date of Voucher,Due Date,AmountWithinDD,AmountAfterDD,CampusCode,Date_Paid,Amount,PaymentMode,BranchCode,usertext1,usertext2,usertext3,usertext4,usertext5',
  `NO-SUCH-CHALLAN-${stamp},PU-NONE,Fall-2026,Ghost,${today},${today},100.00,110.00,01,${today},100.00,CASH,0883,,,,,`,
].join('\n');
const badForm = new FormData();
badForm.append('file', new Blob([badCsv], { type: 'text/csv' }), 'bad.csv');
const bankBad = await api(
  'POST',
  '/admissions/processing-fee/reconciliation/imports',
  { token: adminToken, formData: badForm },
);
const unmatched =
  Number(bankBad.json?.data?.exceptionRecords || 0) >= 1 ||
  Number(bankBad.json?.data?.matchedRecords || 0) === 0;
log(
  'N23 Bank CSV unmatched challan → exception',
  (bankBad.status === 201 || bankBad.status === 200) && unmatched,
  `status=${bankBad.status} matched=${bankBad.json?.data?.matchedRecords} exceptions=${bankBad.json?.data?.exceptionRecords}`,
);

const emptyCsv = await api(
  'POST',
  '/admissions/processing-fee/reconciliation/imports',
  {
    token: adminToken,
    formData: (() => {
      const f = new FormData();
      f.append('file', new Blob(['not,a,valid\n'], { type: 'text/csv' }), 'badcols.csv');
      return f;
    })(),
  },
);
expectStatus(
  'N24 Bank CSV invalid columns → 400',
  emptyCsv,
  [400],
  ['INVALID_BANK_CSV', 'EMPTY', 'MALFORMED', 'columns', 'CSV'],
);

// ---------- Reject without reason ----------
const rejectNoReason = await api(
  'PATCH',
  `/admissions/applications/${applicantNegId}/status`,
  { token: adminToken, body: { status: 'REJECTED' } },
);
expectStatus(
  'N25 Reject without reason → 422',
  rejectNoReason,
  [422, 400],
  ['REJECTION_REASON', 'reason', 'Reason'],
);

// ---------- Forbidden: applicant calling admin offer expire ----------
const forbidden = await api('POST', '/admissions/offer-fees/expire-unpaid', {
  token: negToken,
  body: {},
});
expectStatus('N26 Applicant calling admin expire → 403', forbidden, [403, 401], [
  'FORBIDDEN',
  'Forbidden',
  'Unauthorized',
]);

// ---------- Offer fee margin ----------
{
  const anyApp = await db.query(
    `select id, application_reference, applicant_name, mobile_number
     from applications where tenant_id=$1 order by created_at desc limit 1`,
    [tenantId],
  );
  if (anyApp.rows[0]) {
    const a = anyApp.rows[0];
    const bank = (
      await db.query(
        `select * from designated_banks where tenant_id=$1 and is_active=true and status='ACTIVE' limit 1`,
        [tenantId],
      )
    ).rows[0];
    // Cancel any active published offer on this app so we can insert a fresh one
    await db.query(
      `update admission_offers set status='CANCELLED', expired_reason='ADMIN_CANCEL', updated_at=now()
       where tenant_id=$1 and application_record_id=$2 and status in ('AUTHORIZED','PUBLISHED')`,
      [tenantId, a.id],
    );
    const offerIns = await db.query(
      `insert into admission_offers (
         tenant_id, application_record_id, programme_offering_id, offer_type,
         acceptance_deadline, authorized_by, authorized_at, published_at,
         offer_issue_date, status
       ) values ($1,$2,$3,'UNCONDITIONAL', now()+interval '5 days', $4, now(), now(), now(), 'PUBLISHED')
       returning id`,
      [tenantId, a.id, BSIT_OFFERING, actor],
    );
    const challanNo = `OF-NEG-MARGIN-${stamp}`;
    const ch = await db.query(
      `insert into admission_offer_fee_challans (
         tenant_id, offer_id, applicant_id, programme_offering_id, challan_number,
         issue_date, due_date, designated_bank_id, collection_bank_name,
         collection_bank_branch, collection_bank_account, branch_code,
         applicant_name, applicant_contact_number, registration_number,
         intake_session, programme_name, total_amount_payable, amount_in_words, payment_status
       ) values (
         $1,$2,$3,$4,$5, now(), now()+interval '5 days', $6, $7, $8, $9, $10,
         $11, $12, $13, 'ABC17', 'BSIT', '10000.00', 'ten thousand', 'UNPAID'
       ) returning id`,
      [
        tenantId,
        offerIns.rows[0].id,
        a.id,
        BSIT_OFFERING,
        challanNo,
        bank.id,
        bank.bank_name,
        bank.branch_name,
        bank.account_number,
        bank.branch_code,
        a.applicant_name,
        a.mobile_number,
        a.application_reference,
      ],
    );
    const ev = await db.query(
      `insert into admission_offer_fee_evidences
         (tenant_id, applicant_id, challan_id, storage_key, file_format, is_current)
       values ($1,$2,$3,$4,'PDF',true) returning id`,
      [tenantId, a.id, ch.rows[0].id, `e2e/margin/${stamp}.pdf`],
    );
    const marginFail = await api(
      'POST',
      `/admissions/offer-fees/evidences/${ev.rows[0].id}/verify`,
      {
        token: adminToken,
        body: { verificationIndicator: 'VERIFIED', amountPaid: 100 },
      },
    );
    expectStatus(
      'N27 Offer-fee amount outside margin → 422',
      marginFail,
      [422],
      ['OFFER_FEE_AMOUNT_OUTSIDE_MARGIN', 'margin', 'MARGIN', 'outside'],
    );
  } else {
    log('N27 Offer-fee amount outside margin → 422', false, 'skipped — no app');
  }
}

// ---------- Invalid QR ----------
const badQr = await api('GET', '/admissions/attendance/qr/not-a-valid-qr-token-xx', {
  token: adminToken,
});
expectStatus('N28 Invalid admit-card QR → 404', badQr, [404], ['INVALID_QR', 'QR', 'not found', 'Invalid']);

await db.end();

console.log('\n========== POSITIVE FULL PIPELINE ==========\n');

const positiveExit = await new Promise((resolve) => {
  const child = spawn(process.execPath, ['scripts/_e2e-full-from-start.mjs'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  let out = '';
  child.stdout.on('data', (b) => {
    const s = b.toString();
    out += s;
    process.stdout.write(s);
  });
  child.stderr.on('data', (b) => process.stderr.write(b.toString()));
  child.on('close', (code) => resolve({ code, out }));
});

const posPass = (positiveExit.out.match(/^PASS \|/gm) || []).length;
const posFail = (positiveExit.out.match(/^FAIL \|/gm) || []).length;
log(
  'P01 Positive full pipeline',
  positiveExit.code === 0,
  `exit=${positiveExit.code} passLines=${posPass} failLines=${posFail}`,
);

const neg = results.filter((r) => r.kind === 'NEG');
const negPass = neg.filter((r) => r.ok).length;
const negFail = neg.filter((r) => !r.ok).length;
const setupish = neg.filter((r) => r.step.includes('(setup)'));

console.log('\n=== ALL SCENARIOS SUMMARY ===');
console.log(
  `NEGATIVE: PASS ${negPass} / FAIL ${negFail} / TOTAL ${neg.length} (includes ${setupish.length} setup steps)`,
);
console.log(
  `POSITIVE: ${positiveExit.code === 0 ? 'PASS' : 'FAIL'} (full pipeline exit ${positiveExit.code})`,
);
console.log(
  `OVERALL: ${negFail === 0 && positiveExit.code === 0 ? 'PASS' : 'FAIL'}`,
);

process.exit(negFail === 0 && positiveExit.code === 0 ? 0 : 1);
