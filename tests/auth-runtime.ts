import {accountForUser} from '../lib/auth/accounts';
export const env=(globalThis as any).__reperePostgresTest;
export const resolveAccount=async()=>accountForUser((globalThis as any).__authFixture.user,env.DB);
