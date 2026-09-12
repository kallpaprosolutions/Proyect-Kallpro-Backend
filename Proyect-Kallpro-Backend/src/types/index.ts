import { Request } from 'express';

export interface AuthPayload {
  userId: string;
  companyId: string;
  email: string;
  role: string;
  sessionId?: string; // jti: identifica la UserSession concreta (revocación granular + auditoría)
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}
