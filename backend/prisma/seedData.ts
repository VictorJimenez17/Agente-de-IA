export interface SeedVacanteInput {
  codigo: string;
  titulo: string;
  departamento: string;
  ubicacion: string;
  descripcion: string;
  requisitos: string;
  experienciaMinAnios: number;
  requiereRotativos: boolean;
  escolaridadMinima: string;
  habilidadesClave: string[];
  salarioMensual: number;
  cupo: number;
}

export interface SeedCandidatoInput {
  folio: string;
  nombre: string;
  email: string;
  ciudad: string;
  vacanteCodigo: string;
  experienciaAnios: number;
  disponibilidadRotativos: boolean;
  escolaridad: string;
  cvArchivoNombre: string;
}

export const SEED_VACANTES: SeedVacanteInput[] = [
  {
    codigo: "VAC-JC-01",
    titulo: "Jefe de Cocina",
    departamento: "Operaciones Culinarias",
    ubicacion: "CDMX Norte",
    descripcion:
      "Liderar la operacion diaria de cocina central, estandarizacion de recetas, control de mermas, inventarios y cumplimiento estricto de BPM.",
    requisitos:
      "Minimo 2 anos de experiencia liderando equipos de cocina o centro de produccion, preparatoria terminada (deseable gastronomia), manejo de BPM, Excel basico/intermedio y disponibilidad de turnos rotativos.",
    experienciaMinAnios: 2,
    requiereRotativos: true,
    escolaridadMinima: "Preparatoria",
    habilidadesClave: ["Liderazgo", "BPM", "Control de merma", "Excel", "Estandarizacion"],
    salarioMensual: 18000,
    cupo: 1,
  },
  {
    codigo: "VAC-AC-02",
    titulo: "Auxiliar de Cocina",
    departamento: "Operaciones Culinarias",
    ubicacion: "CDMX Centro",
    descripcion:
      "Preparacion de mise en place, montaje de platillos en linea fria y caliente, limpieza de estacion y apoyo en empaque de pedidos.",
    requisitos:
      "Minimo 1 ano de experiencia en cocina o dark kitchen, preparatoria terminada, conocimiento de BPM y disponibilidad completa para turnos rotativos.",
    experienciaMinAnios: 1,
    requiereRotativos: true,
    escolaridadMinima: "Preparatoria",
    habilidadesClave: ["BPM", "Mise en place", "Trabajo en equipo", "Limpieza", "Ritmo alto"],
    salarioMensual: 9500,
    cupo: 2,
  },
  {
    codigo: "VAC-AL-03",
    titulo: "Coordinador de Almacen e Inventarios",
    departamento: "Logistica y Abastecimiento",
    ubicacion: "Guadalajara",
    descripcion:
      "Recepcion, resguardo y distribucion de insumos perecederos y secos bajo sistema PEPS/FEFO, cadena de frio e inventarios ciclicos.",
    requisitos:
      "Minimo 2 anos en almacen de alimentos o perecederos, preparatoria o licenciatura afin, manejo de PEPS, cadena de frio, Excel y turnos rotativos.",
    experienciaMinAnios: 2,
    requiereRotativos: true,
    escolaridadMinima: "Preparatoria",
    habilidadesClave: ["PEPS", "Cadena de frio", "Inventarios", "Excel", "BPM"],
    salarioMensual: 13500,
    cupo: 1,
  },
];

export const SEED_CANDIDATOS: SeedCandidatoInput[] = [
  {
    folio: "CAN-001",
    nombre: "Lucía Fernández Rojas",
    email: "lucia.fernandez@ejemplo.local",
    ciudad: "CDMX Norte",
    vacanteCodigo: "VAC-JC-01",
    experienciaAnios: 6,
    disponibilidadRotativos: true,
    escolaridad: "Licenciatura en Gastronomía",
    cvArchivoNombre: "01-lucia-fernandez-jefe-cocina.txt",
  },
  {
    folio: "CAN-002",
    nombre: "Roberto Sánchez Pérez",
    email: "roberto.sanchez@ejemplo.local",
    ciudad: "CDMX Norte",
    vacanteCodigo: "VAC-JC-01",
    experienciaAnios: 3,
    disponibilidadRotativos: true,
    escolaridad: "Técnico en Alimentos y Bebidas",
    cvArchivoNombre: "02-roberto-sanchez-jefe-cocina.txt",
  },
  {
    folio: "CAN-003",
    nombre: "Diego Morales Salinas",
    email: "diego.morales@ejemplo.local",
    ciudad: "Estado de México",
    vacanteCodigo: "VAC-JC-01",
    experienciaAnios: 0.75,
    disponibilidadRotativos: true,
    escolaridad: "Secundaria",
    cvArchivoNombre: "03-diego-morales-jefe-cocina.txt",
  },
  {
    folio: "CAN-004",
    nombre: "Mariana Vega Ortiz",
    email: "mariana.vega@ejemplo.local",
    ciudad: "CDMX Centro",
    vacanteCodigo: "VAC-AC-02",
    experienciaAnios: 2.5,
    disponibilidadRotativos: true,
    escolaridad: "Técnico Superior en Gastronomía",
    cvArchivoNombre: "04-mariana-vega-auxiliar-cocina.txt",
  },
  {
    folio: "CAN-005",
    nombre: "Fernando Castro López",
    email: "fernando.castro@ejemplo.local",
    ciudad: "CDMX Centro",
    vacanteCodigo: "VAC-AC-02",
    experienciaAnios: 1.2,
    disponibilidadRotativos: true,
    escolaridad: "Preparatoria",
    cvArchivoNombre: "05-fernando-castro-auxiliar-cocina.txt",
  },
  {
    folio: "CAN-006",
    nombre: "Paola Ruiz Herrera",
    email: "paola.ruiz@ejemplo.local",
    ciudad: "CDMX Centro",
    vacanteCodigo: "VAC-AC-02",
    experienciaAnios: 2,
    disponibilidadRotativos: false,
    escolaridad: "Preparatoria",
    cvArchivoNombre: "06-paola-ruiz-auxiliar-cocina.txt",
  },
  {
    folio: "CAN-007",
    nombre: "Carlos Mendoza Ríos",
    email: "carlos.mendoza@ejemplo.local",
    ciudad: "CDMX Centro",
    vacanteCodigo: "VAC-AC-02",
    experienciaAnios: 0.5,
    disponibilidadRotativos: true,
    escolaridad: "Secundaria",
    cvArchivoNombre: "07-carlos-mendoza-cv-adversarial.txt",
  },
  {
    folio: "CAN-008",
    nombre: "Andrea Navarro Gómez",
    email: "andrea.navarro@ejemplo.local",
    ciudad: "Guadalajara",
    vacanteCodigo: "VAC-AL-03",
    experienciaAnios: 4,
    disponibilidadRotativos: true,
    escolaridad: "Licenciatura en Logística",
    cvArchivoNombre: "08-andrea-navarro-almacen.txt",
  },
  {
    folio: "CAN-009",
    nombre: "Héctor Luna Torres",
    email: "hector.luna@ejemplo.local",
    ciudad: "Guadalajara",
    vacanteCodigo: "VAC-AL-03",
    experienciaAnios: 1.5,
    disponibilidadRotativos: true,
    escolaridad: "Preparatoria",
    cvArchivoNombre: "09-hector-luna-almacen.txt",
  },
];
