import { Request } from 'express';
import {
  simulate,
  getThreePredefined,
  saveScenario,
  getScenarios,
  compareScenarios,
  ScenarioParams,
} from '../../services/finance/scenarios.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';

export const simulateScenario = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const params: ScenarioParams = req.body;
  const result = await simulate(companyId, params);
  res.json(result);
});

export const getPredefinedScenarios = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const result = await getThreePredefined(companyId);
  res.json(result);
});

export const saveScenarioHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const userId = (req as any).user?.id;
  const { name, type, params, result } = req.body;

  if (!name || !params) {
    throw AppError.badRequest('name y params son requeridos', 'VALIDATION_ERROR');
  }

  const scenario = await saveScenario(
    companyId,
    userId,
    { ...params, name, type: type ?? 'custom' },
    result ?? {},
  );
  res.status(201).json(scenario);
});

export const getScenariosHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const scenarios = await getScenarios(companyId);
  res.json(scenarios);
});

export const compareScenariosHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length < 2) {
    throw AppError.badRequest('Se requieren al menos 2 IDs de escenarios', 'VALIDATION_ERROR');
  }

  const comparison = await compareScenarios(companyId, ids);
  res.json(comparison);
});
