import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { AuthPayload } from '../types/index';
import { getErpConfig } from './erp-config.service';
export async function registerUser(data: {
  companyName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error('EMAIL_EXISTS');

  const passwordHash = await bcrypt.hash(data.password, 12);

  const company = await prisma.company.create({
    data: { name: data.companyName, email: data.email },
  });

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'ADMIN',
      companyId: company.id,
    },
  });

  return { user, company };
}

type UserWithCompany = NonNullable<Awaited<ReturnType<typeof findUserWithCompany>>>;
function findUserWithCompany(where: Prisma.UserWhereUniqueInput) {
  return prisma.user.findUnique({ where, include: { company: true } });
}

/**
 * Crea una UserSession y emite los tokens con el `sessionId` (jti) embebido.
 * El access token lleva el jti para que el middleware valide ESTA sesión concreta.
 */
async function issueSessionTokens(user: UserWithCompany, meta?: { ip?: string; userAgent?: string }) {
  const cfg = await getErpConfig(user.companyId);
  const expiresAt = new Date(Date.now() + cfg.security.sessionTimeoutMinutes * 60 * 1000);
  const session = await prisma.userSession.create({
    data: { userId: user.id, ip: meta?.ip ?? null, userAgent: meta?.userAgent ?? null, expiresAt },
  });

  const payload: AuthPayload = {
    userId: user.id,
    companyId: user.companyId,
    email: user.email,
    role: user.role,
    sessionId: session.id,
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRATION ?? '2h') as any,
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRATION ?? '7d') as any,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      company: { id: user.company.id, name: user.company.name },
    },
  };
}

export async function loginUser(email: string, password: string, meta?: { ip?: string; userAgent?: string }) {
  const user = await findUserWithCompany({ email });
  if (!user) throw new Error('INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');
  if (!user.isActive) throw new Error('ACCOUNT_DISABLED');

  // Si el usuario tiene 2FA activo, NO emitimos el JWT final todavía: devolvemos un
  // challengeToken corto (5 min) que el cliente canjea con el código TOTP de 6 dígitos.
  if (user.twoFactorEnabled) {
    // challengeToken de un solo uso: el jti se guarda en el usuario y se limpia al
    // verificarse con éxito → impide reusar el challenge para mintear otra sesión (DeepSeek #1).
    const jti = randomUUID();
    await prisma.user.update({ where: { id: user.id }, data: { pendingChallengeJti: jti } });
    const challengeToken = jwt.sign(
      { userId: user.id, stage: '2fa', jti },
      process.env.JWT_SECRET as string,
      { expiresIn: '5m' },
    );
    return { require2FA: true as const, challengeToken };
  }

  // Enforcement de ErpConfig.security.require2FAForRoles: si el rol del usuario está obligado
  // a tener 2FA y aún no lo activó, se le deja entrar PERO se marca twoFactorSetupRequired
  // para que el frontend lo lleve directo al wizard de enrolamiento (bloquearlo en seco
  // dejaría fuera al propio ADMIN que activó la regla antes de enrolarse).
  const cfg = await getErpConfig(user.companyId);
  const twoFactorSetupRequired = cfg.security.require2FAForRoles.includes(user.role);

  return { require2FA: false as const, twoFactorSetupRequired, ...(await issueSessionTokens(user, meta)) };
}

/** Canjea el challengeToken + código TOTP por la sesión real (segundo paso del login). */
export async function verifyTwoFactorLogin(challengeToken: string, code: string, meta?: { ip?: string; userAgent?: string }) {
  let decoded: { userId: string; stage?: string; jti?: string };
  try {
    decoded = jwt.verify(challengeToken, process.env.JWT_SECRET as string) as any;
  } catch {
    throw new Error('CHALLENGE_INVALID');
  }
  if (decoded.stage !== '2fa' || !decoded.jti) throw new Error('CHALLENGE_INVALID');

  const user = await findUserWithCompany({ id: decoded.userId });
  if (!user || !user.isActive) throw new Error('INVALID_CREDENTIALS');
  if (!user.twoFactorEnabled || !user.twoFactorSecret) throw new Error('2FA_NOT_ENABLED');
  // El jti del token debe coincidir con el challenge vigente (un solo uso).
  if (user.pendingChallengeJti !== decoded.jti) throw new Error('CHALLENGE_INVALID');

  const ok = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1 });
  if (!ok) throw new Error('2FA_INVALID_CODE');

  // Consumir el challenge (limpiar el jti) para que no pueda reusarse.
  await prisma.user.update({ where: { id: user.id }, data: { pendingChallengeJti: null } });
  return issueSessionTokens(user, meta);
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as AuthPayload;
}

/**
 * Rotación de refresh token (DeepSeek #16/#2): al renovar, se REVOCA la sesión anterior y
 * se crea una nueva (nuevo par access+refresh). Un refresh robado deja de servir en cuanto
 * el legítimo rota. Devuelve también el nuevo refreshToken (el cliente debe reemplazarlo).
 */
export async function rotateRefresh(refreshToken: string, meta?: { ip?: string; userAgent?: string }) {
  let payload: AuthPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error('REFRESH_INVALID');
  }
  if (payload.sessionId) {
    const session = await prisma.userSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new Error('SESSION_EXPIRED');
    }
    await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  }
  const user = await findUserWithCompany({ id: payload.userId });
  if (!user || !user.isActive) throw new Error('INVALID_CREDENTIALS');
  return issueSessionTokens(user, meta);
}

// ============================================================
// 2FA — ENROLAMIENTO Y GESTIÓN
// ============================================================

/** Paso 1 del wizard: genera un secreto pendiente y devuelve el QR (otpauth) para escanear. */
export async function startTwoFactorEnrollment(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.twoFactorEnabled) throw new Error('2FA_ALREADY_ENABLED');

  const secret = speakeasy.generateSecret({ name: `KallpaPro (${user.email})`, length: 20 });
  await prisma.user.update({ where: { id: userId }, data: { pendingTwoFactorSecret: secret.base32 } });

  const otpauthUrl = secret.otpauth_url ?? '';
  const qrDataUrl = otpauthUrl ? await QRCode.toDataURL(otpauthUrl) : '';
  return { otpauthUrl, qrDataUrl, secret: secret.base32 };
}

/**
 * Recupera un enrolamiento 2FA en curso (DeepSeek #8): si hay secreto pendiente y el 2FA aún
 * no está activo, reconstruye el QR para que la UI retome el wizard tras una recarga.
 */
export async function getPendingEnrollment(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.twoFactorEnabled || !user.pendingTwoFactorSecret) return { pending: false as const };
  const otpauthUrl = speakeasy.otpauthURL({ secret: user.pendingTwoFactorSecret, label: `KallpaPro (${user.email})`, encoding: 'base32' });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { pending: true as const, otpauthUrl, qrDataUrl, secret: user.pendingTwoFactorSecret };
}

/** Paso 2 del wizard: confirma el código de 6 dígitos y activa el 2FA. */
export async function confirmTwoFactorEnrollment(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (!user.pendingTwoFactorSecret) throw new Error('2FA_NO_PENDING');

  const ok = speakeasy.totp.verify({ secret: user.pendingTwoFactorSecret, encoding: 'base32', token: code, window: 1 });
  if (!ok) throw new Error('2FA_INVALID_CODE');

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true, twoFactorSecret: user.pendingTwoFactorSecret, pendingTwoFactorSecret: null },
  });
  return { enabled: true };
}

/** Desactiva el 2FA (exige un código válido vigente para evitar bloqueos accidentales). */
export async function disableTwoFactor(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (!user.twoFactorEnabled || !user.twoFactorSecret) throw new Error('2FA_NOT_ENABLED');

  const ok = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1 });
  if (!ok) throw new Error('2FA_INVALID_CODE');

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null, pendingTwoFactorSecret: null },
  });
  return { enabled: false };
}

// ============================================================
// SESIONES
// ============================================================

export async function listUserSessions(userId: string, currentSessionId?: string) {
  const sessions = await prisma.userSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActivityAt: 'desc' },
    select: { id: true, ip: true, userAgent: true, lastActivityAt: true, expiresAt: true, createdAt: true },
  });
  return sessions.map((s) => ({ ...s, current: s.id === currentSessionId }));
}

/** Revoca UNA sesión concreta del usuario (cerrar sesión en web o móvil sin tocar la otra). */
export async function revokeSession(userId: string, sessionId: string) {
  const session = await prisma.userSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  await prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  return { ok: true };
}

// ============================================================
// USER MANAGEMENT (Admin)
// ============================================================

export async function listCompanyUsers(companyId: string) {
  return prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createCompanyUser(companyId: string, data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error('EMAIL_EXISTS');

  const passwordHash = await bcrypt.hash(data.password, 12);
  return prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      role: data.role,
      companyId,
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
  });
}

export async function updateUserRole(userId: string, companyId: string, role: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  });
}

export async function toggleUserActive(userId: string, companyId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  return prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  });
}
