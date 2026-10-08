import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
});
await c.connect();
const intake = '7c5d625d-7643-4e3a-ae18-d823c646a127';
const offs = await c.query(
  `select po.id,p.code,p.degree_level,po.seat_capacity,p.id as programme_id
   from programme_offerings po join programmes p on p.id=po.programme_id
   where po.intake_id=$1 and po.offering_status='PUBLISHED'`,
  [intake],
);
console.log('OFFERINGS', offs.rows);
const ids = offs.rows.map((r) => r.id);
const docs = await c.query(
  `select ord.id,ord.programme_offering_id,dt.code,dt.name,ord.mandatory
   from offering_required_documents ord
   join document_types dt on dt.id=ord.document_type_id
   where ord.programme_offering_id = any($1::uuid[])`,
  [ids],
);
console.log('REQ_DOCS', docs.rows);
const fees = await c.query(
  `select ofe.programme_offering_id,gf.fee_type,gf.amount,ofe.status
   from offering_fees ofe join general_fees gf on gf.id=ofe.general_fee_id
   where ofe.programme_offering_id = any($1::uuid[]) and ofe.status='ACTIVE'`,
  [ids],
);
console.log('FEES', fees.rows);
const decls = await c.query(
  `select od.id, od.programme_offering_id, od.declaration_type_id, od.status
   from offering_declarations od
   where od.programme_offering_id = any($1::uuid[]) and od.status='ACTIVE'`,
  [ids],
);
console.log('DECLS', decls.rows);
const banks = await c.query(
  `select id, bank_name, is_active, status from designated_banks limit 5`,
);
console.log('BANKS', banks.rows);
const crit = await c.query(
  `select ac.programme_offering_id, gc.criteria_name, gc.criteria_value,
          gc.applies_to_degree_type, gc.mandatory, gc.criteria_operator
   from admission_criteria ac
   join general_criteria gc on gc.id=ac.general_criteria_id
   where ac.programme_offering_id = any($1::uuid[])`,
  [ids],
);
console.log('CRITERIA', crit.rows);
const sessions = await c.query(
  `select s.id, s.status from test_sessions s
   where s.intake_session_id=$1 and s.status='PUBLISHED'`,
  [intake],
);
console.log('SESSIONS', sessions.rows);
await c.end();
