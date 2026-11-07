export const authClient=async()=>(globalThis as any).__authFixture.client;
export const adminClient=()=>(globalThis as any).__authFixture.admin;
export const siteUrl=()=>'https://repere.test';
