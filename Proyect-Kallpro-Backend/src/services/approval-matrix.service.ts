import { prisma } from '../lib/prisma';
export interface MatrixLevel {
  level: number;
  label: string;
  minAmount: number;
  maxAmount?: number | null;
  approverRole: string;
}

const DEFAULT_MATRIX: Omit<MatrixLevel, 'approverRole'>[] & MatrixLevel[] = [
  { level: 1, label: 'Jefe de Área',               minAmount: 0,       maxAmount: 500,    approverRole: 'LEVEL1_APPROVER' },
  { level: 2, label: 'Jefe de Compras',             minAmount: 500.01,  maxAmount: 5000,   approverRole: 'LEVEL2_APPROVER' },
  { level: 3, label: 'Director Financiero',         minAmount: 5000.01, maxAmount: 50000,  approverRole: 'LEVEL3_APPROVER' },
  { level: 4, label: 'Gerente General',             minAmount: 50000.01,maxAmount: 200000, approverRole: 'LEVEL4_APPROVER' },
  { level: 5, label: 'Directorio / Comité',         minAmount: 200000.01, maxAmount: null, approverRole: 'LEVEL5_APPROVER' },
];

export async function getMatrix(companyId: string) {
  const rows = await prisma.approvalMatrix.findMany({
    where: { companyId },
    orderBy: { level: 'asc' },
  });
  return rows;
}

export async function upsertMatrix(companyId: string, levels: MatrixLevel[]) {
  await prisma.$transaction(
    levels.map((l) =>
      prisma.approvalMatrix.upsert({
        where: { companyId_level: { companyId, level: l.level } },
        create: { companyId, ...l },
        update: { label: l.label, minAmount: l.minAmount, maxAmount: l.maxAmount, approverRole: l.approverRole },
      })
    )
  );
  return getMatrix(companyId);
}

export async function seedDefaultMatrix(companyId: string) {
  return upsertMatrix(companyId, DEFAULT_MATRIX);
}

/** Returns the number of approval levels required for a given amount. */
export async function getRequiredLevels(companyId: string, amount: number): Promise<number> {
  const matrix = await getMatrix(companyId);
  if (matrix.length === 0) return 1; // fallback: single level

  // Find the highest level whose minAmount <= amount
  let required = 1;
  for (const row of matrix) {
    if (amount >= row.minAmount) {
      required = row.level;
    }
  }
  return required;
}
