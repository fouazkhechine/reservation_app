import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { canTransition, calculateTotals } from './domain.js';
import { isValidAlgerianPhone, isValidExpoPushToken } from './validation.js';
import { createCorsOptions, parseCorsOrigins } from './cors-policy.js';

const app = express();
const httpServer = createServer(app);
const sockets = new WebSocketServer({ server: httpServer, path: '/ws' });
const broadcast = (type: 'services' | 'bookings' | 'availability') => {
  const payload = JSON.stringify({ type });
  for (const socket of sockets.clients) if (socket.readyState === 1) socket.send(payload);
};
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : 'development-only-change-me');
const PORT = Number(process.env.PORT || 3000);
const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN, isProduction);
if (isProduction && (!databaseUrl || JWT_SECRET.length < 32 || !process.env.ADMIN_PHONE || !process.env.ADMIN_PASSWORD)) {
  throw new Error('Production configuration requires DATABASE_URL, a 32+ character JWT_SECRET, and admin credentials');
}
const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
});
const log = (event: string, fields: Record<string, unknown> = {}) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), service: 'mahdi-api', event, ...fields }));
const error = (status: number, message: string) => Object.assign(new Error(message), { status });

type AuthRequest = Request & { user?: { id: string; role: 'CUSTOMER' | 'ADMIN' } };
const asyncRoute = (handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => handler(req as AuthRequest, res, next).catch(next);
const issueToken = (user: { id: string; role: 'CUSTOMER' | 'ADMIN' }) => jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
const serviceSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).default(''), priceDzd: z.number().int().nonnegative(), durationMinutes: z.number().int().positive().max(480), imageUrl: z.string().url().optional(), isActive: z.boolean().default(true) });
const serviceUpdateSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500), priceDzd: z.number().int().nonnegative(), durationMinutes: z.number().int().positive().max(480), imageUrl: z.string().url(), isActive: z.boolean() }).partial();
const workingHoursSchema = z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), openingTime: z.string().regex(/^\d{2}:\d{2}$/), closingTime: z.string().regex(/^\d{2}:\d{2}$/), isOpen: z.boolean() }).superRefine((item, ctx) => { if (item.isOpen && item.openingTime >= item.closingTime) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Les heures d’ouverture doivent précéder la fermeture' }); })).length(7);
const blockedSlotSchema = z.object({ startAt: z.string().datetime(), endAt: z.string().datetime(), reason: z.string().trim().max(200).default('') });

async function notifyUsers(userIds: string[], bookingId: string | null, title: string, body: string, type: string) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return;
  const tokens = (await pool.query('SELECT user_id, device_token FROM device_tokens WHERE user_id = ANY($1::uuid[])', [ids])).rows;
  for (const userId of ids) {
    const userTokens = tokens.filter((token) => token.user_id === userId);
    if (!userTokens.length) {
      await pool.query('INSERT INTO notifications(user_id, booking_id, title, body, type, provider, status) VALUES($1,$2,$3,$4,$5,$6,$7)', [userId, bookingId, title, body, type, 'none', 'SKIPPED']);
      continue;
    }
    const notification = (await pool.query('INSERT INTO notifications(user_id, booking_id, title, body, type, provider, status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [userId, bookingId, title, body, type, 'expo', 'PENDING'])).rows[0];
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) }, body: JSON.stringify(userTokens.map((token) => ({ to: token.device_token, title, body, data: { bookingId, type } }))) });
      const result = await response.json() as { data?: Array<{ status: string; id?: string; message?: string }> };
      const tickets = result.data || [];
      const succeeded = response.ok && tickets.length === userTokens.length && tickets.every((ticket) => ticket.status === 'ok');
      await pool.query('UPDATE notifications SET status = $1, provider_receipt_id = $2, error_message = $3, sent_at = CASE WHEN $1 = \'SENT\' THEN now() ELSE NULL END WHERE id = $4', [succeeded ? 'SENT' : 'FAILED', tickets.map((ticket) => ticket.id).filter(Boolean).join(','), succeeded ? null : tickets.map((ticket) => ticket.message).filter(Boolean).join('; ') || `HTTP ${response.status}`, notification.id]);
    } catch (notificationError) { await pool.query('UPDATE notifications SET status = \'FAILED\', error_message = $1 WHERE id = $2', [notificationError instanceof Error ? notificationError.message : 'Provider indisponible', notification.id]); }
  }
}

app.use(helmet());
app.use(cors(createCorsOptions(corsOrigins)));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true }));
app.use((req, res, next) => { const requestId = req.header('x-request-id') || randomUUID(); const started = Date.now(); res.setHeader('x-request-id', requestId); res.on('finish', () => log('http_request', { requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - started })); next(); });
app.get('/health', (_req, res) => res.json({ ok: true, service: 'mahdi-api' }));
app.get('/ready', asyncRoute(async (_req, res) => { await pool.query('SELECT 1'); res.json({ ok: true, database: 'ready' }); }));

app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) { next(); return; }
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    if (req.path.startsWith('/api/admin/services')) broadcast('services');
    else if (req.path.startsWith('/api/admin/working-hours') || req.path.startsWith('/api/admin/blocked-slots')) broadcast('availability');
    else if (req.path.startsWith('/api/bookings') || req.path.startsWith('/api/admin/bookings')) broadcast('bookings');
  });
  next();
});

const requireAuth = asyncRoute(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw error(401, 'Authentification requise');
  try { req.user = jwt.verify(header.slice(7), JWT_SECRET) as AuthRequest['user']; next(); }
  catch { throw error(401, 'Session expirée'); }
});
const requireAdmin = asyncRoute(async (req, _res, next) => { if (req.user?.role !== 'ADMIN') throw error(403, 'Accès administrateur requis'); next(); });

const phoneSchema = z.string().trim().refine(isValidAlgerianPhone, 'Numéro algérien invalide');
const loginSchema = z.object({ phone: phoneSchema, password: z.string().min(6) });
const bookingSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1), startAt: z.string().datetime(),
  customerName: z.string().trim().min(2).max(120), customerPhone: phoneSchema,
  wilaya: z.string().trim().min(2).max(80), commune: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(300), additionalNotes: z.string().trim().max(500).optional(),
  deviceId: z.string().trim().min(8).max(128).optional()
});
const isoDay = (value: string) => new Date(value).getUTCDay();

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await pool.query('SELECT id, full_name, phone, role, password_hash FROM users WHERE phone = $1', [input.phone.replace(/\s/g, '')]);
  const user = result.rows[0];
  if (!user || !user.password_hash || !(await bcrypt.compare(input.password, user.password_hash))) throw error(401, 'Identifiants invalides');
  res.json({ token: issueToken({ id: user.id, role: user.role }), user: { id: user.id, fullName: user.full_name, phone: user.phone, role: user.role } });
}));
app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const result = await pool.query('SELECT id, full_name, phone, role FROM users WHERE id = $1', [req.user!.id]);
  if (!result.rows[0]) throw error(404, 'Utilisateur introuvable');
  res.json(result.rows[0]);
}));

app.get('/api/services', asyncRoute(async (_req, res) => {
  const result = await pool.query('SELECT id, name, description AS desc, price_dzd AS price, duration_minutes AS duration, image_url AS image, is_active AS "isActive" FROM services WHERE is_active = true ORDER BY created_at');
  res.json(result.rows);
}));
app.get('/api/working-hours', asyncRoute(async (_req, res) => { res.json((await pool.query('SELECT day_of_week AS "dayOfWeek", opening_time AS "openingTime", closing_time AS "closingTime", is_open AS "isOpen" FROM working_hours ORDER BY day_of_week')).rows); }));
app.get('/api/admin/services', requireAuth, requireAdmin, asyncRoute(async (_req, res) => { res.json((await pool.query('SELECT id, name, description, price_dzd AS "priceDzd", duration_minutes AS "durationMinutes", image_url AS "imageUrl", is_active AS "isActive" FROM services ORDER BY created_at')).rows); }));
app.post('/api/admin/services', requireAuth, requireAdmin, asyncRoute(async (req, res) => { const input = serviceSchema.parse(req.body); const result = await pool.query('INSERT INTO services(name, description, price_dzd, duration_minutes, image_url, is_active) VALUES($1,$2,$3,$4,$5,$6) RETURNING id, name, description, price_dzd AS "priceDzd", duration_minutes AS "durationMinutes", image_url AS "imageUrl", is_active AS "isActive"', [input.name, input.description, input.priceDzd, input.durationMinutes, input.imageUrl || null, input.isActive]); res.status(201).json(result.rows[0]); }));
app.put('/api/admin/services/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => { const input = serviceUpdateSchema.parse(req.body); const result = await pool.query('UPDATE services SET name = COALESCE($1,name), description = COALESCE($2,description), price_dzd = COALESCE($3,price_dzd), duration_minutes = COALESCE($4,duration_minutes), image_url = COALESCE($5,image_url), is_active = COALESCE($6,is_active), updated_at = now() WHERE id = $7 RETURNING id, name, description, price_dzd AS "priceDzd", duration_minutes AS "durationMinutes", image_url AS "imageUrl", is_active AS "isActive"', [input.name, input.description, input.priceDzd, input.durationMinutes, input.imageUrl, input.isActive, req.params.id]); if (!result.rows[0]) throw error(404, 'Service introuvable'); res.json(result.rows[0]); }));
app.delete('/api/admin/services/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => { const result = await pool.query('UPDATE services SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id', [req.params.id]); if (!result.rows[0]) throw error(404, 'Service introuvable'); res.status(204).send(); }));
app.put('/api/admin/working-hours', requireAuth, requireAdmin, asyncRoute(async (req, res) => { const input = workingHoursSchema.parse(req.body); const client = await pool.connect(); try { await client.query('BEGIN'); for (const item of input) await client.query('INSERT INTO working_hours(day_of_week, opening_time, closing_time, is_open) VALUES($1,$2,$3,$4) ON CONFLICT(day_of_week) DO UPDATE SET opening_time = EXCLUDED.opening_time, closing_time = EXCLUDED.closing_time, is_open = EXCLUDED.is_open', [item.dayOfWeek, item.openingTime, item.closingTime, item.isOpen]); await client.query('COMMIT'); res.json({ ok: true }); } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); } }));
app.get('/api/admin/blocked-slots', requireAuth, requireAdmin, asyncRoute(async (_req, res) => { res.json((await pool.query('SELECT id, start_at AS "startAt", end_at AS "endAt", reason FROM blocked_slots ORDER BY start_at')).rows); }));
app.post('/api/admin/blocked-slots', requireAuth, requireAdmin, asyncRoute(async (req, res) => { const input = blockedSlotSchema.parse(req.body); if (new Date(input.endAt) <= new Date(input.startAt)) throw error(400, 'Intervalle invalide'); const result = await pool.query('INSERT INTO blocked_slots(start_at, end_at, reason) VALUES($1,$2,$3) RETURNING id, start_at AS "startAt", end_at AS "endAt", reason', [input.startAt, input.endAt, input.reason]); res.status(201).json(result.rows[0]); }));
app.delete('/api/admin/blocked-slots/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => { await pool.query('DELETE FROM blocked_slots WHERE id = $1', [req.params.id]); res.status(204).send(); }));

app.get('/api/availability', asyncRoute(async (req, res) => {
  const date = z.string().date().parse(req.query.date);
  const duration = z.coerce.number().int().positive().max(480).parse(req.query.duration);
  const hours = (await pool.query('SELECT opening_time, closing_time, is_open FROM working_hours WHERE day_of_week = $1', [new Date(`${date}T12:00:00Z`).getUTCDay()])).rows[0];
  if (!hours?.is_open) { res.json({ date, slots: [], taken: [] }); return; }
  const bookings = (await pool.query("SELECT start_at, end_at FROM bookings WHERE status IN ('PENDING','CONFIRMED','IN_PROGRESS') AND start_at::date = $1", [date])).rows;
  const blocked = (await pool.query('SELECT start_at, end_at FROM blocked_slots WHERE start_at::date <= $1 AND end_at::date >= $1', [date])).rows;
  const slots: string[] = [];
  const taken = new Set<string>();
  const [oh, om] = String(hours.opening_time).slice(0, 5).split(':').map(Number);
  const [ch, cm] = String(hours.closing_time).slice(0, 5).split(':').map(Number);
  for (let minute = oh * 60 + om; minute + duration <= ch * 60 + cm; minute += 30) {
    const start = new Date(`${date}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00Z`);
    const end = new Date(start.getTime() + duration * 60000);
    const overlapsBooking = bookings.some((item) => new Date(item.start_at) < end && new Date(item.end_at) > start);
    const overlapsBlocked = blocked.some((item) => new Date(item.start_at) < end && new Date(item.end_at) > start);
    if (!overlapsBooking && !overlapsBlocked && start.getTime() > Date.now()) slots.push(start.toISOString());
    else if (overlapsBooking) taken.add(start.toISOString());
  }
  res.json({ date, slots, taken: [...taken] });
}));

app.post('/api/bookings', asyncRoute(async (req, res) => {
  const input = bookingSchema.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const services = (await client.query('SELECT id, name, price_dzd, duration_minutes FROM services WHERE id = ANY($1::uuid[]) AND is_active = true', [input.serviceIds])).rows;
    if (services.length !== new Set(input.serviceIds).size) throw error(400, 'Un service sélectionné est indisponible');
    const { price: totalPrice, duration: totalDuration } = calculateTotals(services);
    const start = new Date(input.startAt); const end = new Date(start.getTime() + totalDuration * 60000);
    const day = await client.query('SELECT opening_time, closing_time, is_open FROM working_hours WHERE day_of_week = $1', [isoDay(input.startAt)]);
    if (!day.rows[0]?.is_open) throw error(409, 'Le barber est fermé à cette date');
    const hours = day.rows[0];
    const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
    const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
    const openingMinutes = Number(String(hours.opening_time).slice(0, 2)) * 60 + Number(String(hours.opening_time).slice(3, 5));
    const closingMinutes = Number(String(hours.closing_time).slice(0, 2)) * 60 + Number(String(hours.closing_time).slice(3, 5));
    if (startMinutes < openingMinutes || endMinutes > closingMinutes) throw error(409, 'Le créneau dépasse les heures de travail');
    const blocked = await client.query('SELECT 1 FROM blocked_slots WHERE start_at < $1 AND end_at > $2 LIMIT 1', [end, start]);
    if (blocked.rowCount) throw error(409, 'Ce créneau est bloqué');
    const ref = `MH-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const booking = (await client.query(`INSERT INTO bookings (booking_reference, customer_name, customer_phone, wilaya, commune, address, additional_notes, start_at, end_at, total_price_dzd, total_duration, device_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, booking_reference AS "bookingReference", start_at AS "startAt", end_at AS "endAt", total_price_dzd AS "totalPrice", total_duration AS duration, status`, [ref, input.customerName, input.customerPhone.replace(/\s/g, ''), input.wilaya, input.commune, input.address, input.additionalNotes || null, start, end, totalPrice, totalDuration, input.deviceId || null])).rows[0];
    for (const service of services) await client.query('INSERT INTO booking_services (booking_id, service_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot) VALUES ($1,$2,$3,$4,$5)', [booking.id, service.id, service.name, service.price_dzd, service.duration_minutes]);
    await client.query('INSERT INTO booking_status_history (booking_id, new_status) VALUES ($1, $2)', [booking.id, 'PENDING']);
    await client.query('COMMIT');
    const admins = (await pool.query("SELECT id FROM users WHERE role = 'ADMIN'")).rows.map((row) => row.id);
    await notifyUsers(admins, booking.id, 'Nouvelle réservation', `${input.customerName} · ${ref}`, 'BOOKING_CREATED');
    res.status(201).json({ ...booking, services });
  } catch (e) { await client.query('ROLLBACK'); if ((e as { code?: string }).code === '23P01') throw error(409, 'Ce créneau est déjà réservé. Choisissez un autre horaire.'); throw e; }
  finally { client.release(); }
}));

app.get('/api/bookings', asyncRoute(async (req, res) => {
  const phone = req.query.phone?.toString();
  const deviceId = req.query.deviceId?.toString();
  const isAdmin = req.user?.role === 'ADMIN';
  if (!isAdmin && !phone && !deviceId) throw error(400, 'Téléphone ou appareil requis');
  const result = await pool.query(`SELECT b.id, b.booking_reference AS "bookingReference", b.customer_name AS "customerName", b.customer_phone AS "customerPhone", b.start_at AS "startAt", b.end_at AS "endAt", b.total_price_dzd AS "totalPrice", b.total_duration AS duration, b.status, COALESCE(json_agg(json_build_object('name', bs.service_name_snapshot, 'price', bs.service_price_snapshot)) FILTER (WHERE bs.id IS NOT NULL), '[]') AS services FROM bookings b LEFT JOIN booking_services bs ON bs.booking_id = b.id WHERE ($2::text = 'ADMIN') OR ($1::text IS NOT NULL AND b.customer_phone = $1::text) OR ($3::text IS NOT NULL AND b.device_id = $3::text) GROUP BY b.id ORDER BY b.start_at DESC`, [phone || null, req.user?.role || null, deviceId || null]);
  res.json(result.rows);
}));
app.get('/api/admin/bookings/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const result = await pool.query(`SELECT b.*, COALESCE(json_agg(json_build_object('id', bs.service_id, 'name', bs.service_name_snapshot, 'price', bs.service_price_snapshot, 'duration', bs.service_duration_snapshot)) FILTER (WHERE bs.id IS NOT NULL), '[]') AS services, COALESCE((SELECT json_agg(h ORDER BY h.created_at) FROM booking_status_history h WHERE h.booking_id = b.id), '[]') AS history FROM bookings b LEFT JOIN booking_services bs ON bs.booking_id = b.id WHERE b.id = $1 GROUP BY b.id`, [req.params.id]);
  if (!result.rows[0]) throw error(404, 'Réservation introuvable');
  res.json(result.rows[0]);
}));

app.get('/api/admin/dashboard', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  const result = await pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE start_at::date = CURRENT_DATE)::int AS today, COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending, COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed, COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress, COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed, COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled, COALESCE(SUM(total_price_dzd) FILTER (WHERE status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')), 0)::int AS revenue FROM bookings`);
  res.json(result.rows[0]);
}));
app.get('/api/admin/bookings', requireAuth, requireAdmin, asyncRoute(async (_req, res) => { res.json((await pool.query(`SELECT id, booking_reference AS "bookingReference", customer_name AS "customerName", customer_phone AS "customerPhone", commune, address, start_at AS "startAt", end_at AS "endAt", total_price_dzd AS "totalPrice", total_duration AS duration, status FROM bookings ORDER BY start_at DESC`)).rows); }));
app.patch('/api/admin/bookings/:id/status', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const nextStatus = z.object({ status: z.enum(['CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED']) }).parse(req.body).status;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = (await client.query('SELECT status, customer_id, booking_reference FROM bookings WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!current) throw error(404, 'Réservation introuvable');
    if (!canTransition(current.status, nextStatus)) throw error(409, 'Transition de statut invalide');
    const updated = (await client.query('UPDATE bookings SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status', [nextStatus, req.params.id])).rows[0];
    await client.query('INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by) VALUES ($1,$2,$3,$4)', [req.params.id, current.status, nextStatus, req.user!.id]);
    await client.query('COMMIT');
    if (current.customer_id) await notifyUsers([current.customer_id], String(req.params.id), nextStatus === 'CONFIRMED' ? 'Réservation confirmée' : 'Mise à jour de réservation', `${current.booking_reference} · ${nextStatus}`, 'BOOKING_STATUS_CHANGED');
    res.json(updated);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));
app.post('/api/notifications/register-device', requireAuth, asyncRoute(async (req, res) => { const body = z.object({ deviceToken: z.string().refine(isValidExpoPushToken, 'Jeton Expo invalide'), platform: z.enum(['android','ios','web']) }).parse(req.body); await pool.query('INSERT INTO device_tokens(user_id, device_token, platform) VALUES($1,$2,$3) ON CONFLICT(device_token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform', [req.user!.id, body.deviceToken, body.platform]); res.status(201).json({ ok: true }); }));
app.get('/api/notifications', requireAuth, asyncRoute(async (req, res) => { res.json((await pool.query('SELECT id, title, body, type, status, error_message AS "errorMessage", created_at AS "createdAt", sent_at AS "sentAt" FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user!.id])).rows); }));
app.get('/api/admin/notifications', requireAuth, requireAdmin, asyncRoute(async (_req, res) => { res.json((await pool.query('SELECT n.id, n.title, n.body, n.type, n.status, n.error_message AS "errorMessage", n.created_at AS "createdAt", u.full_name AS "userName" FROM notifications n LEFT JOIN users u ON u.id = n.user_id ORDER BY n.created_at DESC LIMIT 200')).rows); }));

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => { const status = (err as { status?: number }).status || (err instanceof z.ZodError ? 400 : 500); const requestId = res.getHeader('x-request-id'); const message = err instanceof z.ZodError ? err.issues[0]?.message || 'Données invalides' : (err as Error).message || 'Erreur serveur'; if (status >= 500) log('http_error', { requestId, method: req.method, path: req.path, error: message }); res.status(status).json(isProduction && status >= 500 ? { error: 'Erreur serveur', requestId } : { error: message, requestId }); });

async function ensureAdmin() { const phone = (process.env.ADMIN_PHONE || '0550241818').replace(/\s/g, ''); const password = process.env.ADMIN_PASSWORD || 'change-me'; const hash = await bcrypt.hash(password, 12); await pool.query(`INSERT INTO users(full_name, phone, password_hash, role) VALUES ('Mahdi Barber', $1, $2, 'ADMIN') ON CONFLICT(phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'ADMIN'`, [phone, hash]); }
async function start() { await ensureAdmin(); const server = httpServer.listen(PORT, () => log('server_started', { port: PORT, environment: process.env.NODE_ENV || 'development' })); const shutdown = async (signal: string) => { log('server_shutdown', { signal }); for (const socket of sockets.clients) socket.close(); sockets.close(); server.close(async () => { await pool.end(); process.exit(0); }); }; process.once('SIGTERM', () => void shutdown('SIGTERM')); process.once('SIGINT', () => void shutdown('SIGINT')); }
start().catch((startupError) => { log('startup_failed', { error: startupError instanceof Error ? startupError.message : String(startupError) }); process.exitCode = 1; });
