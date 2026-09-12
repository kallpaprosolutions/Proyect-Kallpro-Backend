import { Router } from 'express';
import { publicFormLimiter } from '../middleware/security';
import * as publicFormsCtrl from '../controllers/crm/public-forms.controller';

/**
 * Rutas PÚBLICAS de captura de leads (Sprint 13). Se montan en /api/public/crm y
 * NO llevan authMiddleware: el sitio web del cliente las llama desde el navegador de
 * un visitante anónimo.
 *
 * La única credencial es la `publicKey` del formulario, que solo autoriza a leer su
 * definición y a enviar un lead a esa empresa. El límite de tasa, el honeypot y el
 * tiempo mínimo de llenado son la defensa contra el envío automatizado.
 */
const router = Router();

router.get('/forms/:publicKey', publicFormsCtrl.getPublicFormHandler);
router.post('/forms/:publicKey', publicFormLimiter, publicFormsCtrl.submitPublicFormHandler);

export default router;
