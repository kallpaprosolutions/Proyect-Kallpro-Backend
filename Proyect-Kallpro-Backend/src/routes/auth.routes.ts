import { Router } from 'express';
import { register, login, verify2FA, refreshToken, me, myPermissions, listRoles, adminListUsers, adminCreateUser, adminUpdateRole, adminToggleUser, enroll2FAStart, enroll2FAConfirm, disable2FA, get2FAStatus, pending2FA, listSessions, revokeSessionCtrl } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import { authLimiter } from '../middleware/security';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registra una empresa y su usuario administrador
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyName, email, password, firstName, lastName]
 *             properties:
 *               companyName: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *     responses:
 *       201: { description: Cuenta creada }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409:
 *         description: Email ya registrado (code EMAIL_EXISTS)
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */
router.post('/register', authLimiter, register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesión (paso 1). Si el usuario tiene 2FA, responde require2FA + challengeToken.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: 'accessToken + refreshToken, o { require2FA, challengeToken }' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       429: { description: Demasiados intentos (rate limit) }
 */
router.post('/login', authLimiter, login);

/**
 * @openapi
 * /api/auth/login/2fa:
 *   post:
 *     tags: [Auth]
 *     summary: Verifica el código TOTP (paso 2 del login) y emite los tokens
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [challengeToken, code]
 *             properties:
 *               challengeToken: { type: string }
 *               code: { type: string, example: '123456' }
 *     responses:
 *       200: { description: accessToken + refreshToken }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/login/2fa', authLimiter, verify2FA);

router.post('/refresh', refreshToken);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Usuario autenticado actual + reglas de permisos (CASL)
 *     responses:
 *       200: { description: '{ user, rules }' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me', authMiddleware, me);
router.get('/me/permissions', authMiddleware, myPermissions); // matriz legible "Mis permisos" derivada de ROLE_RULES
router.get('/roles', authMiddleware, listRoles);

// 2FA — enrolamiento/gestión sobre la propia cuenta
router.get('/2fa/status',     authMiddleware, get2FAStatus);
router.get('/2fa/pending',    authMiddleware, pending2FA);
router.post('/2fa/enroll',    authMiddleware, enroll2FAStart);
router.post('/2fa/confirm',   authMiddleware, enroll2FAConfirm);
router.post('/2fa/disable',   authMiddleware, disable2FA);

// Sesiones activas del usuario
router.get('/sessions',         authMiddleware, listSessions);
router.delete('/sessions/:id',  authMiddleware, revokeSessionCtrl);

// Admin — User Management (gestión de usuarios = manage User)
router.get('/admin/users',               authMiddleware, authorize('read',   'User'), adminListUsers);
router.post('/admin/users',              authMiddleware, authorize('create', 'User'), adminCreateUser);
router.put('/admin/users/:id/role',      authMiddleware, authorize('update', 'User'), adminUpdateRole);
router.patch('/admin/users/:id/toggle',  authMiddleware, authorize('update', 'User'), adminToggleUser);

export default router;
