import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { HttpError, errorHandler, notFound } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { companiesRouter } from './routes/companies.js';
import { contactRouter } from './routes/contact.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { referenceRouter } from './routes/reference.js';

/** Express app (no listen), so tests can run it in-process. */
export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render runs behind one proxy: needed for real client IPs
  app.disable('x-powered-by');

  // Spec section 5: helmet, strict CORS allowlist, JSON body limit 10kb
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        // allow non-browser requests (no Origin header), e.g. health checks
        if (!origin || config.CORS_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new HttpError(403, 'CORS_NOT_ALLOWED', 'Origin not allowed'));
      },
    }),
  );
  app.use(express.json({ limit: '10kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/companies', companiesRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/reference', referenceRouter);
  app.use('/api/me', meRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
