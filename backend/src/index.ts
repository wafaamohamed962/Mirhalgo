import { createApp } from './app.js';
import { config } from './config.js';
import { startCleanupSchedule } from './services/cleanup.js';
import { verifyMailTransport } from './services/mail/index.js';

createApp().listen(config.PORT, () => {
  console.log(`MirhalGo API listening on http://localhost:${config.PORT}`);
  verifyMailTransport();
  startCleanupSchedule(); // orphan uploads, old drafts, unverified companies (hourly)
});
