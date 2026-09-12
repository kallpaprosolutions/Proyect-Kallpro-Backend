import client from './client';

export const adminApi = {
  listUsers: () => client.get('/auth/admin/users'),
  createUser: (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role: string;
  }) => client.post('/auth/admin/users', data),
  updateRole: (id: string, role: string) => client.put(`/auth/admin/users/${id}/role`, { role }),
  toggleUser: (id: string) => client.patch(`/auth/admin/users/${id}/toggle`),
};
