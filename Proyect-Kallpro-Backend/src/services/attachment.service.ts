import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
const UPLOAD_BASE = path.join(process.cwd(), 'uploads');

// ─── Ensure upload directory exists ─────────────────────────
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ─── Upload Attachment ───────────────────────────────────────
export async function uploadAttachment(
  companyId: string,
  entityType: string,
  entityId: string,
  file: Express.Multer.File,
  uploadedBy?: string
) {
  const dir = path.join(UPLOAD_BASE, companyId, entityType.toLowerCase());
  ensureDir(dir);

  const ext        = path.extname(file.originalname);
  const safeName   = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const storagePath = path.join(dir, safeName);

  fs.writeFileSync(storagePath, file.buffer);

  return prisma.attachment.create({
    data: {
      companyId,
      entityType,
      entityId,
      fileName:    file.originalname,
      storagePath: path.relative(process.cwd(), storagePath).replace(/\\/g, '/'),
      fileType:    file.mimetype,
      fileSize:    file.size,
      uploadedBy,
    },
  });
}

// ─── Get Attachments ─────────────────────────────────────────
export async function getAttachments(companyId: string, entityType: string, entityId: string) {
  return prisma.attachment.findMany({
    where:   { companyId, entityType, entityId },
    orderBy: { uploadedAt: 'desc' },
  });
}

// ─── Delete Attachment ───────────────────────────────────────
export async function deleteAttachment(id: string, companyId: string) {
  const att = await prisma.attachment.findFirst({ where: { id, companyId } });
  if (!att) throw new Error('Adjunto no encontrado');

  // Delete physical file if it exists
  const fullPath = path.join(process.cwd(), att.storagePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  return prisma.attachment.delete({ where: { id } });
}

// ─── Serve file path ─────────────────────────────────────────
export async function getAttachmentPath(id: string, companyId: string): Promise<string> {
  const att = await prisma.attachment.findFirst({ where: { id, companyId } });
  if (!att) throw new Error('Adjunto no encontrado');
  return path.join(process.cwd(), att.storagePath);
}
