import { Request, Response, NextFunction } from 'express';
import { verifyJwtToken } from '../auth';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    tenant_id: string;
    email: string;
    role: string;
  };
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyJwtToken(token);
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
