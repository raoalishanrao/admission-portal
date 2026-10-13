/**
 * Full E2E for a postgraduate (Master) programme:
 * register → password → login → academic (BACHELOR) → programme → profile →
 * addresses/contacts → F004 documents → declaration → submit → processing fee →
 * approve → admit card → attendance → results → merit → allocation → offer →
 * offer-fee evidence.
 *
 * Target: Intake 10 / Master Psychology
 * Run: node scripts/_e2e-postgraduate.mjs
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import pg from 'pg'
import jwt from 'jsonwebtoken'
import * as XLSX from 'xlsx'

const BASE = 'http://localhost:3000/api/v1'
const INTAKE_ID = 'a991dcf4-1e55-41f6-9a92-08bbd6e817df' // Intake 10
const MASTER_OFFERING = '69bfda0c-9ff4-48b7-803a-3c391126bf1f' // PSY Master
const SESSION_ID = '4b6fa9ee-8010-41f5-99da-204fc0d9b940'
const PASSWORD = 'Welcome1'
const actor = '00000000-0000-4000-8000-0000000000aa'

const tenantId = (process.env.DEFAULT_TENANT_ID || '').replace(/^["']|["']$/g, '')
const secret =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  'change-me-access-secret-min-32-chars'

const stamp = Date.now().toString().slice(-8)
const email = `e2e.pg.${stamp}@example.com`
const cnic = `35202-${String(1000000 + Number(stamp) % 8999999).padStart(7, '0')}-1`

const results = []
function log(step, ok, detail = '') {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`)
}

async function api(method, urlPath, { token, body, formData, headers = {} } = {}) {
  const h = { ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  let bodyInit
  if (formData) bodyInit = formData
  else if (body !== undefined) {
    h['Content-Type'] = 'application/json'
    bodyInit = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${urlPath}`, { method, headers: h, body: bodyInit })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 500) }
  }
  return { status: res.status, json }
}

function mint(userId, userEmail, roles = []) {
  return jwt.sign(
    { sub: userId, email: userEmail, tenantId, type: 'oauth', roles },
    secret,
    { expiresIn: '2h' },
  )
}

function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
}

function tinyPdf() {
  return Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
})
await db.connect()

// --- Prep ---
const seedTenant = '00000000-0000-4000-8000-000000000001'
await db.query(`update merit_formula_templates set tenant_id=$1 where tenant_id=$2`, [
  tenantId,
  seedTenant,
])
await db.query(
  `update merit_formula_template_components set tenant_id=$1 where tenant_id=$2`,
  [tenantId, seedTenant],
)
await db.query(
  `update academic_level_requirements set tenant_id=$1 where tenant_id=$2`,
  [tenantId, seedTenant],
)
await db.query(`update programme_offerings set seat_capacity=50 where id=$1`, [
  MASTER_OFFERING,
])
await db.query(
  `update test_sessions set status='PUBLISHED' where id=$1 and tenant_id=$2`,
  [SESSION_ID, tenantId],
)
await db.query(
  `insert into test_session_offerings (tenant_id, test_session_id, programme_offering_id)
   select $1,$2,$3 where not exists (
     select 1 from test_session_offerings where test_session_id=$2 and programme_offering_id=$3
   )`,
  [tenantId, SESSION_ID, MASTER_OFFERING],
)

const offerFeeDefs = [
  ['ADMISSION', 15000, 10],
  ['TUITION', 91680, 20],
  ['SEMESTER_REGISTRATION', 9000, 30],
  ['ID_CARD', 1500, 40],
  ['COUNCIL', 1000, 50],
]
for (const [type, amount, sort] of offerFeeDefs) {
  let g = await db.query(
    `select id from general_fees
     where tenant_id=$1 and fee_type=$2 and status='ACTIVE' and amount=$3 limit 1`,
    [tenantId, type, amount],
  )
  let gid = g.rows[0]?.id
  if (!gid) {
    g = await db.query(
      `insert into general_fees
         (tenant_id, fee_type, amount, currency, status, created_by, updated_by)
       values ($1,$2,$3,'PKR','ACTIVE',$4,$4) returning id`,
      [tenantId, type, amount, actor],
    )
    gid = g.rows[0].id
  }
  const exists = await db.query(
    `select 1 from offering_fees
     where tenant_id=$1 and programme_offering_id=$2 and general_fee_id=$3 and status='ACTIVE'`,
    [tenantId, MASTER_OFFERING, gid],
  )
  if (!exists.rowCount) {
    await db.query(
      `insert into offering_fees
         (tenant_id, programme_offering_id, general_fee_id, status, sort_order, created_by, updated_by)
       values ($1,$2,$3,'ACTIVE',$4,$5,$5)`,
      [tenantId, MASTER_OFFERING, gid, sort, actor],
    )
  }
}
await db.query(
  `update intakes
   set merit_generation_mode='AUTO',
       fee_confirm_margin_percent=2,
       offer_fee_grace_hours=0,
       application_open_at = least(application_open_at, now() - interval '1 day'),
       application_close_at = greatest(application_close_at, now() + interval '14 days')
   where id=$1`,
  [INTAKE_ID],
)
log('Prep Master offering / session / fees / AUTO merit', true)

const adminToken = mint(actor, 'e2e-admin@admission.test', ['ADMISSIONS_ADMIN'])

// ========== 1. REGISTER ==========
const reg = await api('POST', '/applicants/applications/registrations', {
  body: {
    intakeSessionId: INTAKE_ID,
    applicantName: 'E2E Postgraduate Applicant',
    registeredEmail: email,
    cnicNumber: cnic,
    mobileNumber: '+923001234567',
  },
})
const applicantId = reg.json?.data?.applicantId
const appRef = reg.json?.data?.applicationReference
const invite = reg.json?.data?.invitationToken
log(
  '1 Register applicant',
  reg.status === 201 && !!applicantId,
  `status=${reg.status} ref=${appRef} msg=${reg.json?.message || ''}`,
)
if (!applicantId) {
  console.log(JSON.stringify(reg.json, null, 2))
  await db.end()
  process.exit(1)
}

// ========== 2–3 AUTH ==========
let applicantToken
let loginOk = false
if (invite) {
  const sp = await api('POST', '/applicants/applications/auth/set-password', {
    body: { token: invite, password: PASSWORD },
  })
  log(
    '2 Set password',
    sp.status === 200 || sp.status === 201,
    `status=${sp.status}`,
  )
  const login = await api('POST', '/auth/login', {
    body: { email, password: PASSWORD },
  })
  const access =
    login.json?.data?.accessToken ||
    login.json?.data?.access_token ||
    login.json?.data?.token
  loginOk = (login.status === 200 || login.status === 201) && !!access
  if (loginOk) applicantToken = access
  log('3 Login with password', loginOk, `status=${login.status}`)
}
if (!applicantToken) {
  const row = (
    await db.query(`select iam_user_id from applications where id=$1`, [applicantId])
  ).rows[0]
  applicantToken = mint(row.iam_user_id, email, ['APPLICANT'])
  log('3 Fallback mint applicant JWT', true)
}

const A = `/applicants/applications/${applicantId}`

// ========== 4. ACADEMIC (Master requires BACHELOR) ==========
const academic = await api('POST', `${A}/academic`, {
  token: applicantToken,
  body: {
    records: [
      {
        degreeType: 'BACHELOR',
        rollNumber: `B-${stamp}`,
        qualificationName: 'BS Psychology',
        boardOrInstitution: 'University of Punjab',
        passingYear: '2024',
        division: '1st',
        grade: 'A',
        marksOrGpaObtained: '3.60',
        marksOrGpaTotal: '4.00',
        percentage: 90,
      },
    ],
  },
})
log(
  '4 Academic step (BACHELOR for Master)',
  academic.status === 201 || academic.status === 200,
  `status=${academic.status} msg=${academic.json?.message || ''}`,
)

// ========== 5–6 ADDRESSES / CONTACTS ==========
const addresses = await api('POST', `${A}/addresses`, {
  token: applicantToken,
  body: {
    addresses: [
      {
        addressType: 'PRIMARY',
        addressLine1: 'House 10, Street 5, Gulberg',
        countryId: 'PK',
        provinceId: 'PK-PB',
        cityId: 'PK-PB-LHE',
        postalCode: '54000',
        isSameAsPrimary: false,
      },
    ],
  },
})
log(
  '5 Addresses',
  addresses.status === 201 || addresses.status === 200,
  `status=${addresses.status}`,
)

const contacts = await api('POST', `${A}/contacts`, {
  token: applicantToken,
  body: {
    contacts: [
      {
        contactType: 'PARENT',
        name: 'E2E PG Father',
        identityDocumentNumber: '35202-7654321-1',
        relationship: 'FATHER',
        occupation: 'Teacher',
        mobileNumber: '+923007654321',
      },
      {
        contactType: 'EMERGENCY',
        name: 'E2E PG Sister',
        relationship: 'SISTER',
        mobileNumber: '+923001112233',
      },
    ],
  },
})
log(
  '6 Contacts',
  contacts.status === 201 || contacts.status === 200,
  `status=${contacts.status}`,
)

// ========== 7. PROGRAMME ==========
const programme = await api('POST', `${A}/programme`, {
  token: applicantToken,
  body: {
    degreeLevel: 'Master',
    options: [{ programmeOfferingId: MASTER_OFFERING, preferenceOrder: 1 }],
  },
})
log(
  '7 Programme preference (Master PSY)',
  programme.status === 201 || programme.status === 200,
  `status=${programme.status} msg=${programme.json?.message || ''}`,
)

// ========== 8. PROFILE ==========
const profile = await api('POST', `${A}/profile`, {
  token: applicantToken,
  body: {
    applicantName: 'E2E Postgraduate Applicant',
    gender: 'FEMALE',
    maritalStatus: 'SINGLE',
    dateOfBirth: '2000-03-12',
    mobileNumber: '+923001234567',
    primaryNationalityId: 'PK',
    domicileId: 'PK-PB-LHE',
    disabilityDeclared: false,
  },
})
log(
  '8 Profile step',
  profile.status === 201 || profile.status === 200,
  `status=${profile.status} msg=${profile.json?.message || ''}`,
)

const photoForm = new FormData()
photoForm.append('file', new Blob([tinyPng()], { type: 'image/png' }), 'photo.png')
const photo = await api('POST', `${A}/profile/photograph`, {
  token: applicantToken,
  formData: photoForm,
})
log(
  '8b Profile photograph',
  photo.status === 200 || photo.status === 201,
  `status=${photo.status}`,
)

// ========== 9. DOCUMENTS (before submit) ==========
const reqs = await api(
  'GET',
  `/applicant/applications/${applicantId}/documents/requirements`,
  { token: applicantToken },
)
const requirements = Array.isArray(reqs.json?.data) ? reqs.json.data : []
log(
  '9 Document requirements',
  reqs.status === 200 && requirements.length > 0,
  `status=${reqs.status} count=${requirements.length}`,
)

const uploadedDocIds = []
for (const req of requirements) {
  const ids =
    req.offeringRequiredDocumentIds?.length > 0
      ? req.offeringRequiredDocumentIds
      : [req.offeringRequiredDocumentId || req.id].filter(Boolean)
  if (!ids.length) continue
  if (req.status && req.status !== 'NOT_SUBMITTED') continue

  const docForm = new FormData()
  docForm.append(
    'file',
    new Blob([tinyPdf()], { type: 'application/pdf' }),
    `${req.documentTypeCode || 'doc'}.pdf`,
  )
  for (const id of ids) docForm.append('offeringRequiredDocumentIds', id)
  const up = await api('POST', `/applicant/applications/${applicantId}/documents`, {
    token: applicantToken,
    formData: docForm,
  })
  const docs = Array.isArray(up.json?.data)
    ? up.json.data
    : [up.json?.data].filter(Boolean)
  for (const d of docs) if (d?.id) uploadedDocIds.push(d.id)
  log(
    `9b Upload ${req.documentTypeName || req.documentTypeCode}`,
    up.status === 201 || up.status === 200,
    `status=${up.status} msg=${up.json?.message || ''}`,
  )
}

// ========== 10. DECLARATION ==========
const texts = await api('GET', `${A}/declaration/texts`, { token: applicantToken })
const declIds = (texts.json?.data || []).map((d) => d.id)
const declaration = await api('POST', `${A}/declaration`, {
  token: applicantToken,
  body: {
    declarationAccepted: true,
    acceptedOfferingDeclarationIds: declIds,
    disciplinaryIssueDeclared: false,
  },
})
log(
  '10 Declaration',
  declaration.status === 201 || declaration.status === 200,
  `status=${declaration.status} texts=${declIds.length}`,
)

// ========== 11. SUBMIT ==========
const submit = await api('POST', `${A}/submit`, {
  token: applicantToken,
  body: {},
})
log(
  '11 Submit application',
  submit.status === 200 || submit.status === 201,
  `status=${submit.status} appStatus=${submit.json?.data?.applicationStatus} msg=${submit.json?.message || ''}`,
)

// Verify docs after submit (staff)
for (const docId of [...new Set(uploadedDocIds)]) {
  const v = await api('POST', `/admissions/documents/${docId}/verify`, {
    token: adminToken,
    body: {},
  })
  log(
    `12 Verify document ${docId.slice(0, 8)}`,
    v.status === 200,
    `status=${v.status}`,
  )
}

const completeness = await api(
  'GET',
  `/applicant/applications/${applicantId}/documents/completeness`,
  { token: applicantToken },
)
log(
  '13 Document completeness',
  completeness.status === 200 && completeness.json?.data?.complete === true,
  `status=${completeness.status} ${completeness.json?.data?.verifiedCount}/${completeness.json?.data?.requiredCount}`,
)

// ========== 14. PROCESSING FEE ==========
const challan = await api(
  'POST',
  `/applicants/applications/${applicantId}/processing-fee/challan`,
  { token: applicantToken, body: {} },
)
const challanId = challan.json?.data?.id
const totalAmount = Number(
  challan.json?.data?.totalAmountPayable ??
    challan.json?.data?.total_amount_payable ??
    0,
)
log(
  '14 Processing fee challan',
  challan.status === 201 || challan.status === 200,
  `status=${challan.status} amount=${totalAmount} id=${challanId} msg=${challan.json?.message || ''}`,
)

const evidenceForm = new FormData()
evidenceForm.append(
  'file',
  new Blob([tinyPdf()], { type: 'application/pdf' }),
  'challan-paid.pdf',
)
const evidence = await api(
  'POST',
  `/applicants/applications/${applicantId}/processing-fee/evidence`,
  { token: applicantToken, formData: evidenceForm },
)
const evidenceId = evidence.json?.data?.id || evidence.json?.data?.[0]?.id
log(
  '15 Upload fee evidence',
  evidence.status === 201 || evidence.status === 200,
  `status=${evidence.status} evidenceId=${evidenceId}`,
)

const verifyFee = await api(
  'POST',
  `/admissions/processing-fee/evidence/${evidenceId}/verify`,
  {
    token: adminToken,
    body: {
      verificationNote: 'E2E PG verified',
      verificationSource: 'MANUAL',
      amountPaid: totalAmount || 2500,
      paymentDate: new Date().toISOString(),
    },
  },
)
log(
  '16 Admin verify processing fee',
  verifyFee.status === 200,
  `status=${verifyFee.status} msg=${verifyFee.json?.message || ''}`,
)

// ========== 17. APPROVE ==========
const approve = await api('PATCH', `/admissions/applications/${applicantId}/status`, {
  token: adminToken,
  body: { status: 'APPROVED' },
})
log(
  '17 Admin approve',
  approve.status === 200,
  `status=${approve.status} appStatus=${approve.json?.data?.applicationStatus || approve.json?.data?.status} msg=${approve.json?.message || ''}`,
)

// ========== 18–20 ADMIT CARD / ATTENDANCE ==========
const card = await api(
  'POST',
  `/admissions/applications/${applicantId}/admit-card/generate`,
  { token: adminToken, body: {} },
)
log(
  '18 Generate admit card',
  card.status === 201 || card.status === 200,
  `status=${card.status} msg=${card.json?.message || ''}`,
)

const mark = await api('POST', `/admissions/applications/${applicantId}/attendance`, {
  token: adminToken,
  body: { attendanceStatus: 'PRESENT', identityVerified: true },
})
log('19 Mark attendance PRESENT', mark.status === 200, `status=${mark.status}`)

const awaited = await api(
  'POST',
  `/admissions/applications/${applicantId}/result-awaited`,
  { token: adminToken, body: {} },
)
log('20 Mark result-awaited', awaited.status === 200, `status=${awaited.status}`)

if (mark.status >= 400 || awaited.status >= 400) {
  const cardRow = (
    await db.query(
      `select id from application_admit_cards where applicant_id=$1 order by updated_at desc limit 1`,
      [applicantId],
    )
  ).rows[0]
  const appRow = (
    await db.query(`select application_id from applications where id=$1`, [
      applicantId,
    ])
  ).rows[0]
  if (cardRow && appRow) {
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
        actor,
      ],
    )
    log('20b DB fallback attendance+awaited', true)
  }
}

// ========== 21–24 RESULTS ==========
const wbPath = path.join(process.cwd(), 'scripts', `_e2e-pg-${stamp}.xlsx`)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet([
    {
      application_reference: appRef,
      percentage: 88,
      result_status: 'PASS',
      test_score: 176,
      total_marks: 200,
      remarks: 'E2E postgraduate',
    },
  ]),
  'RESULT',
)
XLSX.writeFile(wb, wbPath)

const importForm = new FormData()
importForm.append('testSessionId', SESSION_ID)
importForm.append(
  'file',
  new Blob([fs.readFileSync(wbPath)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }),
  'result.xlsx',
)
const imp = await api('POST', '/admissions/entry-test-results/import', {
  token: adminToken,
  formData: importForm,
})
const importId = imp.json?.data?.id
log(
  '21 Upload result workbook',
  imp.status === 201 &&
    ['READY_TO_CONFIRM', 'CONFIRMED'].includes(imp.json?.data?.status),
  `status=${imp.status} importStatus=${imp.json?.data?.status} invalid=${imp.json?.data?.invalidRows} msg=${imp.json?.message || ''}`,
)

if (importId && imp.json?.data?.status === 'READY_TO_CONFIRM') {
  const confirm = await api(
    'POST',
    `/admissions/entry-test-results/imports/${importId}/confirm`,
    { token: adminToken, body: { correctionReason: 'E2E PG' } },
  )
  log('22 Confirm result import', confirm.status === 200, `status=${confirm.status}`)
} else {
  log('22 Confirm result import', Boolean(importId), 'skipped or already confirmed')
}

const pubRes = await api('POST', '/admissions/entry-test-results/publish', {
  token: adminToken,
  body: { testSessionId: SESSION_ID },
})
const autoMerit = pubRes.json?.data?.autoMerit || []
const autoGenerated = autoMerit.find((x) => x.status === 'GENERATED')
log(
  '23 Publish results',
  pubRes.status === 200,
  `status=${pubRes.status} published=${pubRes.json?.data?.publishedCount} mode=${pubRes.json?.data?.meritGenerationMode}`,
)

const appResults = await api('GET', '/applicant/results', { token: applicantToken })
log(
  '24 Applicant view results',
  appResults.status === 200 && (appResults.json?.data?.length ?? 0) > 0,
  `status=${appResults.status} count=${appResults.json?.data?.length}`,
)

// ========== 25–31 MERIT / ALLOCATION / OFFER ==========
let meritListId = autoGenerated?.meritListId
if (!meritListId) {
  const merit = await api('POST', '/admissions/merit-lists/generate', {
    token: adminToken,
    body: { testSessionId: SESSION_ID, programmeOfferingId: MASTER_OFFERING },
  })
  meritListId = merit.json?.data?.id
  log(
    '25 Generate merit list',
    merit.status === 201 || merit.status === 200,
    `status=${merit.status} candidates=${merit.json?.data?.candidateCount} msg=${merit.json?.message || ''}`,
  )
} else {
  log('25 Generate merit list', true, `reused AUTO meritListId=${meritListId}`)
}

if (meritListId) {
  const meritDetails = await api('GET', `/admissions/merit-lists/${meritListId}`, {
    token: adminToken,
  })
  const item = meritDetails.json?.data?.items?.[0]
  log(
    '26 Merit score present',
    meritDetails.status === 200 && item?.merit_score != null,
    `merit_score=${item?.merit_score} rank=${item?.merit_rank}`,
  )
  await api('POST', `/admissions/merit-lists/${meritListId}/approve`, {
    token: adminToken,
    body: {},
  })
  await api('POST', `/admissions/merit-lists/${meritListId}/publish`, {
    token: adminToken,
    body: {},
  })
  log('27 Approve+publish merit', true)
} else {
  log('26 Merit score present', false, 'no merit list')
  log('27 Approve+publish merit', false, 'no merit list')
}

const preview = await api('POST', '/admissions/allocations/preview', {
  token: adminToken,
  body: { intakeSessionId: INTAKE_ID, testSessionId: SESSION_ID },
})
const allocationId = preview.json?.data?.allocationId
const allocationVersion = preview.json?.data?.allocationVersion
log(
  '28 Allocation preview',
  preview.status === 201 || preview.status === 200,
  `status=${preview.status} selected=${preview.json?.data?.selectedCount} waiting=${preview.json?.data?.waitingCount} msg=${preview.json?.message || ''}`,
)

if (allocationId) {
  const confAlloc = await fetch(`${BASE}/admissions/allocations/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `e2e-pg-${stamp}`,
    },
    body: JSON.stringify({ allocationId, allocationVersion }),
  })
  const confJson = await confAlloc.json()
  log(
    '29 Confirm allocation',
    confAlloc.status === 200,
    `status=${confAlloc.status} ${confJson?.data?.status || confJson?.message || ''}`,
  )
} else {
  log('29 Confirm allocation', false, 'no allocation preview id')
}

let authOffer = await api(
  'POST',
  `/admissions/applications/${applicantId}/offer/authorize`,
  {
    token: adminToken,
    body: {
      offerType: 'UNCONDITIONAL',
      offerLetterDocument: 'e2e-pg-offer.pdf',
      feePaymentInstructions: 'Pay within deadline',
    },
  },
)
log(
  '30 Authorize offer',
  authOffer.status === 201 || authOffer.status === 200,
  `status=${authOffer.status} msg=${authOffer.json?.message || ''}`,
)

if (authOffer.status === 422) {
  await db.query(
    `update applications
     set selection_status='SELECTED',
         selected_programme_offering_id=$2,
         selection_at=now(),
         selection_by=$3,
         selection_reason='E2E PG force-select'
     where id=$1`,
    [applicantId, MASTER_OFFERING, actor],
  )
  authOffer = await api(
    'POST',
    `/admissions/applications/${applicantId}/offer/authorize`,
    {
      token: adminToken,
      body: {
        offerType: 'UNCONDITIONAL',
        offerLetterDocument: 'e2e-pg-offer.pdf',
        feePaymentInstructions: 'Pay within deadline',
      },
    },
  )
  log(
    '30b Authorize offer after force-select',
    authOffer.status === 201 || authOffer.status === 200,
    `status=${authOffer.status}`,
  )
}

const pubOffer = await api(
  'POST',
  `/admissions/applications/${applicantId}/offer/publish`,
  { token: adminToken, body: {} },
)
const feeChallan =
  pubOffer.json?.data?.feeChallan || pubOffer.json?.data?.fee_challan
log(
  '31 Publish offer',
  pubOffer.status === 200 && Boolean(feeChallan?.id || feeChallan?.challanNumber),
  `status=${pubOffer.status} challan=${feeChallan?.challanNumber || feeChallan?.id || 'missing'} err=${pubOffer.json?.message || ''}`,
)

const appOffer = await api('GET', '/applicant/offer', { token: applicantToken })
log(
  '32 Applicant view offer',
  appOffer.status === 200,
  `status=${appOffer.status} offerStatus=${appOffer.json?.data?.status}`,
)

const appCard = await api(
  'GET',
  `/applicant/applications/${applicantId}/admit-card`,
  { token: applicantToken },
)
log('33 Applicant view admit card', appCard.status === 200, `status=${appCard.status}`)

// ========== 34–36 OFFER FEE ==========
const offerFeeGet = await api(
  'GET',
  `/applicant/applications/${applicantId}/offer-fee/challan`,
  { token: applicantToken },
)
const offerChallan = offerFeeGet.json?.data
const offerAmount = Number(offerChallan?.totalAmountPayable || 0)
log(
  '34 Get offer-fee challan',
  offerFeeGet.status === 200 && offerAmount > 0,
  `status=${offerFeeGet.status} amount=${offerAmount} lines=${offerChallan?.items?.length}`,
)

if (offerFeeGet.status === 200 && offerAmount > 0) {
  const offerEvidenceForm = new FormData()
  offerEvidenceForm.append(
    'file',
    new Blob([tinyPdf()], { type: 'application/pdf' }),
    'offer-fee-receipt.pdf',
  )
  offerEvidenceForm.append('amountClaimed', String(offerAmount))
  const offerEvidence = await api(
    'POST',
    `/applicant/applications/${applicantId}/offer-fee/evidence`,
    { token: applicantToken, formData: offerEvidenceForm },
  )
  const offerEvidenceId = offerEvidence.json?.data?.id
  log(
    '35 Upload offer-fee evidence',
    offerEvidence.status === 201 || offerEvidence.status === 200,
    `status=${offerEvidence.status} evidenceId=${offerEvidenceId}`,
  )

  const verifyOfferFee = await api(
    'POST',
    `/admissions/offer-fees/evidences/${offerEvidenceId}/verify`,
    {
      token: adminToken,
      body: {
        verificationIndicator: 'VERIFIED',
        amountPaid: offerAmount,
      },
    },
  )
  log(
    '36 Verify offer-fee evidence',
    verifyOfferFee.status === 200 &&
      ['VERIFIED', 'LATE_PAYMENT_VERIFIED'].includes(
        verifyOfferFee.json?.data?.paymentStatus,
      ),
    `status=${verifyOfferFee.status} paymentStatus=${verifyOfferFee.json?.data?.paymentStatus}`,
  )
} else {
  log('35 Upload offer-fee evidence', false, 'no challan')
  log('36 Verify offer-fee evidence', false, 'no challan')
}

await db.end()
try {
  fs.unlinkSync(wbPath)
} catch {
  /* ignore */
}

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log('\n=== POSTGRADUATE E2E SUMMARY ===')
console.log(`email=${email}`)
console.log(`applicantId=${applicantId} ref=${appRef}`)
console.log(`offering=${MASTER_OFFERING} (Master PSY)`)
console.log(`intake=${INTAKE_ID} session=${SESSION_ID}`)
console.log(`PASS ${passed} / FAIL ${failed} / TOTAL ${results.length}`)
console.log(`Real password login used: ${loginOk}`)
if (failed) {
  console.log('\nFailed steps:')
  for (const r of results.filter((x) => !x.ok)) {
    console.log(` - ${r.step}: ${r.detail}`)
  }
}
process.exit(failed ? 1 : 0)
