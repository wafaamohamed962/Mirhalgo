import { runCleanup } from '../services/cleanup.js';

/** `npm run cleanup`: orphan uploads (24 h), expired drafts (30 days), company applications (7 days). */
const result = await runCleanup();
console.log(
  `cleanup: removed ${result.uploads} upload(s), ${result.drafts} draft(s), ${result.companies} company application(s)`,
);
