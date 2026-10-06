import 'dotenv/config';
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3000/api/v1';
const tenantId = process.env.DEFAULT_TENANT_ID.replace(/^["']|["']$/g, '');
const secret = process.env.JWT_ACCESS_SECRET;
const stamp = Date.now().toString().slice(-6);
const email = `iso.${stamp}@example.com`;

async function api(m, p, o = {}) {
  const h = {};
  if (o.token) h.Authorization = 'Bearer ' + o.token;
  if (o.body) h['Content-Type'] = 'application/json';
  const r = await fetch(BASE + p, {
    method: m,
    headers: h,
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  const j = await r.json();
  return { status: r.status, j };
}

const reg = await api('POST', '/applicants/applications/registrations', {
  body: {
    intakeSessionId: '7c5d625d-7643-4e3a-ae18-d823c646a127',
    applicantName: 'Iso',
    registeredEmail: email,
    cnicNumber: `35202-${stamp.padStart(7, '0')}-1`,
    mobileNumber: '+923001234567',
  },
});
console.log('reg', reg.status, reg.j.data?.applicantId, !!reg.j.data?.invitationToken);

const sp = await api('POST', '/applicants/applications/auth/set-password', {
  body: { token: reg.j.data.invitationToken, password: 'Welcome1' },
});
console.log('sp', sp.status, sp.j.data || sp.j.message);

const login = await api('POST', '/auth/login', {
  body: { email, password: 'Welcome1' },
});
console.log('login', login.status, Object.keys(login.j.data || {}));
const token = login.j.data.access_token;
const id = reg.j.data.applicantId;

const acad = await api('POST', `/applicants/applications/${id}/academic`, {
  token,
  body: {
    records: [
      {
        degreeType: 'MATRIC',
        rollNumber: '1',
        qualificationName: 'Matric',
        boardOrInstitution: 'BISE',
        passingYear: '2020',
        division: '1st',
        grade: 'A',
        marksOrGpaObtained: '900',
        marksOrGpaTotal: '1100',
        percentage: 81.8,
      },
      {
        degreeType: 'FSC',
        rollNumber: '2',
        qualificationName: 'FSc',
        boardOrInstitution: 'BISE',
        passingYear: '2022',
        division: '1st',
        grade: 'A',
        marksOrGpaObtained: '950',
        marksOrGpaTotal: '1100',
        percentage: 86.3,
      },
    ],
  },
});
console.log('acad', acad.status, acad.j.message || 'ok');

const prog = await api('POST', `/applicants/applications/${id}/programme`, {
  token,
  body: {
    qualificationLevel: 'UNDERGRADUATE',
    options: [
      {
        programmeOfferingId: '93f125b4-33dd-4b98-9b07-972f38b8790c',
        preferenceOrder: 1,
      },
      {
        programmeOfferingId: '7274d8c3-bad1-47ff-b6d4-daf03fb1201a',
        preferenceOrder: 2,
      },
    ],
  },
});
console.log('prog', prog.status, JSON.stringify(prog.j).slice(0, 1200));
