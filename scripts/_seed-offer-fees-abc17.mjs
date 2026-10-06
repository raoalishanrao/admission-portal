import 'dotenv/config';
import pg from 'pg';

const tenantId = (process.env.DEFAULT_TENANT_ID || '').replace(/^["']|["']$/g, '');
const actor = '00000000-0000-4000-8000-0000000000aa';
const offerings = [
  '93f125b4-33dd-4b98-9b07-972f38b8790c',
  '7274d8c3-bad1-47ff-b6d4-daf03fb1201a',
];
const fees = [
  ['ADMISSION', 15000, 10],
  ['TUITION', 91680, 20],
  ['SEMESTER_REGISTRATION', 9000, 30],
  ['ID_CARD', 1500, 40],
  ['COUNCIL', 1000, 50],
];

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
});

await db.connect();
for (const [type, amount, sort] of fees) {
  let g = await db.query(
    `select id from general_fees
     where tenant_id=$1 and fee_type=$2 and status='ACTIVE' and amount=$3
     limit 1`,
    [tenantId, type, amount],
  );
  let gid = g.rows[0]?.id;
  if (!gid) {
    g = await db.query(
      `insert into general_fees
         (tenant_id, fee_type, amount, currency, status, created_by, updated_by)
       values ($1,$2,$3,'PKR','ACTIVE',$4,$4)
       returning id`,
      [tenantId, type, amount, actor],
    );
    gid = g.rows[0].id;
  }
  for (const oid of offerings) {
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
  console.log(`OK ${type}=${amount} id=${gid}`);
}

await db.query(
  `update intakes
   set merit_generation_mode='AUTO',
       fee_confirm_margin_percent=2,
       offer_fee_grace_hours=0
   where id='7c5d625d-7643-4e3a-ae18-d823c646a127'`,
);
console.log('OK intake ABC17 AUTO + margin 2%');
await db.end();
