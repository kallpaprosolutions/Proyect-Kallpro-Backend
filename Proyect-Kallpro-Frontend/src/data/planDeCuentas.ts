/**
 * Plan de Cuentas — Ecuador Superintendencia de Compañías
 * Basado en: NIIF para PYMES + Resolución SC.ICI.CPAIFRS.G.11.010
 * Estructura jerárquica por grupos, clases y cuentas.
 */

export interface Cuenta {
  codigo: string;
  nombre: string;
  tipo: 'grupo' | 'subgrupo' | 'cuenta' | 'subcuenta';
  naturaleza: 'deudora' | 'acreedora';
  categoria: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'egreso' | 'costo';
  nivel: number;   // 1 = elemento, 2 = grupo, 3 = subgrupo, 4 = cuenta, 5+ = subcuenta
  parentCodigo?: string;
  descripcion?: string;
}

const cuentas: Cuenta[] = [
  // ═══════════════════════════════════════════════════════════
  // 1  ACTIVOS
  // ═══════════════════════════════════════════════════════════
  { codigo: '1',    nombre: 'ACTIVO',                                        tipo: 'grupo',     naturaleza: 'deudora',   categoria: 'activo',    nivel: 1 },
  { codigo: '11',   nombre: 'ACTIVO CORRIENTE',                              tipo: 'grupo',     naturaleza: 'deudora',   categoria: 'activo',    nivel: 2, parentCodigo: '1' },

  { codigo: '1101', nombre: 'EFECTIVO Y EQUIVALENTES AL EFECTIVO',           tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '11',
    descripcion: 'Moneda de curso legal en caja, depósitos bancarios a la vista, inversiones de alta liquidez' },
  { codigo: '110101', nombre: 'CAJA',                                        tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1101' },
  { codigo: '110102', nombre: 'BANCOS',                                      tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1101' },
  { codigo: '110103', nombre: 'INVERSIONES TEMPORALES (MENOS DE 3 MESES)',   tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1101' },

  { codigo: '1102', nombre: 'ACTIVOS FINANCIEROS',                           tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '11',
    descripcion: 'Cuentas por cobrar, documentos por cobrar, préstamos, inversiones financieras' },
  { codigo: '110201', nombre: 'ACTIVOS FINANCIEROS AL VALOR RAZONABLE CON CAMBIOS EN RESULTADOS', tipo: 'cuenta', naturaleza: 'deudora', categoria: 'activo', nivel: 4, parentCodigo: '1102' },
  { codigo: '110205', nombre: 'DOCUMENTOS Y CUENTAS POR COBRAR CLIENTES NO RELACIONADOS', tipo: 'cuenta', naturaleza: 'deudora', categoria: 'activo', nivel: 4, parentCodigo: '1102' },
  { codigo: '110206', nombre: 'DOCUMENTOS Y CUENTAS POR COBRAR CLIENTES RELACIONADOS',   tipo: 'cuenta', naturaleza: 'deudora', categoria: 'activo', nivel: 4, parentCodigo: '1102' },
  { codigo: '110207', nombre: 'OTRAS CUENTAS POR COBRAR RELACIONADAS',                   tipo: 'cuenta', naturaleza: 'deudora', categoria: 'activo', nivel: 4, parentCodigo: '1102' },
  { codigo: '110209', nombre: 'OTRAS CUENTAS POR COBRAR',                                tipo: 'cuenta', naturaleza: 'deudora', categoria: 'activo', nivel: 4, parentCodigo: '1102' },
  { codigo: '110210', nombre: '(-) PROVISIÓN CUENTAS INCOBRABLES Y DETERIORO',           tipo: 'cuenta', naturaleza: 'acreedora', categoria: 'activo', nivel: 4, parentCodigo: '1102' },

  { codigo: '1103', nombre: 'INVENTARIOS',                                   tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '11',
    descripcion: 'Mercaderías, productos terminados, productos en proceso, materias primas' },
  { codigo: '110301', nombre: 'INVENTARIOS DE MATERIA PRIMA',                tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1103' },
  { codigo: '110302', nombre: 'INVENTARIOS DE PRODUCTOS EN PROCESO',         tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1103' },
  { codigo: '110303', nombre: 'INVENTARIOS DE SUMINISTROS O MATERIALES',     tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1103' },
  { codigo: '110304', nombre: 'INVENTARIOS DE PROD. TERM. Y MERCAD. EN ALMACÉN — PRODUCCIÓN PROPIA', tipo: 'cuenta', naturaleza: 'deudora', categoria: 'activo', nivel: 4, parentCodigo: '1103' },
  { codigo: '110306', nombre: 'INVENTARIOS DE PROD. TERM. Y MERCAD. EN ALMACÉN — COMPRADO A TERCEROS', tipo: 'cuenta', naturaleza: 'deudora', categoria: 'activo', nivel: 4, parentCodigo: '1103' },
  { codigo: '110307', nombre: 'MERCADERÍAS EN TRÁNSITO',                     tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1103' },
  { codigo: '110308', nombre: '(-) PROVISIÓN POR VALOR NETO DE REALIZACIÓN Y OTRAS PÉRDIDAS', tipo: 'cuenta', naturaleza: 'acreedora', categoria: 'activo', nivel: 4, parentCodigo: '1103' },

  { codigo: '1104', nombre: 'SERVICIOS Y OTROS PAGOS ANTICIPADOS',           tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '11' },
  { codigo: '110401', nombre: 'SEGUROS PAGADOS POR ANTICIPADO',              tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1104' },
  { codigo: '110402', nombre: 'ARRIENDOS PAGADOS POR ANTICIPADO',            tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1104' },
  { codigo: '110403', nombre: 'ANTICIPOS A PROVEEDORES',                     tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1104' },
  { codigo: '110404', nombre: 'OTROS ANTICIPOS ENTREGADOS',                  tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1104' },

  { codigo: '1105', nombre: 'ACTIVOS POR IMPUESTOS CORRIENTES',              tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '11' },
  { codigo: '110501', nombre: 'CRÉDITO TRIBUTARIO A FAVOR (IVA)',            tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1105' },
  { codigo: '110502', nombre: 'CRÉDITO TRIBUTARIO A FAVOR (I.R.)',           tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1105' },
  { codigo: '110503', nombre: 'ANTICIPO DE IMPUESTO A LA RENTA',             tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1105' },

  { codigo: '1107', nombre: 'CONSTRUCCIONES EN PROCESO (NIC 11 / SECC. 23)', tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '11',
    descripcion: 'Uso exclusivo empresas constructoras e inmobiliarias' },

  { codigo: '12',   nombre: 'ACTIVO NO CORRIENTE',                           tipo: 'grupo',     naturaleza: 'deudora',   categoria: 'activo',    nivel: 2, parentCodigo: '1' },

  { codigo: '1201', nombre: 'PROPIEDADES, PLANTA Y EQUIPO',                  tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '12' },
  { codigo: '120101', nombre: 'TERRENOS',                                    tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1201' },
  { codigo: '120102', nombre: 'EDIFICIOS',                                   tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1201' },
  { codigo: '120103', nombre: 'CONSTRUCCIONES EN CURSO',                     tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1201' },
  { codigo: '120104', nombre: 'INSTALACIONES',                               tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1201' },
  { codigo: '120105', nombre: 'MUEBLES Y ENSERES',                           tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1201' },
  { codigo: '120106', nombre: 'MAQUINARIA Y EQUIPO',                         tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1201' },
  { codigo: '120107', nombre: 'EQUIPO DE COMPUTACIÓN Y SOFTWARE',            tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1201' },
  { codigo: '120108', nombre: 'VEHÍCULOS, EQUIPOS DE TRANSPORTE',            tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1201' },
  { codigo: '120109', nombre: 'OTROS PROPIEDADES, PLANTA Y EQUIPO',          tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1201' },
  { codigo: '120110', nombre: '(-) DEPRECIACIÓN ACUMULADA PROPIEDADES, PLANTA Y EQUIPO', tipo: 'cuenta', naturaleza: 'acreedora', categoria: 'activo', nivel: 4, parentCodigo: '1201' },
  { codigo: '120111', nombre: '(-) DETERIORO ACUMULADO DE PROPIEDADES, PLANTA Y EQUIPO', tipo: 'cuenta', naturaleza: 'acreedora', categoria: 'activo', nivel: 4, parentCodigo: '1201' },

  { codigo: '1202', nombre: 'PROPIEDADES DE INVERSIÓN',                      tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '12' },
  { codigo: '1203', nombre: 'ACTIVOS BIOLÓGICOS',                            tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '12' },
  { codigo: '1204', nombre: 'ACTIVO INTANGIBLE',                             tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '12' },
  { codigo: '120401', nombre: 'MARCAS, PATENTES, DERECHOS DE LLAVE Y OTROS', tipo: 'cuenta',   naturaleza: 'deudora',   categoria: 'activo',    nivel: 4, parentCodigo: '1204' },
  { codigo: '120402', nombre: '(-) AMORTIZACIÓN ACUMULADA DE ACTIVO INTANGIBLE', tipo: 'cuenta', naturaleza: 'acreedora', categoria: 'activo', nivel: 4, parentCodigo: '1204' },
  { codigo: '1205', nombre: 'ACTIVOS POR IMPUESTOS DIFERIDOS',               tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '12' },
  { codigo: '1206', nombre: 'ACTIVOS FINANCIEROS NO CORRIENTES',             tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '12' },
  { codigo: '1207', nombre: 'OTROS ACTIVOS NO CORRIENTES',                   tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'activo',    nivel: 3, parentCodigo: '12' },

  // ═══════════════════════════════════════════════════════════
  // 2  PASIVOS
  // ═══════════════════════════════════════════════════════════
  { codigo: '2',    nombre: 'PASIVO',                                        tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 1 },
  { codigo: '21',   nombre: 'PASIVO CORRIENTE',                              tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 2, parentCodigo: '2' },

  { codigo: '2101', nombre: 'CUENTAS Y DOCUMENTOS POR PAGAR',                tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '21' },
  { codigo: '210101', nombre: 'CUENTAS Y DOCUMENTOS POR PAGAR — LOCALES',    tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 4, parentCodigo: '2101' },
  { codigo: '210102', nombre: 'CUENTAS Y DOCUMENTOS POR PAGAR — EXTERIOR',   tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 4, parentCodigo: '2101' },

  { codigo: '2102', nombre: 'OBLIGACIONES CON INSTITUCIONES FINANCIERAS',    tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '21' },
  { codigo: '210201', nombre: 'OBLIGACIONES CON INSTITUCIONES FINANCIERAS LOCALES', tipo: 'cuenta', naturaleza: 'acreedora', categoria: 'pasivo', nivel: 4, parentCodigo: '2102' },
  { codigo: '210202', nombre: 'OBLIGACIONES CON INSTITUCIONES FINANCIERAS DEL EXTERIOR', tipo: 'cuenta', naturaleza: 'acreedora', categoria: 'pasivo', nivel: 4, parentCodigo: '2102' },

  { codigo: '2103', nombre: 'CUENTAS Y DOCUMENTOS POR PAGAR A PROVEEDORES',  tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '21' },
  { codigo: '2104', nombre: 'OBLIGACIONES CON INSTITUCIONES FINANCIERAS CP', tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '21' },

  { codigo: '2107', nombre: 'OTRAS OBLIGACIONES CORRIENTES',                 tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '21' },
  { codigo: '210701', nombre: 'CON LA ADMINISTRACIÓN TRIBUTARIA',            tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 4, parentCodigo: '2107' },
  { codigo: '210702', nombre: 'IMPUESTO A LA RENTA POR PAGAR DEL EJERCICIO', tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 4, parentCodigo: '2107' },
  { codigo: '210703', nombre: 'CON EL IESS',                                 tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 4, parentCodigo: '2107' },
  { codigo: '210704', nombre: 'POR BENEFICIOS DE LEY A EMPLEADOS',           tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 4, parentCodigo: '2107' },
  { codigo: '210705', nombre: 'PARTICIPACIÓN TRABAJADORES POR PAGAR',        tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 4, parentCodigo: '2107' },

  { codigo: '2110', nombre: 'ANTICIPO DE CLIENTES',                          tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '21' },
  { codigo: '2112', nombre: 'PORCIÓN CORRIENTE DE OBLIGACIONES LP',          tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '21' },
  { codigo: '2113', nombre: 'OTROS PASIVOS CORRIENTES',                      tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '21' },
  { codigo: '2114', nombre: 'OBLIGACIONES TRIBUTARIAS',                      tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '21' },

  { codigo: '22',   nombre: 'PASIVO NO CORRIENTE',                           tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 2, parentCodigo: '2' },
  { codigo: '2202', nombre: 'CUENTAS Y DOCUMENTOS POR PAGAR LP',             tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '22' },
  { codigo: '2204', nombre: 'OBLIGACIONES CON INSTITUCIONES FINANCIERAS LP', tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '22' },
  { codigo: '2206', nombre: 'ANTICIPO DE CLIENTES A LARGO PLAZO',            tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '22' },
  { codigo: '2207', nombre: 'PROVISIONES POR BENEFICIOS A EMPLEADOS LP',     tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '22' },
  { codigo: '2208', nombre: 'OTRAS PROVISIONES',                             tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '22' },
  { codigo: '2209', nombre: 'PASIVO DIFERIDO',                               tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '22' },
  { codigo: '2210', nombre: 'OTROS PASIVOS NO CORRIENTES',                   tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'pasivo',    nivel: 3, parentCodigo: '22' },

  // ═══════════════════════════════════════════════════════════
  // 3  PATRIMONIO NETO
  // ═══════════════════════════════════════════════════════════
  { codigo: '3',    nombre: 'PATRIMONIO NETO',                                tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 1 },
  { codigo: '31',   nombre: 'CAPITAL',                                        tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 2, parentCodigo: '3' },
  { codigo: '3101', nombre: 'CAPITAL SUSCRITO O ASIGNADO',                   tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 3, parentCodigo: '31' },
  { codigo: '3102', nombre: '(-) CAPITAL SUSCRITO NO PAGADO',                tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'patrimonio', nivel: 3, parentCodigo: '31' },
  { codigo: '3103', nombre: '(-) ACCIONES EN TESORERÍA',                     tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'patrimonio', nivel: 3, parentCodigo: '31' },

  { codigo: '32',   nombre: 'APORTE DE SOCIOS/ACCIONISTAS PARA FUTURA CAPITALIZACIÓN', tipo: 'grupo', naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 2, parentCodigo: '3' },
  { codigo: '33',   nombre: 'PRIMA POR EMISIÓN PRIMARIA DE ACCIONES',        tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 2, parentCodigo: '3' },

  { codigo: '34',   nombre: 'RESERVAS',                                       tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 2, parentCodigo: '3' },
  { codigo: '3401', nombre: 'RESERVA LEGAL',                                  tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 3, parentCodigo: '34',
    descripcion: '10% de la utilidad hasta alcanzar el 50% del capital social' },
  { codigo: '3402', nombre: 'RESERVAS ESTATUTARIAS',                         tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 3, parentCodigo: '34' },
  { codigo: '3403', nombre: 'RESERVAS FACULTATIVAS',                         tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 3, parentCodigo: '34' },
  { codigo: '3404', nombre: 'RESERVA DE CAPITAL',                            tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 3, parentCodigo: '34' },

  { codigo: '35',   nombre: 'OTROS RESULTADOS INTEGRALES',                   tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 2, parentCodigo: '3' },
  { codigo: '3501', nombre: 'SUPERÁVIT POR REVALUACIÓN DE PROPIEDADES, PLANTA Y EQUIPO', tipo: 'cuenta', naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 3, parentCodigo: '35' },
  { codigo: '3502', nombre: 'GANANCIA/PÉRDIDA ACTUARIAL EN PLANES DE BENEFICIOS DEFINIDOS', tipo: 'cuenta', naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 3, parentCodigo: '35' },

  { codigo: '36',   nombre: 'RESULTADOS ACUMULADOS',                         tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 2, parentCodigo: '3' },
  { codigo: '3601', nombre: 'GANANCIAS ACUMULADAS',                          tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 3, parentCodigo: '36' },
  { codigo: '3602', nombre: '(-) PÉRDIDAS ACUMULADAS',                       tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'patrimonio', nivel: 3, parentCodigo: '36' },
  { codigo: '3603', nombre: 'RESULTADOS ACUMULADOS PROVENIENTES DE ADOPCIÓN DE NIIF', tipo: 'cuenta', naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 3, parentCodigo: '36' },

  { codigo: '37',   nombre: 'RESULTADOS DEL EJERCICIO',                      tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 2, parentCodigo: '3' },
  { codigo: '3701', nombre: 'GANANCIA NETA DEL PERÍODO',                     tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'patrimonio', nivel: 3, parentCodigo: '37' },
  { codigo: '3702', nombre: '(-) PÉRDIDA NETA DEL PERÍODO',                  tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'patrimonio', nivel: 3, parentCodigo: '37' },

  // ═══════════════════════════════════════════════════════════
  // 4  INGRESOS
  // ═══════════════════════════════════════════════════════════
  { codigo: '4',    nombre: 'INGRESOS',                                       tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 1 },
  { codigo: '41',   nombre: 'INGRESOS DE ACTIVIDADES ORDINARIAS',            tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 2, parentCodigo: '4' },

  { codigo: '4101', nombre: 'VENTA DE BIENES',                               tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 3, parentCodigo: '41' },
  { codigo: '410101', nombre: 'VENTA DE BIENES LOCALES (GRAVADOS IVA 15%)',  tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 4, parentCodigo: '4101' },
  { codigo: '410102', nombre: 'VENTA DE BIENES LOCALES (TARIFA 0%)',         tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 4, parentCodigo: '4101' },
  { codigo: '410103', nombre: 'EXPORTACIONES DE BIENES',                     tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 4, parentCodigo: '4101' },

  { codigo: '4102', nombre: 'PRESTACIÓN DE SERVICIOS',                       tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 3, parentCodigo: '41' },
  { codigo: '4103', nombre: 'CONTRATOS DE CONSTRUCCIÓN',                     tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 3, parentCodigo: '41' },
  { codigo: '4105', nombre: 'OTROS INGRESOS DE ACTIVIDADES ORDINARIAS',      tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 3, parentCodigo: '41' },
  { codigo: '410501', nombre: 'ALQUILER / ARRENDAMIENTO',                    tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 4, parentCodigo: '4105' },
  { codigo: '410502', nombre: 'COMISIONES',                                  tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 4, parentCodigo: '4105' },
  { codigo: '410503', nombre: 'REGALÍAS',                                    tipo: 'cuenta',    naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 4, parentCodigo: '4105' },

  { codigo: '43',   nombre: 'OTROS INGRESOS',                                tipo: 'grupo',     naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 2, parentCodigo: '4' },
  { codigo: '4301', nombre: 'DIVIDENDOS',                                    tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 3, parentCodigo: '43' },
  { codigo: '4302', nombre: 'INTERESES FINANCIEROS GANADOS',                 tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 3, parentCodigo: '43' },
  { codigo: '4303', nombre: 'GANANCIA EN VENTA DE ACTIVOS',                  tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 3, parentCodigo: '43' },
  { codigo: '4304', nombre: 'OTROS INGRESOS NO OPERACIONALES',               tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 3, parentCodigo: '43' },
  { codigo: '4305', nombre: 'INGRESO POR SUBVENCIONES DEL GOBIERNO',         tipo: 'subgrupo',  naturaleza: 'acreedora', categoria: 'ingreso',   nivel: 3, parentCodigo: '43' },

  // ═══════════════════════════════════════════════════════════
  // 5  GASTOS / EGRESOS
  // ═══════════════════════════════════════════════════════════
  { codigo: '5',    nombre: 'GASTOS / EGRESOS',                               tipo: 'grupo',     naturaleza: 'deudora',   categoria: 'egreso',   nivel: 1 },

  { codigo: '51',   nombre: 'COSTO DE VENTAS Y PRODUCCIÓN',                  tipo: 'grupo',     naturaleza: 'deudora',   categoria: 'costo',   nivel: 2, parentCodigo: '5' },
  { codigo: '5101', nombre: 'MATERIALES UTILIZADOS O PRODUCTOS VENDIDOS',    tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'costo',   nivel: 3, parentCodigo: '51' },
  { codigo: '5102', nombre: 'MANO DE OBRA DIRECTA',                          tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'costo',   nivel: 3, parentCodigo: '51' },
  { codigo: '5103', nombre: 'MANO DE OBRA INDIRECTA',                        tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'costo',   nivel: 3, parentCodigo: '51' },
  { codigo: '5104', nombre: 'COSTOS INDIRECTOS DE FABRICACIÓN',              tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'costo',   nivel: 3, parentCodigo: '51' },
  { codigo: '510401', nombre: 'DEPRECIACIÓN PROPIEDADES, PLANTA Y EQUIPO',   tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'costo',   nivel: 4, parentCodigo: '5104' },
  { codigo: '510402', nombre: 'DETERIORO DE INVENTARIO',                     tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'costo',   nivel: 4, parentCodigo: '5104' },

  { codigo: '52',   nombre: 'GASTOS',                                         tipo: 'grupo',     naturaleza: 'deudora',   categoria: 'egreso',   nivel: 2, parentCodigo: '5' },

  { codigo: '5201', nombre: 'GASTOS DE VENTAS',                              tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'egreso',   nivel: 3, parentCodigo: '52' },
  { codigo: '520101', nombre: 'SUELDOS Y DEMÁS REMUNERACIONES (VENTAS)',     tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5201' },
  { codigo: '520102', nombre: 'APORTES A LA SEGURIDAD SOCIAL (VENTAS)',      tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5201' },
  { codigo: '520111', nombre: 'PROMOCIÓN Y PUBLICIDAD',                      tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5201' },
  { codigo: '520112', nombre: 'COMISIONES VENTAS',                           tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5201' },
  { codigo: '520118', nombre: 'SERVICIOS BÁSICOS (VENTAS)',                  tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5201' },
  { codigo: '520127', nombre: 'OTROS GASTOS DE VENTAS',                      tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5201' },

  { codigo: '5202', nombre: 'GASTOS ADMINISTRATIVOS',                        tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'egreso',   nivel: 3, parentCodigo: '52' },
  { codigo: '520201', nombre: 'SUELDOS Y DEMÁS REMUNERACIONES (ADM)',        tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5202' },
  { codigo: '520202', nombre: 'APORTES A LA SEGURIDAD SOCIAL (ADM)',         tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5202' },
  { codigo: '520203', nombre: 'BENEFICIOS SOCIALES E INDEMNIZACIONES',       tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5202' },
  { codigo: '520204', nombre: 'PLANES DE BENEFICIOS A EMPLEADOS',            tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5202' },
  { codigo: '520218', nombre: 'SERVICIOS BÁSICOS (ADM)',                     tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5202' },
  { codigo: '520220', nombre: 'IMPUESTOS, CONTRIBUCIONES Y OTROS',           tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5202' },
  { codigo: '520221', nombre: 'DEPRECIACIONES (ADM)',                        tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5202',
    descripcion: 'Depreciación de propiedades, planta y equipo de uso administrativo' },
  { codigo: '520223', nombre: 'GASTO PROPIEDAD, PLANTA Y EQUIPO',            tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5202' },
  { codigo: '520228', nombre: 'OTROS GASTOS ADMINISTRATIVOS',                tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5202' },

  { codigo: '5203', nombre: 'GASTOS FINANCIEROS',                            tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'egreso',   nivel: 3, parentCodigo: '52' },
  { codigo: '520301', nombre: 'INTERESES',                                   tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5203' },
  { codigo: '520302', nombre: 'COMISIONES Y GASTOS BANCARIOS',               tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5203' },
  { codigo: '520303', nombre: 'PÉRDIDAS EN INVERSIONES EN SUBSIDIARIAS',     tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5203' },
  { codigo: '520306', nombre: 'PÉRDIDA EN VENTA DE ACTIVOS',                 tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5203' },

  { codigo: '5204', nombre: 'OTROS GASTOS',                                  tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'egreso',   nivel: 3, parentCodigo: '52' },
  { codigo: '520401', nombre: 'GASTOS POR IMPUESTO A LA RENTA',              tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5204' },
  { codigo: '520402', nombre: 'OTROS GASTOS NO OPERACIONALES',               tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5204' },
  { codigo: '520403', nombre: 'GASTOS NO DEDUCIBLES',                        tipo: 'cuenta',    naturaleza: 'deudora',   categoria: 'egreso',   nivel: 4, parentCodigo: '5204' },

  // ═══════════════════════════════════════════════════════════
  // 6  COSTOS DE PRODUCCIÓN (empresas industriales)
  // ═══════════════════════════════════════════════════════════
  { codigo: '6',    nombre: 'COSTOS DE PRODUCCIÓN Y VENTAS',                 tipo: 'grupo',     naturaleza: 'deudora',   categoria: 'costo',   nivel: 1,
    descripcion: 'Aplica para empresas industriales / manufactureras' },
  { codigo: '61',   nombre: 'COSTOS DE FABRICACIÓN',                         tipo: 'grupo',     naturaleza: 'deudora',   categoria: 'costo',   nivel: 2, parentCodigo: '6' },
  { codigo: '6101', nombre: 'MATERIA PRIMA',                                 tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'costo',   nivel: 3, parentCodigo: '61' },
  { codigo: '6102', nombre: 'MANO DE OBRA DIRECTA',                          tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'costo',   nivel: 3, parentCodigo: '61' },
  { codigo: '6103', nombre: 'COSTOS GENERALES DE FABRICACIÓN',               tipo: 'subgrupo',  naturaleza: 'deudora',   categoria: 'costo',   nivel: 3, parentCodigo: '61' },
];

export default cuentas;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns only accounts at the given level */
export const porNivel = (nivel: number) => cuentas.filter(c => c.nivel === nivel);

/** Returns children of a given parent code */
export const hijosde = (parentCodigo: string) => cuentas.filter(c => c.parentCodigo === parentCodigo);

/** Search by code or name (case-insensitive) */
export const buscar = (q: string) => {
  const lower = q.toLowerCase();
  return cuentas.filter(c =>
    c.codigo.includes(q) || c.nombre.toLowerCase().includes(lower)
  );
};

/** Category color for UI */
export const categoriaColor: Record<string, string> = {
  activo:     'bg-blue-50 text-blue-700 border-blue-200',
  pasivo:     'bg-red-50 text-red-700 border-red-200',
  patrimonio: 'bg-purple-50 text-purple-700 border-purple-200',
  ingreso:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  egreso:     'bg-orange-50 text-orange-700 border-orange-200',
  costo:      'bg-amber-50 text-amber-700 border-amber-200',
};

export const categoriaBadge: Record<string, string> = {
  activo:     '🏦 Activo',
  pasivo:     '💳 Pasivo',
  patrimonio: '💰 Patrimonio',
  ingreso:    '📈 Ingreso',
  egreso:     '📉 Egreso',
  costo:      '🏭 Costo',
};
