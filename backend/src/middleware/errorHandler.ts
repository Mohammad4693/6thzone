import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'خطای سرور' });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'مسیر یافت نشد' });
}
