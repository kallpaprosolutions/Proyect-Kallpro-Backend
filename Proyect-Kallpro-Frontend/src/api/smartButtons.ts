import client from './client';

export type SmartButtonEntity = 'PURCHASE_ORDER' | 'SALES_ORDER' | 'INVOICE';

export interface SmartButtonItem {
  id: string;
  title: string;
  subtitle: string;
  route: string | null;
}

export interface SmartButton {
  key: string;
  label: string;
  icon: string;
  count: number;
  route: string | null;
  items: SmartButtonItem[];
}

/** Smart buttons (A4): documentos vinculados a una OC / pedido / factura. */
export async function getSmartButtons(entityType: SmartButtonEntity, entityId: string): Promise<SmartButton[]> {
  const { data } = await client.get<{ buttons: SmartButton[] }>(`/search/related/${entityType}/${entityId}`);
  return data.buttons;
}
