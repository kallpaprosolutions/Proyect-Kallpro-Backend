import { AuthRequest } from '../../types/index';
import * as notes from '../../services/finance/financial-notes.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';

export const listNotes = asyncHandler(async (req: AuthRequest, res) => {
  const { period } = req.query as { period?: string };
  if (!period) throw AppError.badRequest('period es obligatorio', 'VALIDATION_ERROR');
  res.json(await notes.listNotes(req.user!.companyId, period));
});

export const createNote = asyncHandler(async (req: AuthRequest, res) => {
  const note = await notes.createNote(req.user!.companyId, req.body, req.user!.userId);
  res.status(201).json(note);
});

export const updateNote = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await notes.updateNote(req.user!.companyId, req.params.id, req.body));
});

export const deleteNote = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await notes.deleteNote(req.user!.companyId, req.params.id));
});
