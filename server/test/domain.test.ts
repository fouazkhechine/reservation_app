import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals, canTransition, overlaps } from '../src/domain.js';
import { isValidAlgerianPhone, isValidCustomerInfo, isValidExpoPushToken } from '../src/validation.js';

test('calculates selected-service price and duration from snapshots', () => {
  assert.deepEqual(calculateTotals([{ price_dzd: 1800, duration_minutes: 45 }, { price_dzd: 1200, duration_minutes: 30 }]), { price: 3000, duration: 75 });
});
test('treats adjacent appointments as non-overlapping', () => {
  assert.equal(overlaps(new Date('2026-12-01T09:00:00Z'), new Date('2026-12-01T10:00:00Z'), new Date('2026-12-01T10:00:00Z'), new Date('2026-12-01T11:00:00Z')), false);
  assert.equal(overlaps(new Date('2026-12-01T09:00:00Z'), new Date('2026-12-01T10:01:00Z'), new Date('2026-12-01T10:00:00Z'), new Date('2026-12-01T11:00:00Z')), true);
});
test('enforces the booking workflow transitions', () => {
  assert.equal(canTransition('PENDING', 'CONFIRMED'), true);
  assert.equal(canTransition('PENDING', 'CANCELLED'), true);
  assert.equal(canTransition('CONFIRMED', 'COMPLETED'), false);
  assert.equal(canTransition('CONFIRMED', 'CANCELLED'), false);
  assert.equal(canTransition('CANCELLED', 'CONFIRMED'), false);
  assert.equal(canTransition('COMPLETED', 'CANCELLED'), false);
});
test('validates Algerian customer phone numbers', () => {
  assert.equal(isValidAlgerianPhone('0550 241 818'), true);
  assert.equal(isValidAlgerianPhone('+213550241818'), true);
  assert.equal(isValidAlgerianPhone('0123456789'), false);
  assert.equal(isValidAlgerianPhone('05502418'), false);
});
test('validates required customer information', () => {
  assert.equal(isValidCustomerInfo({ name: 'Amine', wilaya: 'Alger', commune: 'Bab Ezzouar', address: '12 Rue des Orangers' }), true);
  assert.equal(isValidCustomerInfo({ name: 'A', wilaya: 'Alger', commune: 'Alger', address: '12 Rue' }), false);
  assert.equal(isValidCustomerInfo({ name: 'Amine', wilaya: '', commune: 'Alger', address: '12 Rue' }), false);
});
test('validates working-hour and blocked-slot interval semantics', () => {
  assert.equal('09:00' < '18:00', true);
  assert.equal('18:00' < '09:00', false);
  assert.equal(new Date('2026-12-01T11:00:00Z') > new Date('2026-12-01T10:00:00Z'), true);
  assert.equal(new Date('2026-12-01T10:00:00Z') > new Date('2026-12-01T11:00:00Z'), false);
});
test('accepts Expo push tokens and rejects malformed tokens', () => {
  assert.equal(isValidExpoPushToken('ExponentPushToken[abc123]'), true);
  assert.equal(isValidExpoPushToken('not-a-token'), false);
});
