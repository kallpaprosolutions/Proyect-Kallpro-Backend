import { AuthRequest } from '../middleware/auth.middleware';
import * as svc from '../services/attachment.service';
import * as path from 'path';
import * as fs from 'fs';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const uploadFile = asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  if (!req.file) throw AppError.badRequest('No se recibió archivo', 'NO_FILE');
  const att = await svc.uploadAttachment(
    req.user!.companyId,
    entityType.toUpperCase(),
    entityId,
    req.file,
    req.user!.userId,
  );
  res.status(201).json(att);
});

export const listFiles = asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  const atts = await svc.getAttachments(req.user!.companyId, entityType.toUpperCase(), entityId);
  res.json(atts);
});

export const deleteFile = asyncHandler(async (req: AuthRequest, res) => {
  try {
    await svc.deleteAttachment(req.params.id, req.user!.companyId);
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.message?.includes('no encontrado')) throw AppError.notFound(e.message, 'NOT_FOUND');
    throw e;
  }
});

export const downloadFile = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const filePath = await svc.getAttachmentPath(req.params.id, req.user!.companyId);
    if (!fs.existsSync(filePath)) throw AppError.notFound('Archivo no encontrado en disco', 'FILE_NOT_FOUND');
    res.download(filePath, path.basename(filePath));
  } catch (e: any) {
    if (e instanceof AppError) throw e;
    if (e?.message?.includes('no encontrado')) throw AppError.notFound(e.message, 'NOT_FOUND');
    throw e;
  }
});
