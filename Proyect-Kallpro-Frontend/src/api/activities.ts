import client from './client';
import { ChatterEntityType } from './chatter';

export type ActivityType = 'LLAMAR' | 'REUNION' | 'REVISAR' | 'PAGAR' | 'EMAIL' | 'OTRO';
export type ActivityStatus = 'DONE' | 'OVERDUE' | 'TODAY' | 'UPCOMING';

export interface Activity {
  id: string;
  entityType: ChatterEntityType;
  entityId: string;
  type: ActivityType;
  note: string | null;
  dueDate: string;
  assignedToId: string;
  assignedToName: string;
  createdById: string;
  createdByName: string;
  doneAt: string | null;
  createdAt: string;
  status: ActivityStatus;
}

export interface AssignableUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface NewActivityInput {
  type: ActivityType;
  note?: string;
  dueDate: string;
  assignedToId?: string;
}

/** Actividades agendadas sobre un documento (A3). */
export async function getEntityActivities(entityType: ChatterEntityType, entityId: string): Promise<Activity[]> {
  const { data } = await client.get<{ activities: Activity[] }>(`/activities/${entityType}/${entityId}`);
  return data.activities;
}

/** Agenda una actividad sobre el documento. */
export async function createActivity(entityType: ChatterEntityType, entityId: string, input: NewActivityInput): Promise<Activity> {
  const { data } = await client.post<Activity>(`/activities/${entityType}/${entityId}`, input);
  return data;
}

/** Widget "Mis actividades": pendientes asignadas al usuario actual. */
export async function getMyActivities(includeDone = false): Promise<Activity[]> {
  const { data } = await client.get<{ activities: Activity[] }>('/activities/mine', { params: includeDone ? { includeDone: '1' } : {} });
  return data.activities;
}

/** Usuarios de la empresa a los que se les puede asignar una actividad. */
export async function getAssignableUsers(): Promise<AssignableUser[]> {
  const { data } = await client.get<AssignableUser[]>('/activities/assignable-users');
  return data;
}

export async function completeActivity(id: string): Promise<Activity> {
  const { data } = await client.patch<Activity>(`/activities/${id}/complete`);
  return data;
}

export async function reopenActivity(id: string): Promise<Activity> {
  const { data } = await client.patch<Activity>(`/activities/${id}/reopen`);
  return data;
}

export async function deleteActivity(id: string): Promise<void> {
  await client.delete(`/activities/${id}`);
}
