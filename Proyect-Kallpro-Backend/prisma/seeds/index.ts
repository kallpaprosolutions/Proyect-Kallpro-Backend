/**
 * Seed — crea empresa + usuario admin de prueba
 * Ejecutar: npx ts-node prisma/seeds/index.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de KallpaPro...\n');

  // ── Eliminar datos previos para evitar conflictos ──
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});
  console.log('🗑  Datos previos eliminados');

  // ── Crear empresa ──
  const company = await prisma.company.create({
    data: {
      name: 'KallpaPro Demo',
      email: 'admin@gmail.com',
      phone: '0999999999',
      industry: 'Comercio',
    },
  });
  console.log(`🏢 Empresa creada: ${company.name} (id: ${company.id})`);

  // ── Crear usuario admin ──
  const passwordHash = await bcrypt.hash('12345678', 12);
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'admin@gmail.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'KallpaPro',
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`👤 Usuario creado: ${user.email}`);

  console.log('\n✅ Seed completado exitosamente!');
  console.log('─────────────────────────────────');
  console.log('  URL:        http://localhost:3001/login');
  console.log('  Email:      admin@gmail.com');
  console.log('  Contraseña: 12345678');
  console.log('─────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
