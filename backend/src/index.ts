import { createApp } from './app.js';
import { config } from './config.js';
import { verifyMailTransport } from './services/mail/index.js';

createApp().listen(config.PORT, () => {
  console.log(`MirhalGo API listening on http://localhost:${config.PORT}`);
  verifyMailTransport();
});
