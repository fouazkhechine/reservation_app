export type BookableService = { price_dzd: number; duration_minutes: number };
export function calculateTotals(services: BookableService[]) {
  return services.reduce((totals, service) => ({ price: totals.price + service.price_dzd, duration: totals.duration + service.duration_minutes }), { price: 0, duration: 0 });
}
export const validTransitions: Record<string, string[]> = { PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'], CONFIRMED: [], IN_PROGRESS: [], COMPLETED: [], CANCELLED: [], REJECTED: [] };
export function canTransition(from: string, to: string) { return validTransitions[from]?.includes(to) ?? false; }
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) { return aStart < bEnd && aEnd > bStart; }
