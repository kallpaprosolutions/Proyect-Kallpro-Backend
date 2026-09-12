import client from './client';

export type ChatterEntityType = 'PURCHASE_ORDER' | 'SALES_ORDER' | 'INVOICE' | 'REQUISITION' | 'SALES_QUOTATION';
export type MessageKind = 'MESSAGE' | 'NOTE' | 'LOG';

export interface ChatterMessage {
  id: string;
  body: string;
  kind: MessageKind;
  logField: string | null;
  logFrom: string | null;
  logTo: string | null;
  createdAt: string;
  userId: string;
  userName: string;
}

export interface Follower {
  userId: string;
  userName: string;
}

/** Chatter (A2): hilo de mensajes de un documento. */
export async function getMessages(entityType: ChatterEntityType, entityId: string): Promise<ChatterMessage[]> {
  const { data } = await client.get<{ messages: ChatterMessage[] }>(`/chatter/${entityType}/${entityId}`);
  return data.messages;
}

/** Publica un mensaje (o nota interna) en el hilo del documento. */
export async function postMessage(entityType: ChatterEntityType, entityId: string, body: string, kind?: 'MESSAGE' | 'NOTE'): Promise<ChatterMessage> {
  const { data } = await client.post<ChatterMessage>(`/chatter/${entityType}/${entityId}`, { body, kind });
  return data;
}

/** Quién sigue el documento (A2.2), y si el usuario actual está entre ellos. */
export async function getFollowers(entityType: ChatterEntityType, entityId: string): Promise<{ followers: Follower[]; followingMe: boolean }> {
  const { data } = await client.get(`/chatter/${entityType}/${entityId}/followers`);
  return data;
}

export async function follow(entityType: ChatterEntityType, entityId: string): Promise<void> {
  await client.post(`/chatter/${entityType}/${entityId}/follow`);
}

export async function unfollow(entityType: ChatterEntityType, entityId: string): Promise<void> {
  await client.delete(`/chatter/${entityType}/${entityId}/follow`);
}
