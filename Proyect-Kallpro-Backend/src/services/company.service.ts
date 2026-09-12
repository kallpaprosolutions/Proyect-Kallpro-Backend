import { prisma } from '../lib/prisma';
import { getMatrix } from './approval-matrix.service';
import { setAiEnabled } from './ollama.service';
import { mergeConfig, validateConfig, invalidateErpConfig, ERP_CONFIG_DEFAULTS } from './erp-config.service';
const COMPANY_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  industry: true,
  isPublicEntity: true,
  aiEnabled: true,
  settings: true,
} as const;

export async function getCompanySettings(companyId: string) {
  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: COMPANY_SELECT,
  });
  if (!company) throw new Error('COMPANY_NOT_FOUND');
  const approvalMatrix = await getMatrix(companyId);
  // Devolver la configuración del ERP siempre completa (defaults + guardado).
  return { ...company, settings: mergeConfig(company.settings), approvalMatrix };
}

export async function updateCompanySettings(
  companyId: string,
  data: {
    isPublicEntity?: boolean;
    aiEnabled?: boolean;
    name?: string;
    email?: string;
    phone?: string;
    industry?: string;
    settings?: { [K in keyof typeof ERP_CONFIG_DEFAULTS]?: Partial<(typeof ERP_CONFIG_DEFAULTS)[K]> };
  }
) {
  const { settings: settingsPatch, ...columns } = data;

  // Merge por sección sobre lo ya guardado (no se pierde lo que no viene en el patch).
  let mergedSettings: any;
  if (settingsPatch && typeof settingsPatch === 'object') {
    const current = await prisma.company.findFirst({ where: { id: companyId }, select: { settings: true } });
    const base = mergeConfig(current?.settings);
    mergedSettings = { ...base };
    for (const section of Object.keys(settingsPatch) as (keyof typeof ERP_CONFIG_DEFAULTS)[]) {
      mergedSettings[section] = { ...(base as any)[section], ...(settingsPatch as any)[section] };
    }
    // Validar ANTES de guardar (DeepSeek #3): si el patch dejó la config incompleta,
    // falla aquí con 400 en vez de romper en el próximo request.
    validateConfig(mergedSettings);
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: { ...columns, ...(mergedSettings ? { settings: mergedSettings } : {}) },
    select: COMPANY_SELECT,
  });
  invalidateErpConfig(companyId); // el caché debe reflejar el cambio de inmediato
  // Mantener el cache del interruptor de IA sincronizado al instante (sin reinicio).
  if (data.aiEnabled !== undefined) setAiEnabled(updated.aiEnabled);
  return { ...updated, settings: mergeConfig(updated.settings) };
}
