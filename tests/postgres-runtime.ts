// Isolated test runtime, never imported by the production application.
export const env = (globalThis as any).__reperePostgresTest;
export const resolveAccount = undefined;
