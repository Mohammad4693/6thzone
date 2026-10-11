import crypto from 'crypto';

export const CODE_EXPIRY_MINUTES = 2;
export const MAX_ATTEMPTS = 5;

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function normalizeIranPhone(phone: string): string {
  let p = phone.replace(/\s/g, '').replace(/-/g, '');
  if (p.startsWith('0098')) p = '+' + p.slice(4);
  else if (p.startsWith('98') && !p.startsWith('+')) p = '+' + p;
  else if (p.startsWith('09')) p = '+98' + p.slice(1);
  else if (p.startsWith('9') && p.length === 10) p = '+98' + p;
  return p;
}

export function isValidIranPhone(phone: string): boolean {
  const normalized = normalizeIranPhone(phone);
  return /^\+989\d{9}$/.test(normalized);
}
