export type Account = { role: string; studentId: string; userId: string | null; viewerKey: string };
export const normalEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
export function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function strongPassword(value: unknown): value is string { return typeof value === 'string' && value.length >= 12 && value.length <= 128; }
export function permitsRole(account: Account | null, requested: unknown) { return !!account && (requested === 'teacher' || requested === 'parent') && account.role === requested; }
export function safeNext(value: string | null) { return value === '/auth/password' ? value : '/'; }
