import { storage } from './storage';

export type Service = { id: string; name: string; desc: string; price: number; duration: number; image?: string; isActive?: boolean };
export type BookingInput = { serviceIds: string[]; startAt: string; customerName: string; customerPhone: string; wilaya: string; commune: string; address: string; additionalNotes?: string; deviceId?: string };
export type BookingDetail = {
  id: string;
  bookingReference: string;
  customerName: string;
  customerPhone: string;
  wilaya: string;
  commune: string;
  address: string;
  additionalNotes?: string | null;
  startAt: string;
  endAt: string;
  totalPrice: number;
  duration: number;
  status: string;
  services: Array<{ id?: string; name: string; price: number; duration: number }>;
  history: unknown[];
};

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
if (!configuredUrl) throw new Error('EXPO_PUBLIC_API_URL is required to connect to the Mahdi API');
if (/localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(configuredUrl)) throw new Error('EXPO_PUBLIC_API_URL must not point to a development-only address');
const baseUrl = configuredUrl.replace(/\/$/, '');
const tokenKey = 'mahdi.auth.token';
const requestTimeoutMs = 15_000;

function friendlyError(status: number, serverMessage?: string): string {
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous.';
  if (status === 403) return 'Vous n’avez pas accès à cette action.';
  if (status === 429) return 'Trop de tentatives. Patientez un instant avant de réessayer.';
  if (status >= 500) return 'Le service est momentanément indisponible. Réessayez dans un instant.';
  return serverMessage || 'La requête n’a pas pu aboutir. Réessayez.';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await storage.get(tokenKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({})) as { error?: string; requestId?: string };
    if (!response.ok) throw new Error(friendlyError(response.status, data.error));
    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Le serveur met trop de temps à répondre');
    if (error instanceof TypeError) throw new Error('Connexion réseau impossible. Vérifiez votre connexion Internet.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const normalizeBookingDetail = (row: any): BookingDetail => ({
  id: row.id,
  bookingReference: row.bookingReference ?? row.booking_reference,
  customerName: row.customerName ?? row.customer_name,
  customerPhone: row.customerPhone ?? row.customer_phone,
  wilaya: row.wilaya,
  commune: row.commune,
  address: row.address,
  additionalNotes: row.additionalNotes ?? row.additional_notes,
  startAt: row.startAt ?? row.start_at,
  endAt: row.endAt ?? row.end_at,
  totalPrice: row.totalPrice ?? row.total_price_dzd,
  duration: row.duration ?? row.total_duration,
  status: row.status,
  services: row.services || [],
  history: row.history || [],
});

export const api = {
  baseUrl,
  services: () => request<Service[]>('/api/services'),
  availability: (date: string, duration: number) => request<{ date: string; slots: string[]; taken: string[] }>(`/api/availability?date=${encodeURIComponent(date)}&duration=${duration}`),
  login: async (phone: string, password: string) => { const result = await request<{ token: string; user: { role: string } }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: phone.replace(/\s/g, ''), password }) }); await storage.set(tokenKey, result.token); return result; },
  logout: () => storage.remove(tokenKey),
  createBooking: (input: BookingInput) => request<{ bookingReference: string; startAt: string; totalPrice: number; duration: number; status: 'PENDING' | string }>('/api/bookings', { method: 'POST', body: JSON.stringify(input) }),
  bookings: ({ phone, deviceId }: { phone?: string; deviceId?: string }) => { const params = new URLSearchParams(); if (phone) params.set('phone', phone.replace(/\s/g, '')); if (deviceId) params.set('deviceId', deviceId); return request<any[]>(`/api/bookings?${params.toString()}`); },
  dashboard: () => request<Record<string, number>>('/api/admin/dashboard'),
  adminBookings: () => request<any[]>('/api/admin/bookings'),
  bookingDetail: async (id: string) => normalizeBookingDetail(await request<any>(`/api/admin/bookings/${id}`)),
  updateBookingStatus: (id: string, status: string) => request(`/api/admin/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  adminServices: () => request<Service[]>('/api/admin/services'),
  createService: (input: { name: string; description: string; priceDzd: number; durationMinutes: number; imageUrl?: string; isActive?: boolean }) => request('/api/admin/services', { method: 'POST', body: JSON.stringify(input) }),
  updateService: (id: string, input: Partial<{ name: string; description: string; priceDzd: number; durationMinutes: number; imageUrl: string; isActive: boolean }>) => request(`/api/admin/services/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deactivateService: (id: string) => request(`/api/admin/services/${id}`, { method: 'DELETE' }),
  workingHours: () => request('/api/working-hours'),
  updateWorkingHours: (input: unknown[]) => request('/api/admin/working-hours', { method: 'PUT', body: JSON.stringify(input) }),
  blockedSlots: () => request('/api/admin/blocked-slots'),
  addBlockedSlot: (input: { startAt: string; endAt: string; reason?: string }) => request('/api/admin/blocked-slots', { method: 'POST', body: JSON.stringify(input) }),
  removeBlockedSlot: (id: string) => request(`/api/admin/blocked-slots/${id}`, { method: 'DELETE' }),
  notifications: () => request('/api/notifications'),
  adminNotifications: () => request<any[]>('/api/admin/notifications'),
  registerDevice: (deviceToken: string, platform: 'android' | 'ios' | 'web') => request('/api/notifications/register-device', { method: 'POST', body: JSON.stringify({ deviceToken, platform }) }),
};
