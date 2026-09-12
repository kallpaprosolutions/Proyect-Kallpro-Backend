import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import * as ctrl from '../controllers/sri-document.controller';
import * as procCtrl from '../controllers/procurement-ai.controller';

const router = Router();

// Multer: memoria (hasta 10 MB, solo PDF y XML)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/xml', 'text/xml'];
    // Algunos navegadores envían PDF como octet-stream
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.xml') || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF o XML'));
    }
  },
});

router.use(authMiddleware);

// KPIs y catálogos
router.get('/kpis', ctrl.getKpis);
router.get('/catalogs', ctrl.getCatalogs);

// Cuentas por pagar
router.get('/payables', ctrl.listPayables);

// CRUD documentos
router.post('/upload', authorize('create', 'Purchase'), upload.single('file'), ctrl.uploadDocument);
router.post('/manual', authorize('create', 'Purchase'), ctrl.createManualDocument); // ingreso manual o asistido por IA (sin PDF/XML)
router.get('/', ctrl.listDocuments);
router.get('/:id', ctrl.getDocument);
router.get('/:id/journal-preview', ctrl.getJournalPreview);
router.post('/:id/pay', authorize('pay', 'Purchase'), ctrl.payDocument);
router.patch('/:id', authorize('update', 'Purchase'), ctrl.updateDocument);
// Confirmar postea el asiento contable (regla 2) — gate distinto de "capturar" (create/update).
router.post('/:id/confirm', authorize('post', 'Journal'), ctrl.confirmDocument);
router.post('/:id/reject', authorize('update', 'Purchase'), ctrl.rejectDocument);
router.delete('/:id', authorize('delete', 'Purchase'), ctrl.deleteDocument);
router.post('/:id/validate-match', procCtrl.threeWayMatch);

export default router;
