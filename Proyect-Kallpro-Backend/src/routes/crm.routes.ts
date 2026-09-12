import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateSchema } from '../middleware/validate';
import * as crmSchema from '../schemas/crm.schema';
import * as dashboardCtrl from '../controllers/crm/dashboard.controller';
import * as contactsCtrl from '../controllers/crm/contacts.controller';
import * as companiesCtrl from '../controllers/crm/companies.controller';
import * as dealsCtrl from '../controllers/crm/deals.controller';
import * as conversationsCtrl from '../controllers/crm/conversations.controller';
import * as agentsCtrl from '../controllers/crm/agents.controller';
import * as forecastCtrl from '../controllers/crm/forecast.controller';
import * as leadsCtrl from '../controllers/crm/leads.controller';
import * as configCtrl from '../controllers/crm/config.controller';

const router = Router();

// ── Webhook (no auth — validates via channel signature) ──────────────────────
router.post('/webhooks/unipile', conversationsCtrl.inboundWebhookHandler);

// ── All other routes require auth ────────────────────────────────────────────
router.use(authMiddleware);

// Dashboard
router.get('/dashboard', dashboardCtrl.getDashboard);

// Contacts
/**
 * @openapi
 * /api/crm/contacts:
 *   get:
 *     tags: [CRM]
 *     summary: Lista contactos (con búsqueda y paginación)
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: assignedTo, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: offset, schema: { type: integer } }
 *     responses:
 *       200: { description: Lista de contactos }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [CRM]
 *     summary: Crea un contacto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *     responses:
 *       201: { description: Contacto creado }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/contacts', contactsCtrl.listContactsHandler);
router.post('/contacts', validateSchema({ body: crmSchema.contactCreateSchema }), contactsCtrl.createContactHandler);
router.get('/contacts/:id', contactsCtrl.getContactHandler);
router.patch('/contacts/:id', contactsCtrl.updateContactHandler);

// Companies
router.get('/companies', companiesCtrl.listCompaniesHandler);
router.post('/companies', validateSchema({ body: crmSchema.companyCreateSchema }), companiesCtrl.createCompanyHandler);
router.get('/companies/:id', companiesCtrl.getCompanyHandler);
router.patch('/companies/:id', companiesCtrl.updateCompanyHandler);
router.post('/companies/validate-ruc', validateSchema({ body: crmSchema.validateRucSchema }), companiesCtrl.validateRUCHandler);

// Deals
router.get('/deals', dealsCtrl.listDealsHandler);
router.post('/deals', validateSchema({ body: crmSchema.dealCreateSchema }), dealsCtrl.createDealHandler);
router.get('/deals/funnel', dealsCtrl.getFunnelMetricsHandler);
router.get('/deals/at-risk', dealsCtrl.getDealsAtRiskHandler);
router.get('/deals/:id', dealsCtrl.getDealHandler);
router.patch('/deals/:id', dealsCtrl.updateDealHandler);
router.patch('/deals/:id/stage', validateSchema({ body: crmSchema.dealStageSchema }), dealsCtrl.updateDealStageHandler);
// Puente CRM → Ventas: productos conversados y generación de la cotización
router.get('/deals/:id/items', dealsCtrl.getDealItemsHandler);
router.put('/deals/:id/items', dealsCtrl.setDealItemsHandler);
router.post('/deals/:id/generate-quotation', dealsCtrl.generateQuotationHandler);

// Conversations & Inbox
router.get('/conversations', conversationsCtrl.listConversationsHandler);
router.get('/conversations/:id', conversationsCtrl.getThreadHandler);
router.post('/conversations/:id/messages', validateSchema({ body: crmSchema.messageCreateSchema }), conversationsCtrl.addMessageHandler);
router.patch('/conversations/:id/status', validateSchema({ body: crmSchema.conversationStatusSchema }), conversationsCtrl.updateStatusHandler);
router.post('/conversations/:id/messages/:messageId/approve', conversationsCtrl.approveMessageHandler);

// Agents
router.get('/agents', agentsCtrl.listAgentsHandler);
router.get('/agents/:code/metrics', agentsCtrl.getAgentMetricsHandler);
// Configuración completa (incluye la instrucción del sistema, que el listado omite).
router.get('/agents/:code/config', configCtrl.getAgentConfigHandler);
router.post('/agents/:code/invoke', agentsCtrl.invokeAgentHandler);
// Edición del agente desde la interfaz (prompt, modelo, temperatura, autonomía).
router.patch('/agents/:code', validateSchema({ body: crmSchema.agentConfigSchema }), configCtrl.updateAgentHandler);

// ════════════════════════════════════════════════════════════════════
// Leads (Sprint 13) — bandeja de captura
// ════════════════════════════════════════════════════════════════════
/**
 * @openapi
 * /api/crm/leads:
 *   get:
 *     tags: [CRM]
 *     summary: Bandeja de leads con score, grado y filtros
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [NEW, WORKING, QUALIFIED, CONVERTED, DISQUALIFIED] } }
 *       - { in: query, name: grade, schema: { type: string, enum: [A, B, C, D] } }
 *       - { in: query, name: minScore, schema: { type: integer } }
 *       - { in: query, name: onlyDuplicates, schema: { type: boolean } }
 *     responses:
 *       200: { description: Lista de leads }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [CRM]
 *     summary: Crea un lead a mano (se puntúa y se asigna automáticamente)
 *     responses:
 *       201: { description: Lead creado }
 *       400: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/leads', leadsCtrl.listLeadsHandler);
router.post('/leads', validateSchema({ body: crmSchema.leadCreateSchema }), leadsCtrl.createLeadHandler);
router.get('/leads/stats', leadsCtrl.getLeadStatsHandler);
router.get('/leads/catalogs', leadsCtrl.getLeadCatalogsHandler);
router.post('/leads/check-duplicate', leadsCtrl.checkDuplicateHandler);
router.post('/leads/rescore-all', leadsCtrl.rescoreAllHandler);
router.get('/leads/:id', leadsCtrl.getLeadHandler);
router.patch('/leads/:id', leadsCtrl.updateLeadHandler);
router.post('/leads/:id/rescore', leadsCtrl.rescoreLeadHandler);
router.post('/leads/:id/assign', leadsCtrl.assignLeadHandler);
router.post('/leads/:id/events', validateSchema({ body: crmSchema.leadEventSchema }), leadsCtrl.registerEventHandler);
router.post('/leads/:id/convert', validateSchema({ body: crmSchema.leadConvertSchema }), leadsCtrl.convertLeadHandler);
router.post('/leads/:id/disqualify', validateSchema({ body: crmSchema.leadDisqualifySchema }), leadsCtrl.disqualifyLeadHandler);

// ════════════════════════════════════════════════════════════════════
// Configuración editable del CRM (Sprint 13)
// ════════════════════════════════════════════════════════════════════
router.get('/config/meta', configCtrl.getConfigMetaHandler);

// Etapas del pipeline
router.get('/config/stages', configCtrl.listStagesHandler);
router.post('/config/stages', validateSchema({ body: crmSchema.pipelineStageSchema }), configCtrl.createStageHandler);
router.post('/config/stages/reorder', validateSchema({ body: crmSchema.stageReorderSchema }), configCtrl.reorderStagesHandler);
router.patch('/config/stages/:id', configCtrl.updateStageHandler);
router.delete('/config/stages/:id', configCtrl.deleteStageHandler);

// Scoring: umbrales y reglas
router.get('/config/scoring', configCtrl.getScoringConfigHandler);
router.patch('/config/scoring', validateSchema({ body: crmSchema.scoringConfigSchema }), configCtrl.updateScoringConfigHandler);
router.get('/config/scoring/rules', configCtrl.listScoringRulesHandler);
router.post('/config/scoring/rules', validateSchema({ body: crmSchema.scoringRuleSchema }), configCtrl.createScoringRuleHandler);
router.post('/config/scoring/rules/reset', configCtrl.resetScoringRulesHandler);
router.patch('/config/scoring/rules/:id', configCtrl.updateScoringRuleHandler);
router.delete('/config/scoring/rules/:id', configCtrl.deleteScoringRuleHandler);

// Reglas de asignación
router.get('/config/assignment-rules', configCtrl.listAssignmentRulesHandler);
router.post('/config/assignment-rules', validateSchema({ body: crmSchema.assignmentRuleSchema }), configCtrl.createAssignmentRuleHandler);
router.patch('/config/assignment-rules/:id', configCtrl.updateAssignmentRuleHandler);
router.delete('/config/assignment-rules/:id', configCtrl.deleteAssignmentRuleHandler);

// Formularios de captura
router.get('/config/forms', configCtrl.listFormsHandler);
router.post('/config/forms', validateSchema({ body: crmSchema.captureFormSchema }), configCtrl.createFormHandler);
router.get('/config/forms/:id', configCtrl.getFormHandler);
router.patch('/config/forms/:id', configCtrl.updateFormHandler);
router.delete('/config/forms/:id', configCtrl.deleteFormHandler);
router.post('/config/forms/:id/rotate-key', configCtrl.rotateFormKeyHandler);

// ════════════════════════════════════════════════════════════════════
// Pronóstico (v2)
// ════════════════════════════════════════════════════════════════════
router.get('/forecast', forecastCtrl.getForecastHandler);
router.get('/forecast/trend', forecastCtrl.getMonthlyTrendHandler);
router.get('/forecast/accuracy', forecastCtrl.getAccuracyHandler);
router.get('/forecast/velocity', forecastCtrl.getVelocityHandler);
router.get('/forecast/by-owner', forecastCtrl.getByOwnerHandler);
router.post('/forecast/quota', validateSchema({ body: crmSchema.forecastQuotaSchema }), forecastCtrl.setQuotaHandler);
router.post('/forecast/close-period', validateSchema({ body: crmSchema.forecastPeriodSchema }), forecastCtrl.closePeriodHandler);
router.patch('/forecast/deals/:dealId/category', validateSchema({ body: crmSchema.dealCategorySchema }), forecastCtrl.setDealCategoryHandler);
router.delete('/forecast/deals/:dealId/category', forecastCtrl.clearDealCategoryHandler);

export default router;
