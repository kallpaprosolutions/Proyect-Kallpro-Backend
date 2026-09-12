import { Request } from 'express';
import {
  createContact,
  getContact,
  listContacts,
  updateContact,
  CreateContactInput,
} from '../../services/crm/contact.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';

export const createContactHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const data: CreateContactInput = req.body;
  if (!data.firstName) throw AppError.badRequest('firstName es requerido', 'VALIDATION_ERROR');
  const contact = await createContact(companyId, data);
  res.status(201).json(contact);
});

export const getContactHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const contact = await getContact(companyId, req.params.id);
  if (!contact) throw AppError.notFound('Contacto no encontrado', 'CONTACT_NOT_FOUND');
  res.json(contact);
});

export const listContactsHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const result = await listContacts(companyId, {
    search: req.query.search as string,
    assignedTo: req.query.assignedTo as string,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json(result);
});

export const updateContactHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  await updateContact(companyId, req.params.id, req.body);
  res.json({ updated: true });
});
