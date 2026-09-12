import { Request } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, verifyTwoFactorLogin, rotateRefresh, listCompanyUsers, createCompanyUser, updateUserRole, toggleUserActive, startTwoFactorEnrollment, getPendingEnrollment, confirmTwoFactorEnrollment, disableTwoFactor, listUserSessions, revokeSession } from '../services/auth.service';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types/index';
import { packedRulesFor } from '../auth/abilities';
import { ROLE_CATALOG } from '../auth/roles';
import { buildPermissionMatrix } from '../auth/permissions-matrix';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

/**
 * Controlador de Autenticación — migrado al patrón asyncHandler + AppError (Sprint 2.2).
 *
 * Particularidades de seguridad PRESERVADAS:
 *  - Los mensajes de login son deliberadamente vagos (no revelan si el email existe).
 *  - Varios códigos tienen status dependiente del contexto (p.ej. 2FA_INVALID_CODE: 401 en
 *    login, 400 en enrolamiento) → se lanza AppError inline, sin delegar al catálogo global.
 *  - Errores inesperados se delegan al errorHandler global (que los loguea y responde 500),
 *    salvo en refreshToken, donde cualquier fallo se traduce a 401.
 */

const registerSchema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const register = asyncHandler(async (req: Request, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const { user, company } = await registerUser(parsed.data);
    res.status(201).json({
      message: 'Account created successfully',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      company: { id: company.id, name: company.name },
    });
  } catch (err: any) {
    if (err?.message === 'EMAIL_EXISTS') throw AppError.conflict('Email already registered', 'EMAIL_EXISTS');
    throw err; // inesperado → errorHandler global (log + 500)
  }
});

export const login = asyncHandler(async (req: Request, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR');
  try {
    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await loginUser(parsed.data.email, parsed.data.password, meta);
    res.json(result);
  } catch (err: any) {
    if (err?.message === 'INVALID_CREDENTIALS') throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    if (err?.message === 'ACCOUNT_DISABLED') throw AppError.forbidden('Account disabled', 'ACCOUNT_DISABLED');
    throw err;
  }
});

// Segundo paso del login cuando el usuario tiene 2FA: challengeToken + código de 6 dígitos.
export const verify2FA = asyncHandler(async (req: Request, res) => {
  const schema = z.object({ challengeToken: z.string(), code: z.string().min(6).max(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR');
  try {
    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await verifyTwoFactorLogin(parsed.data.challengeToken, parsed.data.code, meta);
    res.json(result);
  } catch (err: any) {
    if (err?.message === 'CHALLENGE_INVALID') throw AppError.unauthorized('Sesión de verificación expirada, vuelve a iniciar sesión', 'CHALLENGE_INVALID');
    if (err?.message === '2FA_INVALID_CODE') throw AppError.unauthorized('Código incorrecto', '2FA_INVALID_CODE');
    if (err?.message === 'INVALID_CREDENTIALS' || err?.message === '2FA_NOT_ENABLED') throw AppError.unauthorized('No autorizado', 'UNAUTHORIZED');
    throw err;
  }
});

// ── 2FA: enrolamiento y gestión (usuario autenticado sobre su propia cuenta) ──
export const enroll2FAStart = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const data = await startTwoFactorEnrollment(req.user!.userId);
    res.json(data);
  } catch (e: any) {
    if (e?.message === '2FA_ALREADY_ENABLED') throw AppError.badRequest('El 2FA ya está activo', '2FA_ALREADY_ENABLED');
    throw e;
  }
});

export const enroll2FAConfirm = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ code: z.string().min(6).max(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Código inválido', 'VALIDATION_ERROR');
  try {
    const data = await confirmTwoFactorEnrollment(req.user!.userId, parsed.data.code);
    res.json(data);
  } catch (e: any) {
    if (e?.message === '2FA_NO_PENDING') throw AppError.badRequest('No hay un enrolamiento en curso', '2FA_NO_PENDING');
    if (e?.message === '2FA_INVALID_CODE') throw AppError.badRequest('Código incorrecto', '2FA_INVALID_CODE');
    throw e;
  }
});

export const disable2FA = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ code: z.string().min(6).max(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Código inválido', 'VALIDATION_ERROR');
  try {
    const data = await disableTwoFactor(req.user!.userId, parsed.data.code);
    res.json(data);
  } catch (e: any) {
    if (e?.message === '2FA_NOT_ENABLED') throw AppError.badRequest('El 2FA no está activo', '2FA_NOT_ENABLED');
    if (e?.message === '2FA_INVALID_CODE') throw AppError.badRequest('Código incorrecto', '2FA_INVALID_CODE');
    throw e;
  }
});

export const get2FAStatus = asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { twoFactorEnabled: true } });
  res.json({ enabled: !!user?.twoFactorEnabled });
});

// ── Sesiones activas ──
export const listSessions = asyncHandler(async (req: AuthRequest, res) => {
  const sessions = await listUserSessions(req.user!.userId, req.user!.sessionId);
  res.json(sessions);
});

export const revokeSessionCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    await revokeSession(req.user!.userId, req.params.id);
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.message === 'SESSION_NOT_FOUND') throw AppError.notFound('Sesión no encontrada', 'SESSION_NOT_FOUND');
    throw e;
  }
});

export const refreshToken = asyncHandler(async (req: Request, res) => {
  const { refreshToken: token } = req.body;
  if (!token) throw AppError.badRequest('Refresh token required', 'REFRESH_TOKEN_REQUIRED');
  try {
    // Rotación: revoca la sesión anterior y emite un par nuevo (access + refresh).
    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await rotateRefresh(token, meta);
    res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  } catch (err: any) {
    // Cualquier fallo de refresh se traduce a 401 (comportamiento original preservado).
    if (err?.message === 'SESSION_EXPIRED') throw AppError.unauthorized('SESSION_EXPIRED', 'SESSION_EXPIRED');
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }
});

// Recupera un enrolamiento 2FA en curso (para retomar el wizard tras recargar la página).
export const pending2FA = asyncHandler(async (req: AuthRequest, res) => {
  const data = await getPendingEnrollment(req.user!.userId);
  res.json(data);
});

export const me = asyncHandler(async (req: Request, res) => {
  const user = (req as any).user;
  res.json({ user, rules: packedRulesFor(user?.role || 'USER') });
});

export const myPermissions = asyncHandler(async (req: Request, res) => {
  const user = (req as any).user;
  res.json(buildPermissionMatrix(user?.role || 'USER'));
});

// Catálogo de roles disponibles (para UI de asignación)
export const listRoles = asyncHandler(async (_req: Request, res) => {
  res.json(ROLE_CATALOG);
});

// ============================================================
// ADMIN — User Management
// ============================================================

export const adminListUsers = asyncHandler(async (req: AuthRequest, res) => {
  const users = await listCompanyUsers(req.user!.companyId);
  res.json(users);
});

export const adminCreateUser = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const user = await createCompanyUser(req.user!.companyId, parsed.data);
    res.status(201).json(user);
  } catch (e: any) {
    if (e?.message === 'EMAIL_EXISTS') throw AppError.conflict('El email ya está registrado', 'EMAIL_EXISTS');
    throw e;
  }
});

export const adminUpdateRole = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ role: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('rol inválido', 'VALIDATION_ERROR');
  try {
    const user = await updateUserRole(req.params.id, req.user!.companyId, parsed.data.role);
    res.json(user);
  } catch (e: any) {
    if (e?.message === 'USER_NOT_FOUND') throw AppError.notFound('Usuario no encontrado', 'USER_NOT_FOUND');
    throw e;
  }
});

export const adminToggleUser = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const user = await toggleUserActive(req.params.id, req.user!.companyId);
    res.json(user);
  } catch (e: any) {
    if (e?.message === 'USER_NOT_FOUND') throw AppError.notFound('Usuario no encontrado', 'USER_NOT_FOUND');
    throw e;
  }
});
