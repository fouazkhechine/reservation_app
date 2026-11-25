export function normalizePhone(phone: string) { return phone.replace(/\s/g, ''); }
export function isValidAlgerianPhone(phone: string) { return /^(?:\+213|0)(?:5|6|7)\d{8}$/.test(normalizePhone(phone)); }
export function isValidCustomerInfo(input: { name?: string; wilaya?: string; commune?: string; address?: string }) {
  return Boolean(input.name?.trim() && input.name.trim().length >= 2 && input.wilaya?.trim() && input.commune?.trim() && input.address?.trim() && input.address.trim().length >= 5);
}
export function isValidExpoPushToken(token: string) { return /^(?:ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token); }
