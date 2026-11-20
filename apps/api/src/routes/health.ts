import { Router } from 'express';
import type { ApiResponse } from '@mirhalgo/shared';

export const healthRouter = Router();

// GET /api/health (section 7)
healthRouter.get('/', (_req, res) => {
  const body: ApiResponse<{ status: string; time: string }> = {
    ok: true,
    data: { status: 'up', time: new Date().toISOString() },
  };
  res.json(body);
});
