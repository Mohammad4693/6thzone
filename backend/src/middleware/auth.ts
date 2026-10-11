import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userPhone?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'seraj-dev-secret-change-me';

export function generateToken(userId: string, role: string, phone: string): string {
  return jwt.sign({ userId, role, phone }, JWT_SECRET, { expiresIn: '30d' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'احراز هویت نشده' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; phone: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userPhone = decoded.phone;
    next();
  } catch {
    return res.status(401).json({ error: 'نشست نامعتبر' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'احراز هویت نشده' });
    if (!roles.includes(req.userRole!)) return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    next();
  };
}
