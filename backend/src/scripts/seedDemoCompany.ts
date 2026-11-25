import { config } from '../config.js';
import { parseSeedInput, runSeed, SeedError } from '../services/demoCompany.js';

/**
 * `npm run seed:demo-company -w backend [-- --yes] [--reset-password] [--remove]`
 * Development / staging only (MW_004 A2). Without --yes: a dry run that touches nothing.
 * The password comes from DEMO_COMPANY_PASSWORD and is never printed.
 */
const projectRef = new URL(config.SUPABASE_URL).hostname.split('.')[0] ?? 'unknown';

try {
  const input = parseSeedInput(process.argv.slice(2), process.env, config.NODE_ENV);
  for (const line of await runSeed(input, projectRef)) console.log(`seed:demo-company: ${line}`);
} catch (error) {
  if (!(error instanceof SeedError)) throw error;
  console.error(`seed:demo-company: ${error.message}`);
  process.exitCode = 1;
}
