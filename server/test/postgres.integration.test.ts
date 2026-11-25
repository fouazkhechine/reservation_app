import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

test('PostgreSQL rejects overlapping active bookings', async (t) => {
  if (!connectionString) { t.skip('DATABASE_URL is not configured'); return; }
  const pool = new Pool({ connectionString });
  const client = await pool.connect().catch(() => null);
  if (!client) { t.skip('PostgreSQL is not reachable'); await pool.end(); return; }
  try {
    const start = '2099-12-01T09:00:00Z';
    const end = '2099-12-01T10:00:00Z';
    await client.query('BEGIN');
    await client.query("INSERT INTO bookings(booking_reference, customer_name, customer_phone, wilaya, commune, address, start_at, end_at, total_price_dzd, total_duration) VALUES('TEST-OVERLAP-A','Test A','0555000001','Alger','Hydra','Test address',$1,$2,100,60)", [start, end]);
    await assert.rejects(() => client.query("INSERT INTO bookings(booking_reference, customer_name, customer_phone, wilaya, commune, address, start_at, end_at, total_price_dzd, total_duration) VALUES('TEST-OVERLAP-B','Test B','0555000002','Alger','Hydra','Test address',$1,$2,100,60)", ['2099-12-01T09:30:00Z', '2099-12-01T10:30:00Z']), (error: { code?: string }) => error.code === '23P01');
    await client.query('ROLLBACK');
  } finally { client.release(); await pool.end(); }
});

test('PostgreSQL serializes concurrent overlapping booking requests', async (t) => {
  if (!connectionString) { t.skip('DATABASE_URL is not configured'); return; }
  const pool = new Pool({ connectionString });
  const clients = await Promise.all([pool.connect().catch(() => null), pool.connect().catch(() => null)]);
  if (clients.some((client) => !client)) { t.skip('PostgreSQL is not reachable'); for (const client of clients) client?.release(); await pool.end(); return; }
  const [first, second] = clients as [NonNullable<typeof clients[0]>, NonNullable<typeof clients[1]>];
  const insert = (client: typeof first, reference: string) => client.query("INSERT INTO bookings(booking_reference, customer_name, customer_phone, wilaya, commune, address, start_at, end_at, total_price_dzd, total_duration) VALUES($1,'Concurrent Test','0555000003','Alger','Hydra','Test address','2099-12-02T09:00:00Z','2099-12-02T10:00:00Z',100,60)", [reference]);
  try {
    await Promise.all([first.query('BEGIN'), second.query('BEGIN')]);
    await insert(first, 'TEST-CONCURRENT-A');
    const competingInsert = insert(second, 'TEST-CONCURRENT-B');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await first.query('COMMIT');
    const competingOutcome = await Promise.allSettled([competingInsert, second.query('COMMIT')]);
    assert.equal(competingOutcome.some((result) => result.status === 'rejected'), true, 'the competing transaction must be rejected by the exclusion constraint');
    const count = await pool.query("SELECT COUNT(*)::int AS count FROM bookings WHERE booking_reference IN ('TEST-CONCURRENT-A','TEST-CONCURRENT-B')");
    assert.equal(count.rows[0].count, 1);
  } finally {
    await pool.query("DELETE FROM bookings WHERE booking_reference IN ('TEST-CONCURRENT-A','TEST-CONCURRENT-B')");
    first.release(); second.release(); await pool.end();
  }
});
