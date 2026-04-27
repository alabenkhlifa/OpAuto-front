import {
  PrismaClient,
  UserRole,
  AppointmentStatus,
  CustomerStatus,
  EmployeeRole,
  EmployeeDepartment,
  EmployeeStatus,
  MaintenanceStatus,
  InvoiceStatus,
  PaymentMethod,
  NotificationType,
  AiActionKind,
  AiActionStatus,
  DiscountKind,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ───────────────────────────────────────────────────────────────────────────
// Deterministic RNG so consecutive seeds produce identical data
// ───────────────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260427);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const randFloat = (min: number, max: number) => rand() * (max - min) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const pickN = <T>(arr: readonly T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
};
const chance = (p: number) => rand() < p;

// ───────────────────────────────────────────────────────────────────────────
// Calendar
// ───────────────────────────────────────────────────────────────────────────
const TODAY = new Date('2026-04-27T12:00:00Z');
const YEAR_START = new Date('2026-01-01T08:00:00Z');
const YEAR_END = new Date('2026-12-31T18:00:00Z');

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const isWorkingDay = (d: Date) => d.getUTCDay() !== 0; // Sunday closed
const setHM = (d: Date, h: number, m = 0) => {
  const x = new Date(d);
  x.setUTCHours(h, m, 0, 0);
  return x;
};
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const monthsBetween = (a: Date, b: Date) =>
  (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();

// ───────────────────────────────────────────────────────────────────────────
// Static catalogs
// ───────────────────────────────────────────────────────────────────────────
const CAR_FLEET = [
  { make: 'Renault',    models: ['Clio','Megane','Symbol','Captur','Kadjar'] },
  { make: 'Peugeot',    models: ['208','308','3008','Partner','2008'] },
  { make: 'Volkswagen', models: ['Polo','Golf','Passat','Tiguan','T-Cross'] },
  { make: 'Hyundai',    models: ['i10','i20','i30','Tucson','Kona'] },
  { make: 'Kia',        models: ['Picanto','Rio','Sportage','Cerato'] },
  { make: 'Dacia',      models: ['Sandero','Logan','Duster','Lodgy'] },
  { make: 'Citroen',    models: ['C3','C4','Berlingo','C-Elysee'] },
  { make: 'Fiat',       models: ['500','Tipo','Doblo','Panda'] },
  { make: 'Toyota',     models: ['Yaris','Corolla','RAV4','Hilux'] },
  { make: 'Ford',       models: ['Fiesta','Focus','Kuga','Ranger'] },
  { make: 'Skoda',      models: ['Fabia','Octavia','Karoq'] },
  { make: 'Seat',       models: ['Ibiza','Leon','Arona'] },
] as const;

const COLORS = ['White','Black','Silver','Gray','Red','Blue','Green','Beige'] as const;
const ENGINES = ['petrol','diesel','hybrid'] as const;
const TRANSMISSIONS = ['manual','automatic'] as const;

const TUNISIAN_FIRSTS_M = ['Mohamed','Ahmed','Ali','Omar','Karim','Sami','Hatem','Mehdi','Walid','Skander','Nizar','Tarek','Yassine','Bilel','Hichem','Anis','Slim','Aymen','Khaled','Marwen','Riadh','Naoufel'];
const TUNISIAN_FIRSTS_F = ['Fatma','Leila','Yasmine','Amira','Rim','Nadia','Ines','Sana','Hela','Asma','Sonia','Salma','Khaoula','Wafa','Donia','Houda','Mouna','Nesrine','Maha','Olfa'];
const TUNISIAN_LASTS = ['Ben Ali','Ben Salah','Ben Mansour','Trabelsi','Mahmoud','Sassi','Gharbi','Khelifi','Bouzid','Jebali','Mrad','Zouari','Ferchichi','Belhaj','Mansouri','Chaabane','Hamdi','Ben Khlifa','Hamrouni','Ayadi','Ben Younes','Karoui','Bouazizi','Saidi','Romdhani','Hassine','Ben Ammar'];
const TUNISIAN_CITIES = ['Tunis','La Marsa','Carthage','Sidi Bou Said','Ariana','Manouba','Ben Arous','Sousse','Hammamet','Nabeul','Bizerte','Sfax','Monastir','Mahdia','Kairouan','Gabes','Gafsa','Djerba','Kasserine','Beja'];

// Service templates: each consumes a labor item + zero or more parts (matched by category/name)
type ServiceTemplate = {
  type: string;
  title: string;
  laborHours: [number, number];
  laborRate: number; // TND per hour
  partsNeeded: { category: string; namePrefix?: string; qty?: number }[];
  priorityWeights: { low: number; medium: number; high: number };
};
const SERVICES: ServiceTemplate[] = [
  { type: 'oil-change',          title: 'Oil & Filter Change',       laborHours: [0.75, 1.25], laborRate: 40, partsNeeded: [{ category: 'Filters', namePrefix: 'Oil Filter' }, { category: 'Fluids', namePrefix: 'Engine Oil' }],                          priorityWeights: { low: 60, medium: 35, high: 5 } },
  { type: 'oil-change',          title: 'Major Service (oil + filters + plugs)', laborHours: [2.5, 3.5], laborRate: 40, partsNeeded: [{ category: 'Filters', namePrefix: 'Oil Filter' }, { category: 'Filters', namePrefix: 'Air Filter' }, { category: 'Filters', namePrefix: 'Cabin' }, { category: 'Fluids', namePrefix: 'Engine Oil' }, { category: 'Ignition', qty: 4 }],                          priorityWeights: { low: 10, medium: 60, high: 30 } },
  { type: 'brake-service',       title: 'Front Brake Pads',           laborHours: [1.5, 2.5], laborRate: 45, partsNeeded: [{ category: 'Brakes', namePrefix: 'Brake Pads - Front' }],                                          priorityWeights: { low: 5, medium: 50, high: 45 } },
  { type: 'brake-service',       title: 'Rear Brake Pads',            laborHours: [1.5, 2.5], laborRate: 45, partsNeeded: [{ category: 'Brakes', namePrefix: 'Brake Pads - Rear' }],                                           priorityWeights: { low: 5, medium: 50, high: 45 } },
  { type: 'brake-service',       title: 'Front Brake Discs + Pads',   laborHours: [3, 4],     laborRate: 45, partsNeeded: [{ category: 'Brakes', namePrefix: 'Brake Pads - Front' }, { category: 'Brakes', namePrefix: 'Brake Disc' }], priorityWeights: { low: 0, medium: 30, high: 70 } },
  { type: 'brake-service',       title: 'Brake Fluid Flush',          laborHours: [1, 1.5],   laborRate: 40, partsNeeded: [{ category: 'Fluids', namePrefix: 'Brake Fluid' }],                                                  priorityWeights: { low: 30, medium: 60, high: 10 } },
  { type: 'tire-replacement',    title: 'Set of 4 New Tires',         laborHours: [1.5, 2],   laborRate: 30, partsNeeded: [{ category: 'Tires', qty: 4 }],                                                                       priorityWeights: { low: 30, medium: 60, high: 10 } },
  { type: 'tire-replacement',    title: 'Wheel Alignment + Balance',  laborHours: [1, 1.5],   laborRate: 30, partsNeeded: [],                                                                                                    priorityWeights: { low: 50, medium: 45, high: 5 } },
  { type: 'tire-replacement',    title: 'Tire Rotation',              laborHours: [0.5, 1],   laborRate: 25, partsNeeded: [],                                                                                                    priorityWeights: { low: 70, medium: 28, high: 2 } },
  { type: 'electrical',          title: 'Battery Replacement',        laborHours: [0.5, 1],   laborRate: 35, partsNeeded: [{ category: 'Electrical', namePrefix: 'Battery' }],                                                  priorityWeights: { low: 10, medium: 60, high: 30 } },
  { type: 'electrical',          title: 'Alternator Replacement',     laborHours: [3, 4],     laborRate: 45, partsNeeded: [{ category: 'Electrical', namePrefix: 'Alternator' }],                                               priorityWeights: { low: 0, medium: 30, high: 70 } },
  { type: 'electrical',          title: 'AC Service & Recharge',      laborHours: [1, 2],     laborRate: 45, partsNeeded: [{ category: 'Fluids', namePrefix: 'AC Refrigerant' }],                                               priorityWeights: { low: 40, medium: 50, high: 10 } },
  { type: 'engine-diagnostics',  title: 'ECU Diagnostics',            laborHours: [1, 2],     laborRate: 50, partsNeeded: [],                                                                                                    priorityWeights: { low: 20, medium: 60, high: 20 } },
  { type: 'engine-diagnostics',  title: 'Spark Plug Replacement',     laborHours: [1, 1.5],   laborRate: 40, partsNeeded: [{ category: 'Ignition', qty: 4 }],                                                                    priorityWeights: { low: 30, medium: 60, high: 10 } },
  { type: 'engine-diagnostics',  title: 'Timing Belt Replacement',    laborHours: [4, 6],     laborRate: 50, partsNeeded: [{ category: 'Belts', namePrefix: 'Timing Belt' }],                                                    priorityWeights: { low: 0, medium: 30, high: 70 } },
  { type: 'transmission',        title: 'Transmission Fluid Service', laborHours: [1.5, 2.5], laborRate: 45, partsNeeded: [{ category: 'Fluids', namePrefix: 'Transmission Fluid' }],                                            priorityWeights: { low: 20, medium: 60, high: 20 } },
  { type: 'transmission',        title: 'Clutch Replacement',         laborHours: [5, 7],     laborRate: 50, partsNeeded: [{ category: 'Transmission', namePrefix: 'Clutch' }],                                                  priorityWeights: { low: 0, medium: 20, high: 80 } },
  { type: 'bodywork',            title: 'Dent & Paint Repair',        laborHours: [4, 8],     laborRate: 40, partsNeeded: [{ category: 'Bodywork', namePrefix: 'Paint' }],                                                       priorityWeights: { low: 50, medium: 40, high: 10 } },
  { type: 'bodywork',            title: 'Bumper Repair',              laborHours: [3, 5],     laborRate: 40, partsNeeded: [{ category: 'Bodywork', namePrefix: 'Paint' }],                                                       priorityWeights: { low: 30, medium: 50, high: 20 } },
  { type: 'bodywork',            title: 'Windshield Wipers',          laborHours: [0.25, 0.5], laborRate: 25, partsNeeded: [{ category: 'Accessories', namePrefix: 'Wiper' }],                                                   priorityWeights: { low: 80, medium: 18, high: 2 } },
  { type: 'inspection',          title: 'Annual Inspection',          laborHours: [0.75, 1.25], laborRate: 35, partsNeeded: [],                                                                                                  priorityWeights: { low: 60, medium: 35, high: 5 } },
];

// Parts catalog: must include every category referenced above.
type PartSpec = {
  name: string;
  partNumber: string;
  category: string;
  unitPrice: number;
  costPrice: number;
  initialQty: number;
  minQuantity: number;
};

function buildPartsCatalog(): PartSpec[] {
  const list: PartSpec[] = [];
  // Filters
  list.push({ name: 'Oil Filter - Universal',         partNumber: 'OF-UNI-001',  category: 'Filters', unitPrice: 18,  costPrice: 9,   initialQty: 80, minQuantity: 20 });
  list.push({ name: 'Oil Filter - Renault',           partNumber: 'OF-REN-002',  category: 'Filters', unitPrice: 22,  costPrice: 11,  initialQty: 50, minQuantity: 15 });
  list.push({ name: 'Oil Filter - Peugeot/Citroen',   partNumber: 'OF-PSA-003',  category: 'Filters', unitPrice: 21,  costPrice: 10,  initialQty: 50, minQuantity: 15 });
  list.push({ name: 'Oil Filter - VW Group',          partNumber: 'OF-VAG-004',  category: 'Filters', unitPrice: 24,  costPrice: 12,  initialQty: 45, minQuantity: 15 });
  list.push({ name: 'Oil Filter - Asian (HMC/Kia)',   partNumber: 'OF-HMC-005',  category: 'Filters', unitPrice: 20,  costPrice: 10,  initialQty: 40, minQuantity: 12 });
  list.push({ name: 'Air Filter - Universal',         partNumber: 'AF-UNI-001',  category: 'Filters', unitPrice: 28,  costPrice: 14,  initialQty: 40, minQuantity: 12 });
  list.push({ name: 'Air Filter - Renault',           partNumber: 'AF-REN-002',  category: 'Filters', unitPrice: 32,  costPrice: 16,  initialQty: 30, minQuantity: 10 });
  list.push({ name: 'Air Filter - Peugeot',           partNumber: 'AF-PEU-003',  category: 'Filters', unitPrice: 30,  costPrice: 15,  initialQty: 30, minQuantity: 10 });
  list.push({ name: 'Cabin Air Filter - Universal',   partNumber: 'CAF-UNI-001', category: 'Filters', unitPrice: 22,  costPrice: 11,  initialQty: 35, minQuantity: 10 });
  list.push({ name: 'Cabin Air Filter - Carbon',      partNumber: 'CAF-C-002',   category: 'Filters', unitPrice: 30,  costPrice: 15,  initialQty: 20, minQuantity: 8  });
  list.push({ name: 'Fuel Filter - Diesel',           partNumber: 'FF-DSL-001',  category: 'Filters', unitPrice: 38,  costPrice: 20,  initialQty: 25, minQuantity: 8  });
  list.push({ name: 'Fuel Filter - Petrol',           partNumber: 'FF-PTR-002',  category: 'Filters', unitPrice: 30,  costPrice: 16,  initialQty: 25, minQuantity: 8  });

  // Brakes
  list.push({ name: 'Brake Pads - Front (Renault)',   partNumber: 'BP-F-REN',    category: 'Brakes',  unitPrice: 55,  costPrice: 30,  initialQty: 30, minQuantity: 10 });
  list.push({ name: 'Brake Pads - Front (Peugeot)',   partNumber: 'BP-F-PEU',    category: 'Brakes',  unitPrice: 58,  costPrice: 32,  initialQty: 30, minQuantity: 10 });
  list.push({ name: 'Brake Pads - Front (VW)',        partNumber: 'BP-F-VW',     category: 'Brakes',  unitPrice: 65,  costPrice: 36,  initialQty: 25, minQuantity: 8  });
  list.push({ name: 'Brake Pads - Front (Hyundai/Kia)', partNumber: 'BP-F-HMC',  category: 'Brakes',  unitPrice: 52,  costPrice: 28,  initialQty: 25, minQuantity: 8  });
  list.push({ name: 'Brake Pads - Front (Universal)', partNumber: 'BP-F-UNI',    category: 'Brakes',  unitPrice: 48,  costPrice: 26,  initialQty: 30, minQuantity: 10 });
  list.push({ name: 'Brake Pads - Rear (Renault)',    partNumber: 'BP-R-REN',    category: 'Brakes',  unitPrice: 48,  costPrice: 26,  initialQty: 25, minQuantity: 8  });
  list.push({ name: 'Brake Pads - Rear (Peugeot)',    partNumber: 'BP-R-PEU',    category: 'Brakes',  unitPrice: 50,  costPrice: 27,  initialQty: 25, minQuantity: 8  });
  list.push({ name: 'Brake Pads - Rear (VW)',         partNumber: 'BP-R-VW',     category: 'Brakes',  unitPrice: 56,  costPrice: 30,  initialQty: 20, minQuantity: 6  });
  list.push({ name: 'Brake Pads - Rear (Universal)',  partNumber: 'BP-R-UNI',    category: 'Brakes',  unitPrice: 42,  costPrice: 22,  initialQty: 25, minQuantity: 8  });
  list.push({ name: 'Brake Disc - Front (small)',     partNumber: 'BD-F-S',      category: 'Brakes',  unitPrice: 95,  costPrice: 55,  initialQty: 18, minQuantity: 6  });
  list.push({ name: 'Brake Disc - Front (medium)',    partNumber: 'BD-F-M',      category: 'Brakes',  unitPrice: 110, costPrice: 65,  initialQty: 16, minQuantity: 6  });
  list.push({ name: 'Brake Disc - Front (large)',     partNumber: 'BD-F-L',      category: 'Brakes',  unitPrice: 135, costPrice: 80,  initialQty: 12, minQuantity: 4  });
  list.push({ name: 'Brake Disc - Rear (medium)',     partNumber: 'BD-R-M',      category: 'Brakes',  unitPrice: 105, costPrice: 60,  initialQty: 12, minQuantity: 4  });

  // Fluids
  list.push({ name: 'Engine Oil 5W-30 (5L)',          partNumber: 'EO-5W30-5L',  category: 'Fluids',  unitPrice: 65,  costPrice: 38,  initialQty: 50, minQuantity: 18 });
  list.push({ name: 'Engine Oil 5W-40 (5L)',          partNumber: 'EO-5W40-5L',  category: 'Fluids',  unitPrice: 60,  costPrice: 35,  initialQty: 50, minQuantity: 18 });
  list.push({ name: 'Engine Oil 10W-40 (5L)',         partNumber: 'EO-10W40-5L', category: 'Fluids',  unitPrice: 52,  costPrice: 30,  initialQty: 35, minQuantity: 12 });
  list.push({ name: 'Engine Oil 0W-20 Hybrid (5L)',   partNumber: 'EO-0W20-5L',  category: 'Fluids',  unitPrice: 80,  costPrice: 48,  initialQty: 18, minQuantity: 6  });
  list.push({ name: 'Transmission Fluid ATF (1L)',    partNumber: 'TF-ATF-1L',   category: 'Fluids',  unitPrice: 25,  costPrice: 13,  initialQty: 35, minQuantity: 10 });
  list.push({ name: 'Transmission Fluid CVT (1L)',    partNumber: 'TF-CVT-1L',   category: 'Fluids',  unitPrice: 32,  costPrice: 17,  initialQty: 20, minQuantity: 6  });
  list.push({ name: 'Coolant Pre-mixed (5L)',         partNumber: 'CL-PM-5L',    category: 'Fluids',  unitPrice: 22,  costPrice: 11,  initialQty: 35, minQuantity: 10 });
  list.push({ name: 'Brake Fluid DOT 4 (1L)',         partNumber: 'BF-DOT4-1L',  category: 'Fluids',  unitPrice: 18,  costPrice: 9,   initialQty: 30, minQuantity: 10 });
  list.push({ name: 'AC Refrigerant R134a (kg)',      partNumber: 'AC-R134-KG',  category: 'Fluids',  unitPrice: 45,  costPrice: 25,  initialQty: 18, minQuantity: 5  });
  list.push({ name: 'Power Steering Fluid (1L)',      partNumber: 'PS-1L',       category: 'Fluids',  unitPrice: 20,  costPrice: 10,  initialQty: 25, minQuantity: 8  });

  // Ignition
  list.push({ name: 'Spark Plug NGK Iridium',         partNumber: 'SP-NGK-IR',   category: 'Ignition', unitPrice: 18, costPrice: 9,   initialQty: 120, minQuantity: 40 });
  list.push({ name: 'Spark Plug Bosch Platinum',      partNumber: 'SP-BOSCH-PT', category: 'Ignition', unitPrice: 16, costPrice: 8,   initialQty: 100, minQuantity: 32 });
  list.push({ name: 'Spark Plug Standard',            partNumber: 'SP-STD',      category: 'Ignition', unitPrice: 9,  costPrice: 4,   initialQty: 80,  minQuantity: 25 });
  list.push({ name: 'Ignition Coil Pack',             partNumber: 'IC-PACK',     category: 'Ignition', unitPrice: 95, costPrice: 55,  initialQty: 14, minQuantity: 4  });

  // Electrical
  list.push({ name: 'Battery 12V 60Ah',               partNumber: 'BAT-60AH',    category: 'Electrical', unitPrice: 145, costPrice: 90,  initialQty: 18, minQuantity: 6 });
  list.push({ name: 'Battery 12V 70Ah',               partNumber: 'BAT-70AH',    category: 'Electrical', unitPrice: 175, costPrice: 110, initialQty: 14, minQuantity: 5 });
  list.push({ name: 'Battery 12V 80Ah',               partNumber: 'BAT-80AH',    category: 'Electrical', unitPrice: 210, costPrice: 130, initialQty: 10, minQuantity: 4 });
  list.push({ name: 'Battery 12V 100Ah AGM',          partNumber: 'BAT-100AGM',  category: 'Electrical', unitPrice: 320, costPrice: 200, initialQty: 6,  minQuantity: 2 });
  list.push({ name: 'Alternator (small)',             partNumber: 'ALT-S',       category: 'Electrical', unitPrice: 380, costPrice: 230, initialQty: 6,  minQuantity: 2 });
  list.push({ name: 'Alternator (medium)',            partNumber: 'ALT-M',       category: 'Electrical', unitPrice: 440, costPrice: 270, initialQty: 5,  minQuantity: 2 });
  list.push({ name: 'Starter Motor',                  partNumber: 'STR-MTR',     category: 'Electrical', unitPrice: 320, costPrice: 195, initialQty: 5,  minQuantity: 2 });
  list.push({ name: 'Headlight Bulb H4',              partNumber: 'HL-H4',       category: 'Electrical', unitPrice: 14,  costPrice: 6,   initialQty: 50, minQuantity: 15 });
  list.push({ name: 'Headlight Bulb H7',              partNumber: 'HL-H7',       category: 'Electrical', unitPrice: 16,  costPrice: 7,   initialQty: 45, minQuantity: 15 });

  // Belts
  list.push({ name: 'Alternator Belt Standard',       partNumber: 'AB-STD',      category: 'Belts',    unitPrice: 38,  costPrice: 18,  initialQty: 25, minQuantity: 8 });
  list.push({ name: 'Timing Belt Kit - Renault',      partNumber: 'TB-REN',      category: 'Belts',    unitPrice: 220, costPrice: 130, initialQty: 8,  minQuantity: 3 });
  list.push({ name: 'Timing Belt Kit - Peugeot',      partNumber: 'TB-PEU',      category: 'Belts',    unitPrice: 230, costPrice: 135, initialQty: 8,  minQuantity: 3 });
  list.push({ name: 'Timing Belt Kit - VW',           partNumber: 'TB-VW',       category: 'Belts',    unitPrice: 260, costPrice: 155, initialQty: 6,  minQuantity: 2 });
  list.push({ name: 'Timing Belt Kit - Hyundai/Kia',  partNumber: 'TB-HMC',      category: 'Belts',    unitPrice: 200, costPrice: 120, initialQty: 6,  minQuantity: 2 });
  list.push({ name: 'Serpentine Belt',                partNumber: 'SB-MULTI',    category: 'Belts',    unitPrice: 42,  costPrice: 20,  initialQty: 18, minQuantity: 6 });

  // Tires
  list.push({ name: 'Tire 175/65 R14',                partNumber: 'T-17565R14',  category: 'Tires',    unitPrice: 75,  costPrice: 50,  initialQty: 24, minQuantity: 8 });
  list.push({ name: 'Tire 185/65 R15',                partNumber: 'T-18565R15',  category: 'Tires',    unitPrice: 85,  costPrice: 58,  initialQty: 28, minQuantity: 8 });
  list.push({ name: 'Tire 195/65 R15',                partNumber: 'T-19565R15',  category: 'Tires',    unitPrice: 95,  costPrice: 65,  initialQty: 28, minQuantity: 8 });
  list.push({ name: 'Tire 205/55 R16',                partNumber: 'T-20555R16',  category: 'Tires',    unitPrice: 110, costPrice: 75,  initialQty: 32, minQuantity: 10 });
  list.push({ name: 'Tire 215/55 R17',                partNumber: 'T-21555R17',  category: 'Tires',    unitPrice: 135, costPrice: 90,  initialQty: 24, minQuantity: 8 });
  list.push({ name: 'Tire 225/45 R18',                partNumber: 'T-22545R18',  category: 'Tires',    unitPrice: 175, costPrice: 120, initialQty: 16, minQuantity: 5 });
  list.push({ name: 'Tire 235/55 R18 SUV',            partNumber: 'T-23555R18',  category: 'Tires',    unitPrice: 195, costPrice: 135, initialQty: 16, minQuantity: 5 });

  // Transmission
  list.push({ name: 'Clutch Kit - Small Engine',      partNumber: 'CLT-S',       category: 'Transmission', unitPrice: 280, costPrice: 170, initialQty: 5, minQuantity: 2 });
  list.push({ name: 'Clutch Kit - Medium Engine',     partNumber: 'CLT-M',       category: 'Transmission', unitPrice: 340, costPrice: 210, initialQty: 5, minQuantity: 2 });
  list.push({ name: 'Clutch Kit - SUV/Diesel',        partNumber: 'CLT-L',       category: 'Transmission', unitPrice: 420, costPrice: 260, initialQty: 4, minQuantity: 2 });

  // Bodywork
  list.push({ name: 'Paint - White Standard (1L)',    partNumber: 'PNT-WHT',     category: 'Bodywork', unitPrice: 65, costPrice: 38, initialQty: 18, minQuantity: 6 });
  list.push({ name: 'Paint - Black Standard (1L)',    partNumber: 'PNT-BLK',     category: 'Bodywork', unitPrice: 65, costPrice: 38, initialQty: 18, minQuantity: 6 });
  list.push({ name: 'Paint - Silver Metallic (1L)',   partNumber: 'PNT-SIL',     category: 'Bodywork', unitPrice: 95, costPrice: 58, initialQty: 14, minQuantity: 5 });
  list.push({ name: 'Paint - Red Metallic (1L)',      partNumber: 'PNT-RED',     category: 'Bodywork', unitPrice: 95, costPrice: 58, initialQty: 12, minQuantity: 4 });
  list.push({ name: 'Paint - Gray Metallic (1L)',     partNumber: 'PNT-GRY',     category: 'Bodywork', unitPrice: 95, costPrice: 58, initialQty: 14, minQuantity: 5 });
  list.push({ name: 'Body Filler (kg)',               partNumber: 'BF-1KG',      category: 'Bodywork', unitPrice: 28, costPrice: 14, initialQty: 22, minQuantity: 8 });
  list.push({ name: 'Sandpaper Assortment',           partNumber: 'SP-ASRT',     category: 'Bodywork', unitPrice: 18, costPrice: 8,  initialQty: 30, minQuantity: 10 });

  // Accessories
  list.push({ name: 'Wiper Blade Front - 22"',        partNumber: 'WB-F22',      category: 'Accessories', unitPrice: 24, costPrice: 11, initialQty: 35, minQuantity: 12 });
  list.push({ name: 'Wiper Blade Front - 24"',        partNumber: 'WB-F24',      category: 'Accessories', unitPrice: 26, costPrice: 12, initialQty: 30, minQuantity: 10 });
  list.push({ name: 'Wiper Blade Rear - 14"',         partNumber: 'WB-R14',      category: 'Accessories', unitPrice: 18, costPrice: 8,  initialQty: 25, minQuantity: 8  });
  list.push({ name: 'Floor Mats Set',                 partNumber: 'FM-SET',      category: 'Accessories', unitPrice: 38, costPrice: 18, initialQty: 18, minQuantity: 6  });
  list.push({ name: 'Air Freshener',                  partNumber: 'AIR-FRESH',   category: 'Accessories', unitPrice: 6,  costPrice: 2,  initialQty: 60, minQuantity: 20 });

  // Hoses & misc
  list.push({ name: 'Radiator Hose - Upper',          partNumber: 'RH-UPP',      category: 'Cooling',  unitPrice: 35, costPrice: 18, initialQty: 18, minQuantity: 6 });
  list.push({ name: 'Radiator Hose - Lower',          partNumber: 'RH-LOW',      category: 'Cooling',  unitPrice: 38, costPrice: 20, initialQty: 18, minQuantity: 6 });
  list.push({ name: 'Thermostat',                     partNumber: 'THERM-001',   category: 'Cooling',  unitPrice: 42, costPrice: 22, initialQty: 16, minQuantity: 5 });
  list.push({ name: 'Water Pump - Standard',          partNumber: 'WP-STD',      category: 'Cooling',  unitPrice: 95, costPrice: 55, initialQty: 10, minQuantity: 4 });

  // Suspension
  list.push({ name: 'Shock Absorber Front - pair',    partNumber: 'SA-F-PR',     category: 'Suspension', unitPrice: 165, costPrice: 100, initialQty: 12, minQuantity: 4 });
  list.push({ name: 'Shock Absorber Rear - pair',     partNumber: 'SA-R-PR',     category: 'Suspension', unitPrice: 145, costPrice: 90,  initialQty: 12, minQuantity: 4 });
  list.push({ name: 'Strut Mount',                    partNumber: 'STR-MNT',     category: 'Suspension', unitPrice: 45,  costPrice: 22,  initialQty: 24, minQuantity: 8 });
  list.push({ name: 'Control Arm Bushing',            partNumber: 'CA-BUSH',     category: 'Suspension', unitPrice: 28,  costPrice: 14,  initialQty: 30, minQuantity: 10 });
  list.push({ name: 'Sway Bar Link',                  partNumber: 'SWB-LNK',     category: 'Suspension', unitPrice: 32,  costPrice: 16,  initialQty: 28, minQuantity: 10 });

  // Exhaust
  list.push({ name: 'Exhaust Muffler',                partNumber: 'EX-MUF',      category: 'Exhaust', unitPrice: 130, costPrice: 80,  initialQty: 8, minQuantity: 3 });
  list.push({ name: 'Catalytic Converter (small)',    partNumber: 'CAT-S',       category: 'Exhaust', unitPrice: 380, costPrice: 240, initialQty: 4, minQuantity: 1 });
  list.push({ name: 'Exhaust Gasket Set',             partNumber: 'EX-GSK',      category: 'Exhaust', unitPrice: 22,  costPrice: 11,  initialQty: 30, minQuantity: 10 });

  return list;
}

// Customer archetypes — drive temporal patterns
type Archetype = 'vip' | 'regular' | 'occasional' | 'atRisk' | 'churned' | 'new';
const ARCHETYPE_PLAN: { kind: Archetype; count: number }[] = [
  { kind: 'vip',        count: 6  },
  { kind: 'regular',    count: 20 },
  { kind: 'occasional', count: 12 },
  { kind: 'atRisk',     count: 6  },
  { kind: 'churned',    count: 4  },
  { kind: 'new',        count: 4  },
]; // total 52 customers

// ───────────────────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding OpAuto with rich, coherent demo data…');
  const t0 = Date.now();

  await wipeAll();

  const ctx = await seedAccounts();
  await seedModules(ctx);

  const { suppliers, parts } = await seedInventory(ctx);
  const customers = await seedCustomers(ctx);
  const cars = await seedCars(ctx, customers);

  const jobs = await seedMaintenanceJobs(ctx, customers, cars, parts);
  const invoices = await seedInvoicesFromJobs(ctx, jobs, parts);
  await seedStockMovements(ctx, jobs, parts);

  await seedAppointments(ctx, customers, cars, jobs);
  await seedAiActions(ctx, customers);
  await seedNotifications(ctx);

  await computeRollups();
  await verifyIntegrity();

  console.log(`✅ Seed complete in ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log('Login: owner@autotech.tn / password123');
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Wipe (preserves nothing — recreates accounts identically)
// ───────────────────────────────────────────────────────────────────────────
async function wipeAll() {
  await prisma.assistantToolCall.deleteMany();
  await prisma.assistantMessage.deleteMany();
  await prisma.assistantConversation.deleteMany();
  await prisma.aiAction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.garageModule.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.part.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.maintenanceApproval.deleteMany();
  await prisma.maintenancePhoto.deleteMany();
  await prisma.maintenanceTask.deleteMany();
  await prisma.maintenanceJob.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.car.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.user.deleteMany();
  await prisma.garage.deleteMany();
  console.log('  ✓ wiped all transactional + assistant data');
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Accounts — garage + users + employees
// ───────────────────────────────────────────────────────────────────────────
type Ctx = {
  garage: Awaited<ReturnType<typeof prisma.garage.create>>;
  owner: Awaited<ReturnType<typeof prisma.user.create>>;
  staff: Awaited<ReturnType<typeof prisma.user.create>>[];
  employees: Awaited<ReturnType<typeof prisma.employee.create>>[];
};

async function seedAccounts(): Promise<Ctx> {
  const hashedOwner = await bcrypt.hash('password123', 10);
  const hashedStaff = await bcrypt.hash('staff123', 10);

  const garage = await prisma.garage.create({
    data: {
      name: 'AutoTech Tunisia',
      address: '15 Avenue Habib Bourguiba, Tunis 1000',
      phone: '+216 71 234 567',
      email: 'contact@autotech.tn',
      specializations: ['MECHANICAL', 'BODYWORK', 'ELECTRICAL', 'TIRE_ALIGNMENT'],
      businessHours: {
        monday:    { isWorkingDay: true,  openTime: '08:00', closeTime: '18:00' },
        tuesday:   { isWorkingDay: true,  openTime: '08:00', closeTime: '18:00' },
        wednesday: { isWorkingDay: true,  openTime: '08:00', closeTime: '18:00' },
        thursday:  { isWorkingDay: true,  openTime: '08:00', closeTime: '18:00' },
        friday:    { isWorkingDay: true,  openTime: '08:00', closeTime: '18:00' },
        saturday:  { isWorkingDay: true,  openTime: '08:00', closeTime: '13:00' },
        sunday:    { isWorkingDay: false, openTime: '',      closeTime: ''      },
        timezone: 'Africa/Tunis',
      },
      currency: 'TND',
      taxRate: 19,
    },
  });

  const owner = await prisma.user.create({
    data: {
      garageId: garage.id, email: 'owner@autotech.tn', password: hashedOwner,
      firstName: 'Ala', lastName: 'Ben Khlifa', role: UserRole.OWNER, phone: '+216 98 123 456',
    },
  });

  const staffSpecs = [
    { username: 'mohamed', firstName: 'Mohamed', lastName: 'Trabelsi', phone: '+216 97 111 222', role: EmployeeRole.MECHANIC,           dept: EmployeeDepartment.MECHANICAL,   skills: ['engine_repair','oil_change','diagnostics'] },
    { username: 'khalil',  firstName: 'Khalil',  lastName: 'Bouazizi', phone: '+216 97 333 444', role: EmployeeRole.MECHANIC,           dept: EmployeeDepartment.MECHANICAL,   skills: ['brakes','suspension','transmission'] },
    { username: 'youssef', firstName: 'Youssef', lastName: 'Gharbi',   phone: '+216 97 555 666', role: EmployeeRole.ELECTRICIAN,        dept: EmployeeDepartment.ELECTRICAL,   skills: ['ecu_diag','ac_systems','battery'] },
    { username: 'hichem',  firstName: 'Hichem',  lastName: 'Sassi',    phone: '+216 97 777 888', role: EmployeeRole.BODYWORK_SPECIALIST, dept: EmployeeDepartment.BODYWORK,    skills: ['paint','dent_repair','panel_alignment'] },
    { username: 'ali',     firstName: 'Ali',     lastName: 'Khelifi',  phone: '+216 97 999 000', role: EmployeeRole.TIRE_SPECIALIST,    dept: EmployeeDepartment.TIRE_ALIGNMENT, skills: ['alignment','balancing','tpms'] },
  ];
  const staff: Ctx['staff'] = [];
  const employees: Ctx['employees'] = [];
  for (const s of staffSpecs) {
    const u = await prisma.user.create({
      data: { garageId: garage.id, username: s.username, password: hashedStaff, firstName: s.firstName, lastName: s.lastName, role: UserRole.STAFF, phone: s.phone },
    });
    staff.push(u);
    const e = await prisma.employee.create({
      data: {
        garageId: garage.id, userId: u.id, firstName: s.firstName, lastName: s.lastName,
        email: `${s.username}@autotech.tn`, phone: s.phone,
        role: s.role, department: s.dept, status: EmployeeStatus.ACTIVE,
        hireDate: new Date('2022-01-15'), hourlyRate: s.role === EmployeeRole.BODYWORK_SPECIALIST ? 32 : 28,
        skills: s.skills, isAvailable: true,
      },
    });
    employees.push(e);
  }

  console.log(`  ✓ accounts: 1 garage, ${1 + staff.length} users, ${employees.length} employees`);
  return { garage, owner, staff, employees };
}

async function seedModules(ctx: Ctx) {
  const modules = ['dashboard','customers','cars','appointments','calendar','maintenance','invoicing','inventory','employees','reports','approvals','users','settings','ai','notifications'];
  await prisma.garageModule.createMany({
    data: modules.map(m => ({ garageId: ctx.garage.id, moduleId: m })),
  });
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Inventory — suppliers + parts catalog (no movements yet)
// ───────────────────────────────────────────────────────────────────────────
async function seedInventory(ctx: Ctx) {
  const supplierData = [
    { name: 'TunisAuto Parts',     email: 'orders@tunisauto.tn',     phone: '+216 71 888 999', address: 'Zone Industrielle, Tunis' },
    { name: 'MaghrEb Pièces',      email: 'contact@maghrebpieces.tn', phone: '+216 71 777 666', address: 'Sousse'                  },
    { name: 'Atlas Auto Imports',  email: 'sales@atlasauto.tn',      phone: '+216 71 555 777', address: 'Ariana'                  },
    { name: 'Med Lubrifiants',     email: 'commande@medlub.tn',      phone: '+216 73 222 111', address: 'Sfax'                    },
    { name: 'Tire World Tunisia',  email: 'pro@tireworld.tn',        phone: '+216 71 666 555', address: 'Ben Arous'               },
    { name: 'PaintPro Maghreb',    email: 'b2b@paintpro.tn',         phone: '+216 73 444 888', address: 'Sousse'                  },
  ];
  const suppliers = await Promise.all(
    supplierData.map(s => prisma.supplier.create({ data: { garageId: ctx.garage.id, ...s } })),
  );

  const catalog = buildPartsCatalog();
  const parts = await Promise.all(
    catalog.map((spec, i) => prisma.part.create({
      data: {
        garageId: ctx.garage.id,
        supplierId: suppliers[i % suppliers.length].id,
        name: spec.name,
        partNumber: spec.partNumber,
        category: spec.category,
        quantity: spec.initialQty,
        minQuantity: spec.minQuantity,
        unitPrice: spec.unitPrice,
        costPrice: spec.costPrice,
        location: `Shelf ${String.fromCharCode(65 + (i % 8))}-${Math.floor(i / 8) + 1}`,
      },
    })),
  );

  console.log(`  ✓ inventory: ${suppliers.length} suppliers, ${parts.length} parts`);
  return { suppliers, parts };
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Customers — built from archetype plan
// ───────────────────────────────────────────────────────────────────────────
type CustomerWithPlan = Awaited<ReturnType<typeof prisma.customer.create>> & { archetype: Archetype };

async function seedCustomers(ctx: Ctx): Promise<CustomerWithPlan[]> {
  const usedNames = new Set<string>();
  const usedPhones = new Set<string>();

  const out: CustomerWithPlan[] = [];

  for (const plan of ARCHETYPE_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      let firstName: string, lastName: string, key: string;
      let attempts = 0;
      do {
        firstName = chance(0.55) ? pick(TUNISIAN_FIRSTS_M) : pick(TUNISIAN_FIRSTS_F);
        lastName = pick(TUNISIAN_LASTS);
        key = `${firstName} ${lastName}`;
        attempts++;
      } while (usedNames.has(key) && attempts < 50);
      usedNames.add(key);

      let phone: string;
      do {
        const prefix = pick(['20','21','22','23','24','25','26','27','28','29','50','55','58','90','95','97','98','99']);
        phone = `+216 ${prefix} ${randInt(100,999)} ${randInt(100,999)}`;
      } while (usedPhones.has(phone));
      usedPhones.add(phone);

      const address = pick(TUNISIAN_CITIES);
      const email = chance(0.65)
        ? `${firstName.toLowerCase().replace(/\s+/g,'.')}.${lastName.toLowerCase().replace(/\s+/g,'.')}@email.tn`
        : null;

      // Status: VIPs get VIP, churned go INACTIVE, rest ACTIVE
      const status =
        plan.kind === 'vip'     ? CustomerStatus.VIP :
        plan.kind === 'churned' ? CustomerStatus.INACTIVE :
                                   CustomerStatus.ACTIVE;

      // createdAt: archetype-aware
      let createdAt: Date;
      if (plan.kind === 'new') {
        createdAt = addDays(TODAY, -randInt(3, 25));
      } else if (plan.kind === 'churned') {
        createdAt = addDays(TODAY, -randInt(500, 900));
      } else if (plan.kind === 'vip') {
        createdAt = addDays(TODAY, -randInt(700, 1400));
      } else if (plan.kind === 'atRisk') {
        createdAt = addDays(TODAY, -randInt(300, 700));
      } else {
        createdAt = addDays(TODAY, -randInt(150, 600));
      }

      const c = await prisma.customer.create({
        data: {
          garageId: ctx.garage.id,
          firstName, lastName, email, phone, address,
          status,
          loyaltyTier: null, // computed later
          totalSpent: 0,     // computed later
          visitCount: 0,     // computed later
          smsOptIn: chance(0.85),
          notes: plan.kind === 'churned' ? 'Hasn’t visited in 6+ months' :
                 plan.kind === 'atRisk'  ? 'Visit cadence has slowed — follow up.' :
                 plan.kind === 'vip'     ? 'VIP customer — priority handling.' :
                 plan.kind === 'new'     ? 'New customer (April 2026).' : null,
          createdAt,
        },
      });
      out.push(Object.assign(c, { archetype: plan.kind }));
    }
  }

  console.log(`  ✓ customers: ${out.length} (${ARCHETYPE_PLAN.map(p => `${p.count} ${p.kind}`).join(', ')})`);
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Cars — 1–2 per customer (mostly 1)
// ───────────────────────────────────────────────────────────────────────────
type CarWithCust = Awaited<ReturnType<typeof prisma.car.create>>;
async function seedCars(ctx: Ctx, customers: CustomerWithPlan[]): Promise<CarWithCust[]> {
  const cars: CarWithCust[] = [];
  const usedPlates = new Set<string>();
  const usedVins = new Set<string>();

  for (const cust of customers) {
    const carCount =
      cust.archetype === 'vip'     ? (chance(0.5) ? 2 : 1) :
      cust.archetype === 'regular' ? (chance(0.25) ? 2 : 1) :
      cust.archetype === 'churned' ? 1 :
      cust.archetype === 'new'     ? 1 :
                                     (chance(0.15) ? 2 : 1);

    for (let i = 0; i < carCount; i++) {
      const make = pick(CAR_FLEET);
      const model = pick(make.models);
      const year = randInt(2014, 2025);
      const mileage = (2026 - year) * randInt(8000, 18000) + randInt(0, 5000);

      let plate: string;
      do {
        plate = `${randInt(1,9999).toString().padStart(3,'0')} TUN ${randInt(100,999)}`;
      } while (usedPlates.has(plate));
      usedPlates.add(plate);

      let vin: string | null = null;
      if (chance(0.7)) {
        do {
          vin = Array.from({length:17}, () => '0123456789ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(rand()*32)]).join('');
        } while (usedVins.has(vin));
        usedVins.add(vin);
      }

      const car = await prisma.car.create({
        data: {
          garageId: ctx.garage.id,
          customerId: cust.id,
          make: make.make,
          model,
          year,
          vin,
          licensePlate: plate,
          color: pick(COLORS),
          mileage,
          engineType: pick(ENGINES),
          transmission: pick(TRANSMISSIONS),
          // lastServiceDate / nextServiceDate computed in rollups
        },
      });
      cars.push(car);
    }
  }

  console.log(`  ✓ cars: ${cars.length}`);
  return cars;
}

// ───────────────────────────────────────────────────────────────────────────
// 6. Maintenance Jobs — paced visits per archetype
// ───────────────────────────────────────────────────────────────────────────
type GeneratedJob = {
  id: string;
  garageId: string;
  customerId: string;
  carId: string;
  employeeId: string | null;
  template: ServiceTemplate;
  startDate: Date;
  completionDate: Date | null;
  status: MaintenanceStatus;
  laborHours: number;
  laborTotal: number;
  partsConsumed: { partId: string; partName: string; qty: number; unitPrice: number; lineTotal: number; partNumber: string }[];
  invoiceCandidate: boolean; // true if status COMPLETED past today
};

async function seedMaintenanceJobs(
  ctx: Ctx,
  customers: CustomerWithPlan[],
  cars: CarWithCust[],
  parts: Awaited<ReturnType<typeof prisma.part.create>>[],
): Promise<GeneratedJob[]> {
  const partsByCategory = new Map<string, typeof parts>();
  for (const p of parts) {
    if (!partsByCategory.has(p.category!)) partsByCategory.set(p.category!, []);
    partsByCategory.get(p.category!)!.push(p);
  }

  // Mirror Part.quantity locally so we can simulate stock without going negative
  const stockOnHand = new Map<string, number>();
  for (const p of parts) stockOnHand.set(p.id, p.quantity);

  // Build per-customer visit schedule
  const carsByCust = new Map<string, typeof cars>();
  for (const c of cars) {
    if (!carsByCust.has(c.customerId)) carsByCust.set(c.customerId, []);
    carsByCust.get(c.customerId)!.push(c);
  }

  // Distribute visits per customer
  type Visit = { cust: CustomerWithPlan; car: typeof cars[number]; date: Date };
  const visits: Visit[] = [];

  for (const cust of customers) {
    const carsOfCust = carsByCust.get(cust.id) ?? [];
    if (carsOfCust.length === 0) continue;

    if (cust.archetype === 'vip') {
      // 12–16 visits Jan→Apr 27 (≈3–4 per month)
      const n = randInt(12, 16);
      visits.push(...spreadVisits(cust, carsOfCust, YEAR_START, addDays(TODAY, -1), n));
    } else if (cust.archetype === 'regular') {
      // 4–6 visits Jan→Apr 27
      const n = randInt(4, 6);
      visits.push(...spreadVisits(cust, carsOfCust, YEAR_START, addDays(TODAY, -1), n));
    } else if (cust.archetype === 'occasional') {
      const n = randInt(2, 3);
      visits.push(...spreadVisits(cust, carsOfCust, YEAR_START, addDays(TODAY, -1), n));
    } else if (cust.archetype === 'atRisk') {
      // Last visit 90–110 days ago, 1–2 earlier visits
      const lastVisit = addDays(TODAY, -randInt(90, 110));
      const earlier = randInt(1, 2);
      const earlierStart = addDays(lastVisit, -randInt(60, 120));
      visits.push(...spreadVisits(cust, carsOfCust, earlierStart, addDays(lastVisit, -1), earlier));
      visits.push({ cust, car: pick(carsOfCust), date: lastVisit });
    } else if (cust.archetype === 'churned') {
      // Were active customers in 2024–2025 then went silent. Generate 3–5
      // historical visits, with the most recent 200–280 days ago, so the churn
      // model has enough history (visitCount ≥ 2) to flag them as high-risk.
      const lastVisit = addDays(TODAY, -randInt(200, 280));
      const earlier = randInt(2, 4);
      const earlierStart = addDays(lastVisit, -randInt(180, 365));
      visits.push(...spreadVisits(cust, carsOfCust, earlierStart, addDays(lastVisit, -1), earlier));
      visits.push({ cust, car: pick(carsOfCust), date: lastVisit });
    } else if (cust.archetype === 'new') {
      // Created ≤25 days ago, has 1 visit in last 14 days
      const visitDate = addDays(TODAY, -randInt(2, 14));
      visits.push({ cust, car: pick(carsOfCust), date: visitDate });
    }
  }

  // Sort visits chronologically
  visits.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Materialize each visit as a MaintenanceJob (status COMPLETED for past dates)
  const jobs: GeneratedJob[] = [];

  for (const v of visits) {
    const tpl = pickService(v.cust.archetype);
    const employee = pickEmployeeFor(ctx.employees, tpl);

    const startDate = setHM(v.date, randInt(8, 15), pick([0, 30]));
    const laborHours = round(randFloat(tpl.laborHours[0], tpl.laborHours[1]), 1);
    const completion = setHM(addDays(startDate, 0), startDate.getUTCHours() + Math.ceil(laborHours), 0);
    const laborTotal = round(laborHours * tpl.laborRate, 2);

    // Pick parts respecting category/name matching + stock availability
    const consumed: GeneratedJob['partsConsumed'] = [];
    for (const need of tpl.partsNeeded) {
      const candidates = (partsByCategory.get(need.category) ?? []).filter(p =>
        !need.namePrefix || p.name.toLowerCase().startsWith(need.namePrefix.toLowerCase()),
      );
      if (candidates.length === 0) continue;
      // Try top 3 by stock until one has enough
      const sorted = candidates.slice().sort((a, b) => (stockOnHand.get(b.id) ?? 0) - (stockOnHand.get(a.id) ?? 0));
      for (const cand of sorted.slice(0, 3)) {
        const qty = need.qty ?? 1;
        if ((stockOnHand.get(cand.id) ?? 0) >= qty) {
          stockOnHand.set(cand.id, (stockOnHand.get(cand.id) ?? 0) - qty);
          consumed.push({
            partId: cand.id,
            partName: cand.name,
            partNumber: cand.partNumber ?? '',
            qty,
            unitPrice: cand.unitPrice,
            lineTotal: round(qty * cand.unitPrice, 2),
          });
          break;
        }
      }
    }

    const job = await prisma.maintenanceJob.create({
      data: {
        garageId: ctx.garage.id,
        carId: v.car.id,
        employeeId: employee?.id ?? null,
        title: tpl.title,
        description: `${tpl.title} for ${v.car.make} ${v.car.model} (${v.car.licensePlate})`,
        status: MaintenanceStatus.COMPLETED,
        priority: weightedPriority(tpl),
        estimatedHours: tpl.laborHours[1],
        actualHours: laborHours,
        estimatedCost: round(tpl.laborHours[1] * tpl.laborRate + consumed.reduce((s, c) => s + c.lineTotal, 0), 2),
        actualCost: round(laborTotal + consumed.reduce((s, c) => s + c.lineTotal, 0), 2),
        startDate,
        completionDate: completion,
        notes: chance(0.25) ? 'Customer informed; pickup confirmed.' : null,
      },
    });

    // tasks (1–3 simple ones marked done)
    const taskTitles = pickN([
      'Diagnostic check', 'Drain & refill fluids', 'Inspect & torque',
      'Replace consumed parts', 'Test drive', 'Final QC',
    ], randInt(2, 3));
    for (const t of taskTitles) {
      await prisma.maintenanceTask.create({
        data: {
          maintenanceJobId: job.id,
          title: t,
          isCompleted: true,
          estimatedMinutes: randInt(20, 90),
          actualMinutes: randInt(15, 100),
        },
      });
    }

    jobs.push({
      id: job.id,
      garageId: ctx.garage.id,
      customerId: v.cust.id,
      carId: v.car.id,
      employeeId: employee?.id ?? null,
      template: tpl,
      startDate,
      completionDate: completion,
      status: MaintenanceStatus.COMPLETED,
      laborHours,
      laborTotal,
      partsConsumed: consumed,
      invoiceCandidate: true,
    });
  }

  // A few in-progress / waiting jobs for current state realism
  const inProgressCount = 4;
  for (let i = 0; i < inProgressCount; i++) {
    const cust = pick(customers.filter(c => c.archetype === 'regular' || c.archetype === 'vip'));
    const carsOfCust = carsByCust.get(cust.id) ?? [];
    if (carsOfCust.length === 0) continue;
    const car = pick(carsOfCust);
    const tpl = pick(SERVICES);
    const startDate = setHM(addDays(TODAY, -randInt(0, 2)), randInt(8, 11), 0);
    const status = pick([MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.QUALITY_CHECK, MaintenanceStatus.WAITING_PARTS] as const);
    const laborHours = round(randFloat(tpl.laborHours[0], tpl.laborHours[1]), 1);
    const job = await prisma.maintenanceJob.create({
      data: {
        garageId: ctx.garage.id,
        carId: car.id,
        employeeId: pickEmployeeFor(ctx.employees, tpl)?.id ?? null,
        title: tpl.title,
        description: `${tpl.title} for ${car.make} ${car.model}`,
        status,
        priority: weightedPriority(tpl),
        estimatedHours: tpl.laborHours[1],
        estimatedCost: round(tpl.laborHours[1] * tpl.laborRate + 100, 2),
        startDate,
      },
    });
    jobs.push({
      id: job.id,
      garageId: ctx.garage.id,
      customerId: cust.id,
      carId: car.id,
      employeeId: null,
      template: tpl,
      startDate,
      completionDate: null,
      status,
      laborHours,
      laborTotal: round(laborHours * tpl.laborRate, 2),
      partsConsumed: [],
      invoiceCandidate: false,
    });
  }

  console.log(`  ✓ maintenance jobs: ${jobs.length} (${jobs.filter(j => j.status === MaintenanceStatus.COMPLETED).length} completed, ${jobs.length - jobs.filter(j => j.status === MaintenanceStatus.COMPLETED).length} in-progress)`);
  return jobs;
}

function spreadVisits(cust: CustomerWithPlan, cars: CarWithCust[], from: Date, to: Date, n: number) {
  const span = to.getTime() - from.getTime();
  const out: { cust: CustomerWithPlan; car: CarWithCust; date: Date }[] = [];
  for (let i = 0; i < n; i++) {
    const t = from.getTime() + (span * (i + rand() * 0.6) / n);
    let d = new Date(t);
    while (!isWorkingDay(d)) d = addDays(d, 1);
    out.push({ cust, car: pick(cars), date: d });
  }
  return out;
}

function pickService(arch: Archetype): ServiceTemplate {
  // Bias: VIP gets a wider variety incl bodywork; new customers get oil-change-ish first visits
  if (arch === 'new') {
    const fresh = SERVICES.filter(s => s.type === 'oil-change' || s.type === 'inspection');
    return pick(fresh);
  }
  if (arch === 'vip') return pick(SERVICES);
  // Bias regulars/occasional toward maintenance basics
  const weights = SERVICES.map(s =>
    s.type === 'oil-change' ? 4 :
    s.type === 'brake-service' ? 3 :
    s.type === 'tire-replacement' ? 2 :
    s.type === 'electrical' ? 2 :
    s.type === 'inspection' ? 2 :
    s.type === 'engine-diagnostics' ? 1.5 :
    s.type === 'transmission' ? 1 :
    s.type === 'bodywork' ? 1 :
    1,
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < SERVICES.length; i++) {
    r -= weights[i];
    if (r < 0) return SERVICES[i];
  }
  return SERVICES[0];
}

function pickEmployeeFor(employees: Ctx['employees'], tpl: ServiceTemplate) {
  const wantDept =
    tpl.type === 'electrical'         ? EmployeeDepartment.ELECTRICAL :
    tpl.type === 'bodywork'           ? EmployeeDepartment.BODYWORK :
    tpl.type === 'tire-replacement'   ? EmployeeDepartment.TIRE_ALIGNMENT :
                                        EmployeeDepartment.MECHANICAL;
  const matches = employees.filter(e => e.department === wantDept);
  return matches.length ? pick(matches) : pick(employees);
}

function weightedPriority(tpl: ServiceTemplate): string {
  const total = tpl.priorityWeights.low + tpl.priorityWeights.medium + tpl.priorityWeights.high;
  const r = rand() * total;
  if (r < tpl.priorityWeights.low) return 'low';
  if (r < tpl.priorityWeights.low + tpl.priorityWeights.medium) return 'medium';
  return 'high';
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

// ───────────────────────────────────────────────────────────────────────────
// 7. Invoices — generated 1:1 from completed jobs
// ───────────────────────────────────────────────────────────────────────────
async function seedInvoicesFromJobs(
  ctx: Ctx,
  jobs: GeneratedJob[],
  parts: Awaited<ReturnType<typeof prisma.part.create>>[],
) {
  const TAX_RATE = 0.19;
  let invoiceCounter: Record<string, number> = {};
  const monthKey = (d: Date) => `${d.getUTCFullYear()}${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`;

  const completed = jobs.filter(j => j.invoiceCandidate);
  const invoices: Awaited<ReturnType<typeof prisma.invoice.create>>[] = [];

  // Status mix: 70% PAID, 15% SENT, 10% OVERDUE, 5% DRAFT (only for very recent jobs)
  for (const job of completed) {
    const ageDays = (TODAY.getTime() - (job.completionDate ?? job.startDate).getTime()) / 86400000;
    let status: InvoiceStatus;
    const r = rand();
    if (ageDays > 30) {
      // Older: most paid, some overdue
      status = r < 0.85 ? InvoiceStatus.PAID : r < 0.95 ? InvoiceStatus.OVERDUE : InvoiceStatus.SENT;
    } else if (ageDays > 14) {
      status = r < 0.7 ? InvoiceStatus.PAID : r < 0.9 ? InvoiceStatus.SENT : InvoiceStatus.OVERDUE;
    } else if (ageDays > 5) {
      status = r < 0.45 ? InvoiceStatus.PAID : r < 0.85 ? InvoiceStatus.SENT : InvoiceStatus.DRAFT;
    } else {
      status = r < 0.2 ? InvoiceStatus.PAID : r < 0.6 ? InvoiceStatus.SENT : InvoiceStatus.DRAFT;
    }

    const subtotal = round(job.laborTotal + job.partsConsumed.reduce((s, p) => s + p.lineTotal, 0), 2);
    const discount = job.template.type === 'inspection' && chance(0.2) ? round(subtotal * 0.05, 2) : 0;
    const taxedBase = subtotal - discount;
    const taxAmount = round(taxedBase * TAX_RATE, 2);
    const total = round(taxedBase + taxAmount, 2);

    const mk = monthKey(job.completionDate ?? job.startDate);
    invoiceCounter[mk] = (invoiceCounter[mk] ?? 0) + 1;
    const invoiceNumber = `INV-${mk}-${invoiceCounter[mk].toString().padStart(4, '0')}`;

    const createdAt = job.completionDate ?? job.startDate;
    const dueDate = addDays(createdAt, 14);
    const paidAt = status === InvoiceStatus.PAID ? addDays(createdAt, randInt(0, 12)) : null;

    const invoice = await prisma.invoice.create({
      data: {
        garageId: ctx.garage.id,
        customerId: job.customerId,
        carId: job.carId,
        invoiceNumber,
        status,
        subtotal,
        discount,
        taxAmount,
        total,
        dueDate,
        paidAt,
        notes: status === InvoiceStatus.OVERDUE ? 'Reminder sent — payment overdue.' : null,
        createdAt,
      },
    });

    // Line items: one labor + one per part
    await prisma.invoiceLineItem.create({
      data: {
        invoiceId: invoice.id,
        description: `Labor — ${job.template.title} (${job.laborHours}h)`,
        quantity: job.laborHours,
        unitPrice: job.template.laborRate,
        total: job.laborTotal,
        type: 'labor',
      },
    });
    for (const part of job.partsConsumed) {
      await prisma.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          description: `${part.partName}${part.partNumber ? ` (${part.partNumber})` : ''}`,
          quantity: part.qty,
          unitPrice: part.unitPrice,
          total: part.lineTotal,
          type: 'part',
        },
      });
    }

    if (status === InvoiceStatus.PAID && paidAt) {
      const method = pick([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.BANK_TRANSFER, PaymentMethod.MOBILE_PAYMENT] as const);
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: total,
          method,
          paidAt,
          reference: method === PaymentMethod.BANK_TRANSFER ? `TR-${randInt(100000, 999999)}` : null,
        },
      });
    }

    invoices.push(invoice);
  }

  console.log(`  ✓ invoices: ${invoices.length} (${invoices.filter(i => i.status === InvoiceStatus.PAID).length} paid, ${invoices.filter(i => i.status === InvoiceStatus.SENT).length} sent, ${invoices.filter(i => i.status === InvoiceStatus.OVERDUE).length} overdue, ${invoices.filter(i => i.status === InvoiceStatus.DRAFT).length} draft)`);
  return invoices;
}

// ───────────────────────────────────────────────────────────────────────────
// 8. Stock movements — OUT per consumed part + monthly IN restocks
// ───────────────────────────────────────────────────────────────────────────
async function seedStockMovements(
  ctx: Ctx,
  jobs: GeneratedJob[],
  parts: Awaited<ReturnType<typeof prisma.part.create>>[],
) {
  let outCount = 0;
  let inCount = 0;

  // OUT: one per consumed part per job
  for (const job of jobs) {
    for (const p of job.partsConsumed) {
      await prisma.stockMovement.create({
        data: {
          partId: p.partId,
          type: 'out',
          quantity: p.qty,
          reason: `Job ${job.template.title}`,
          reference: `MAINT-${job.id.slice(0, 8)}`,
          createdAt: job.completionDate ?? job.startDate,
        },
      });
      outCount++;
    }
  }

  // IN: monthly restocks Jan 5, Feb 5, Mar 5, Apr 5 — restock parts that fell below 1.5x minQuantity
  const restockDates = [
    new Date('2026-01-05T08:00:00Z'),
    new Date('2026-02-05T08:00:00Z'),
    new Date('2026-03-05T08:00:00Z'),
    new Date('2026-04-05T08:00:00Z'),
  ];
  for (const restockDate of restockDates) {
    // Compute notional stock at this date by walking OUT movements
    const stockSnapshot = new Map<string, number>();
    for (const p of parts) stockSnapshot.set(p.id, p.quantity);
    for (const job of jobs) {
      const when = job.completionDate ?? job.startDate;
      if (when < restockDate) {
        for (const c of job.partsConsumed) {
          stockSnapshot.set(c.partId, (stockSnapshot.get(c.partId) ?? 0) - c.qty);
        }
      }
    }
    for (const p of parts) {
      const cur = stockSnapshot.get(p.id) ?? 0;
      if (cur < p.minQuantity * 1.5) {
        const restockQty = Math.max(p.minQuantity * 2 - cur, 0);
        if (restockQty > 0) {
          await prisma.stockMovement.create({
            data: {
              partId: p.id,
              type: 'in',
              quantity: restockQty,
              reason: 'Monthly restock',
              reference: `PO-${fmt(restockDate)}`,
              createdAt: restockDate,
            },
          });
          inCount++;
        }
      }
    }
  }

  // Now update part.quantity = initial + IN - OUT (final state for AI tools)
  const partRefresh = await prisma.part.findMany();
  for (const p of partRefresh) {
    const movements = await prisma.stockMovement.findMany({ where: { partId: p.id } });
    const delta = movements.reduce((s, m) => s + (m.type === 'in' ? m.quantity : -m.quantity), 0);
    const newQty = Math.max(0, p.quantity + delta);
    await prisma.part.update({ where: { id: p.id }, data: { quantity: newQty } });
  }

  console.log(`  ✓ stock movements: ${outCount} out, ${inCount} in`);
}

// ───────────────────────────────────────────────────────────────────────────
// 9. Appointments — past completed (1 per job) + future scheduled
// ───────────────────────────────────────────────────────────────────────────
async function seedAppointments(
  ctx: Ctx,
  customers: CustomerWithPlan[],
  cars: CarWithCust[],
  jobs: GeneratedJob[],
) {
  // Past appointments: every COMPLETED job has a corresponding appointment
  let past = 0;
  for (const job of jobs.filter(j => j.status === MaintenanceStatus.COMPLETED && j.completionDate)) {
    const car = cars.find(c => c.id === job.carId)!;
    const cust = customers.find(c => c.id === car.customerId)!;
    const start = job.startDate;
    const end = setHM(start, start.getUTCHours() + Math.max(1, Math.ceil(job.laborHours)));
    await prisma.appointment.create({
      data: {
        garageId: ctx.garage.id,
        customerId: cust.id,
        carId: car.id,
        employeeId: job.employeeId,
        title: job.template.title,
        type: job.template.type,
        priority: weightedPriority(job.template),
        status: AppointmentStatus.COMPLETED,
        startTime: start,
        endTime: end,
      },
    });
    past++;
  }

  // Future appointments: ~150 across May→Dec, biased to next 6 weeks
  let future = 0;
  const futureStart = addDays(TODAY, 1);
  const customersForFuture = customers.filter(c => c.archetype !== 'churned');
  for (let i = 0; i < 150; i++) {
    const cust = pick(customersForFuture);
    const carsOfCust = cars.filter(c => c.customerId === cust.id);
    if (carsOfCust.length === 0) continue;
    const car = pick(carsOfCust);
    const tpl = pickService(cust.archetype);
    const employee = pickEmployeeFor(ctx.employees, tpl);

    // Bias: 60% in next 6 weeks, 40% spread May→Dec
    let date: Date;
    if (chance(0.6)) {
      date = addDays(futureStart, randInt(0, 42));
    } else {
      const remainingDays = Math.floor((YEAR_END.getTime() - addDays(futureStart, 42).getTime()) / 86400000);
      date = addDays(addDays(futureStart, 42), randInt(0, remainingDays));
    }
    while (!isWorkingDay(date)) date = addDays(date, 1);

    const startHour = randInt(8, 15);
    const start = setHM(date, startHour, pick([0, 30]));
    const durationH = Math.max(1, Math.ceil(randFloat(tpl.laborHours[0], tpl.laborHours[1])));
    const end = setHM(start, startHour + durationH);

    const status = chance(0.35)
      ? AppointmentStatus.CONFIRMED
      : chance(0.95) // 0.65 * (1 - 0.05) ≈ 0.62 SCHEDULED, ~0.03 CANCELLED
        ? AppointmentStatus.SCHEDULED
        : AppointmentStatus.CANCELLED;

    await prisma.appointment.create({
      data: {
        garageId: ctx.garage.id,
        customerId: cust.id,
        carId: car.id,
        employeeId: employee?.id ?? null,
        title: tpl.title,
        type: tpl.type,
        priority: weightedPriority(tpl),
        status,
        startTime: start,
        endTime: end,
      },
    });
    future++;
  }

  console.log(`  ✓ appointments: ${past + future} (${past} past completed + ${future} future)`);
}

// ───────────────────────────────────────────────────────────────────────────
// 10. AI actions — retention drafts/sent for at-risk + churned
// ───────────────────────────────────────────────────────────────────────────
async function seedAiActions(ctx: Ctx, customers: CustomerWithPlan[]) {
  const targets = customers.filter(c => c.archetype === 'atRisk' || c.archetype === 'churned');
  let count = 0;
  for (const c of targets) {
    const isSent = chance(0.5);
    const churnRisk = c.archetype === 'churned' ? randFloat(0.85, 0.98) : randFloat(0.55, 0.78);
    const factors = c.archetype === 'churned'
      ? ['silent_6+_months', 'inactive_status']
      : ['silent_3+_months', 'declining_visit_frequency'];

    await prisma.aiAction.create({
      data: {
        garageId: ctx.garage.id,
        customerId: c.id,
        kind: AiActionKind.DISCOUNT_SMS,
        status: isSent ? AiActionStatus.SENT : AiActionStatus.DRAFT,
        messageBody: `Bonjour ${c.firstName}, ça fait un moment ! Profitez de -15% sur votre prochaine visite chez AutoTech. Code: REVIENS15`,
        discountKind: DiscountKind.PERCENT,
        discountValue: 15,
        expiresAt: addDays(TODAY, 30),
        churnRiskSnapshot: round(churnRisk, 2),
        factorsSnapshot: factors,
        sentAt: isSent ? addDays(TODAY, -randInt(1, 7)) : null,
      },
    });
    count++;
  }
  console.log(`  ✓ ai actions: ${count} retention drafts/sent for at-risk + churned`);
}

// ───────────────────────────────────────────────────────────────────────────
// 11. Notifications
// ───────────────────────────────────────────────────────────────────────────
async function seedNotifications(ctx: Ctx) {
  const lowParts = await prisma.part.findMany({ where: { quantity: { lte: 5 } }, take: 3 });
  const overdueInv = await prisma.invoice.findFirst({ where: { status: InvoiceStatus.OVERDUE } });
  await prisma.notification.create({
    data: {
      garageId: ctx.garage.id,
      userId: ctx.owner.id,
      type: NotificationType.SYSTEM,
      title: 'Welcome to AutoTech',
      message: 'Demo data loaded. Try asking the assistant about your top customers, low stock parts, or overdue invoices.',
      isRead: false,
    },
  });
  for (const p of lowParts) {
    await prisma.notification.create({
      data: {
        garageId: ctx.garage.id,
        userId: ctx.owner.id,
        type: NotificationType.LOW_STOCK,
        title: 'Low Stock Alert',
        message: `${p.name} (${p.partNumber}) — only ${p.quantity} remaining (min ${p.minQuantity})`,
        isRead: false,
      },
    });
  }
  if (overdueInv) {
    await prisma.notification.create({
      data: {
        garageId: ctx.garage.id,
        userId: ctx.owner.id,
        type: NotificationType.INVOICE_OVERDUE,
        title: 'Overdue Invoice',
        message: `Invoice ${overdueInv.invoiceNumber} is overdue (${overdueInv.total} TND).`,
        isRead: false,
      },
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 12. Compute rollups — DERIVED FROM TRANSACTIONS, not literals
// ───────────────────────────────────────────────────────────────────────────
async function computeRollups() {
  // Customer.totalSpent = SUM(invoices.total WHERE status=PAID)
  // Customer.visitCount = COUNT(MaintenanceJob WHERE status=COMPLETED)
  // Customer.loyaltyTier = derive from totalSpent
  const customers = await prisma.customer.findMany({ select: { id: true, status: true } });
  for (const c of customers) {
    const paidAgg = await prisma.invoice.aggregate({
      where: { customerId: c.id, status: InvoiceStatus.PAID },
      _sum: { total: true },
    });
    const totalSpent = round(paidAgg._sum.total ?? 0, 2);

    // visitCount = completed maintenance jobs across all customer's cars
    const carIds = (await prisma.car.findMany({ where: { customerId: c.id }, select: { id: true } })).map(x => x.id);
    const visitCount = carIds.length === 0 ? 0 : await prisma.maintenanceJob.count({
      where: { carId: { in: carIds }, status: MaintenanceStatus.COMPLETED },
    });

    let loyaltyTier: string | null = null;
    if (totalSpent >= 3000) loyaltyTier = 'gold';
    else if (totalSpent >= 1500) loyaltyTier = 'silver';
    else if (totalSpent >= 500) loyaltyTier = 'bronze';

    await prisma.customer.update({
      where: { id: c.id },
      data: { totalSpent, visitCount, loyaltyTier },
    });
  }

  // Car.lastServiceDate = MAX(MaintenanceJob.completionDate)
  // Car.nextServiceDate = lastServiceDate + 6 months
  // Car.totalServices isn't a column — but lastService dates ARE.
  const cars = await prisma.car.findMany({ select: { id: true } });
  for (const c of cars) {
    const lastJob = await prisma.maintenanceJob.findFirst({
      where: { carId: c.id, status: MaintenanceStatus.COMPLETED, completionDate: { not: null } },
      orderBy: { completionDate: 'desc' },
      select: { completionDate: true },
    });
    if (lastJob?.completionDate) {
      const next = new Date(lastJob.completionDate);
      next.setUTCMonth(next.getUTCMonth() + 6);
      await prisma.car.update({
        where: { id: c.id },
        data: { lastServiceDate: lastJob.completionDate, nextServiceDate: next },
      });
    }
  }

  console.log('  ✓ rollups computed (totalSpent, visitCount, loyaltyTier, lastServiceDate, nextServiceDate)');
}

// ───────────────────────────────────────────────────────────────────────────
// 13. Verify integrity — fail loudly if anything is incoherent
// ───────────────────────────────────────────────────────────────────────────
async function verifyIntegrity() {
  const errors: string[] = [];
  const near = (a: number, b: number, eps = 0.05) => Math.abs(a - b) < eps;

  // Invoice arithmetic
  const invoices = await prisma.invoice.findMany({ include: { lineItems: true, payments: true } });
  for (const inv of invoices) {
    const expected = round((inv.subtotal - inv.discount) * 1.19, 2);
    if (Math.abs(expected - inv.total) > 0.5 && Math.abs(inv.taxAmount - round((inv.subtotal - inv.discount) * 0.19, 2)) > 0.5) {
      errors.push(`invoice ${inv.invoiceNumber} total ${inv.total} ≠ ${expected}`);
    }
    const linesum = round(inv.lineItems.reduce((s, li) => s + li.total, 0), 2);
    if (!near(linesum, inv.subtotal, 0.5)) {
      errors.push(`invoice ${inv.invoiceNumber} lineSum ${linesum} ≠ subtotal ${inv.subtotal}`);
    }
    if (inv.lineItems.length === 0) {
      errors.push(`invoice ${inv.invoiceNumber} has no line items`);
    }
    if (inv.status === InvoiceStatus.PAID) {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      if (!near(paid, inv.total, 0.5)) errors.push(`invoice ${inv.invoiceNumber} status=PAID but payments ${paid} ≠ total ${inv.total}`);
      if (!inv.paidAt) errors.push(`invoice ${inv.invoiceNumber} status=PAID but no paidAt`);
    }
  }

  // Customer rollups
  const customers = await prisma.customer.findMany();
  for (const c of customers) {
    const paidSum = await prisma.invoice.aggregate({ where: { customerId: c.id, status: InvoiceStatus.PAID }, _sum: { total: true } });
    const expected = round(paidSum._sum.total ?? 0, 2);
    if (!near(expected, c.totalSpent, 0.5)) {
      errors.push(`customer ${c.firstName} ${c.lastName} totalSpent ${c.totalSpent} ≠ paid invoices sum ${expected}`);
    }
  }

  // Appointments — startTime < endTime
  const apps = await prisma.appointment.findMany({ select: { id: true, startTime: true, endTime: true } });
  for (const a of apps) {
    if (a.endTime.getTime() <= a.startTime.getTime()) {
      errors.push(`appointment ${a.id} has endTime ≤ startTime`);
    }
  }

  // Inventory non-negative
  const parts = await prisma.part.findMany({ select: { id: true, name: true, quantity: true } });
  for (const p of parts) {
    if (p.quantity < 0) errors.push(`part ${p.name} quantity ${p.quantity} < 0`);
  }

  if (errors.length) {
    console.error(`\n❌ Integrity check failed with ${errors.length} errors:`);
    for (const e of errors.slice(0, 20)) console.error('   ' + e);
    if (errors.length > 20) console.error(`   ...+${errors.length - 20} more`);
    throw new Error('Seed verification failed');
  }
  console.log(`  ✓ integrity verified: ${invoices.length} invoices, ${customers.length} customers, ${apps.length} appointments, ${parts.length} parts`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
