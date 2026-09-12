/**
 * Catálogo CIIU (Clasificación Internacional Industrial Uniforme) — códigos comunes en Ecuador.
 * Basado en CIIU Rev. 4 adaptado por INEC/SRI Ecuador.
 * Fuente: códigos más usados en el sector comercial y de servicios.
 */

export interface CiiuCode {
  code: string;
  description: string;
  section: string;
}

export const CIIU_CODES: CiiuCode[] = [
  // Sección A — Agricultura
  { code: '0111', description: 'Cultivo de cereales', section: 'Agricultura' },
  { code: '0150', description: 'Cultivo y cría combinados', section: 'Agricultura' },
  { code: '0210', description: 'Silvicultura y explotación forestal', section: 'Agricultura' },

  // Sección C — Manufactura
  { code: '1010', description: 'Elaboración y conservación de carne', section: 'Manufactura' },
  { code: '1071', description: 'Elaboración de productos de panadería', section: 'Manufactura' },
  { code: '1410', description: 'Fabricación de prendas de vestir, excepto piel', section: 'Manufactura' },
  { code: '2511', description: 'Fabricación de productos metálicos estructurales', section: 'Manufactura' },
  { code: '3100', description: 'Fabricación de muebles', section: 'Manufactura' },

  // Sección F — Construcción
  { code: '4100', description: 'Construcción de edificios', section: 'Construcción' },
  { code: '4220', description: 'Construcción de proyectos de servicios públicos', section: 'Construcción' },
  { code: '4321', description: 'Instalaciones eléctricas', section: 'Construcción' },

  // Sección G — Comercio
  { code: '4510', description: 'Venta de vehículos automotores', section: 'Comercio' },
  { code: '4620', description: 'Venta al por mayor de materias primas agropecuarias', section: 'Comercio' },
  { code: '4630', description: 'Venta al por mayor de alimentos, bebidas y tabaco', section: 'Comercio' },
  { code: '4649', description: 'Venta al por mayor de enseres domésticos', section: 'Comercio' },
  { code: '4651', description: 'Venta al por mayor de computadoras y equipos periféricos', section: 'Comercio' },
  { code: '4659', description: 'Venta al por mayor de maquinaria y equipo', section: 'Comercio' },
  { code: '4711', description: 'Venta al por menor en supermercados', section: 'Comercio' },
  { code: '4719', description: 'Otras ventas al por menor en almacenes no especializados', section: 'Comercio' },
  { code: '4751', description: 'Venta al por menor de productos textiles', section: 'Comercio' },
  { code: '4774', description: 'Venta al por menor de bienes de segunda mano', section: 'Comercio' },

  // Sección H — Transporte
  { code: '4923', description: 'Transporte de carga por carretera', section: 'Transporte' },
  { code: '5210', description: 'Almacenamiento y depósito', section: 'Transporte' },
  { code: '5224', description: 'Manipulación de carga', section: 'Transporte' },

  // Sección I — Alojamiento y comidas
  { code: '5510', description: 'Actividades de alojamiento para estancias cortas', section: 'Alojamiento' },
  { code: '5610', description: 'Actividades de restaurantes y servicio móvil de comidas', section: 'Alojamiento' },

  // Sección J — TIC
  { code: '6201', description: 'Programación informática', section: 'TIC' },
  { code: '6202', description: 'Consultoría informática', section: 'TIC' },
  { code: '6311', description: 'Procesamiento de datos y hospedaje', section: 'TIC' },

  // Sección K — Finanzas
  { code: '6419', description: 'Otras actividades de intermediación monetaria', section: 'Finanzas' },
  { code: '6512', description: 'Planes de seguros generales', section: 'Finanzas' },

  // Sección L — Inmobiliaria
  { code: '6810', description: 'Actividades inmobiliarias con bienes propios', section: 'Inmobiliaria' },

  // Sección M — Profesional
  { code: '6920', description: 'Actividades de contabilidad, auditoría y consultoría tributaria', section: 'Servicios' },
  { code: '7010', description: 'Actividades de oficinas principales', section: 'Servicios' },
  { code: '7110', description: 'Actividades de arquitectura e ingeniería', section: 'Servicios' },

  // Sección N — Administrativos
  { code: '7711', description: 'Alquiler de vehículos automotores', section: 'Servicios' },
  { code: '8110', description: 'Actividades combinadas de apoyo a instalaciones', section: 'Servicios' },

  // Sección Q — Salud
  { code: '8610', description: 'Actividades de hospitales', section: 'Salud' },
  { code: '8620', description: 'Actividades de médicos y odontólogos', section: 'Salud' },

  // Otros
  { code: '9999', description: 'Otra actividad no especificada', section: 'Otros' },
];

/** Búsqueda fuzzy simple por código o descripción */
export function searchCiiu(query: string): CiiuCode[] {
  if (!query.trim()) return CIIU_CODES.slice(0, 10);
  const q = query.toLowerCase();
  return CIIU_CODES.filter(
    (c) => c.code.includes(q) || c.description.toLowerCase().includes(q) || c.section.toLowerCase().includes(q)
  ).slice(0, 20);
}

export function findCiiuByCode(code: string): CiiuCode | undefined {
  return CIIU_CODES.find((c) => c.code === code);
}
