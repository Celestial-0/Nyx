/**
 * Zod schemas + inferred TypeScript types for the Nyx native client.
 *
 * Every domain lives in its own module; schemas are the single source of truth
 * and TS types are derived via `z.infer`. Import from here (`@/types`) rather
 * than the individual files.
 */
export * from './common';
export * from './e2ee';
export * from './auth';
export * from './user';
export * from './rooms';
export * from './chat';
export * from './contacts';
export * from './dm';
export * from './payments';
