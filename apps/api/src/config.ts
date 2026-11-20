import { envSchema, type Env } from './schemas/env.js';

function loadConfig(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Only variable names and rule messages: never print values (secrets).
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    console.error(
      `Invalid API environment. Fill apps/api/.env (see .env.example):\n${problems.join('\n')}`,
    );
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();
