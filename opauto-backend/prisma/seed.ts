import { PrismaClient, UserRole, AppointmentStatus, CustomerStatus, EmployeeRole, EmployeeDepartment, EmployeeStatus, MaintenanceStatus, ApprovalStatus, ApprovalType, InvoiceStatus, PaymentMethod, NotificationType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding OpAuto database...');

  // Clean existing data
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
  await prisma.user.deleteMany();
  await prisma.garage.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);
  const staffPassword = await bcrypt.hash('staff123', 10);

  // Create Garage
  const garage = await prisma.garage.create({
    data: {
      name: 'AutoTech Tunisia',
      address: '15 Avenue Habib Bourguiba, Tunis 1000',
      phone: '+216 71 234 567',
      email: 'contact@autotech.tn',
      specializations: ['MECHANICAL', 'BODYWORK', 'ELECTRICAL', 'TIRE_ALIGNMENT'],
      businessHours: {
        mon: { open: '08:00', close: '18:00' },
        tue: { open: '08:00', close: '18:00' },
        wed: { open: '08:00', close: '18:00' },
        thu: { open: '08:00', close: '18:00' },
        fri: { open: '08:00', close: '18:00' },
        sat: { open: '08:00', close: '13:00' },
        sun: null,
      },
      currency: 'TND',
      taxRate: 19,
    },
  });

  // Create Owner
  const owner = await prisma.user.create({
    data: {
      garageId: garage.id,
      email: 'owner@autotech.tn',
      password: hashedPassword,
      firstName: 'Ala',
      lastName: 'Ben Khlifa',
      role: UserRole.OWNER,
      phone: '+216 98 123 456',
    },
  });

  // Create Staff Users
  const staffUsers = await Promise.all([
    prisma.user.create({ data: { garageId: garage.id, username: 'mohamed', password: staffPassword, firstName: 'Mohamed', lastName: 'Trabelsi', role: UserRole.STAFF, phone: '+216 97 111 222' } }),
    prisma.user.create({ data: { garageId: garage.id, username: 'khalil', password: staffPassword, firstName: 'Khalil', lastName: 'Bouazizi', role: UserRole.STAFF, phone: '+216 97 333 444' } }),
    prisma.user.create({ data: { garageId: garage.id, username: 'youssef', password: staffPassword, firstName: 'Youssef', lastName: 'Gharbi', role: UserRole.STAFF, phone: '+216 97 555 666' } }),
    prisma.user.create({ data: { garageId: garage.id, username: 'hichem', password: staffPassword, firstName: 'Hichem', lastName: 'Sassi', role: UserRole.STAFF, phone: '+216 97 777 888' } }),
    prisma.user.create({ data: { garageId: garage.id, username: 'ali', password: staffPassword, firstName: 'Ali', lastName: 'Khelifi', role: UserRole.STAFF, phone: '+216 97 999 000' } }),
  ]);

  // Create Employees
  const employees = await Promise.all([
    prisma.employee.create({ data: { garageId: garage.id, userId: staffUsers[0].id, firstName: 'Mohamed', lastName: 'Trabelsi', email: 'mohamed@autotech.tn', phone: '+216 97 111 222', role: EmployeeRole.MECHANIC, department: EmployeeDepartment.MECHANICAL, status: EmployeeStatus.ACTIVE, hireDate: new Date('2022-01-15'), hourlyRate: 25, skills: ['engine_repair', 'oil_change', 'diagnostics'] } }),
    prisma.employee.create({ data: { garageId: garage.id, userId: staffUsers[1].id, firstName: 'Khalil', lastName: 'Bouazizi', email: 'khalil@autotech.tn', phone: '+216 97 333 444', role: EmployeeRole.MECHANIC, department: EmployeeDepartment.MECHANICAL, status: EmployeeStatus.ACTIVE, hireDate: new Date('2022-06-01'), hourlyRate: 28, skills: ['brakes', 'suspension', 'steering'] } }),
    prisma.employee.create({ data: { garageId: garage.id, userId: staffUsers[2].id, firstName: 'Youssef', lastName: 'Gharbi', email: 'youssef@autotech.tn', phone: '+216 97 555 666', role: EmployeeRole.ELECTRICIAN, department: EmployeeDepartment.ELECTRICAL, status: EmployeeStatus.ACTIVE, hireDate: new Date('2023-03-10'), hourlyRate: 30, skills: ['wiring', 'ecu_diagnostics', 'battery'] } }),
    prisma.employee.create({ data: { garageId: garage.id, userId: staffUsers[3].id, firstName: 'Hichem', lastName: 'Sassi', email: 'hichem@autotech.tn', phone: '+216 97 777 888', role: EmployeeRole.BODYWORK_SPECIALIST, department: EmployeeDepartment.BODYWORK, status: EmployeeStatus.ACTIVE, hireDate: new Date('2021-09-20'), hourlyRate: 27, skills: ['painting', 'dent_repair', 'panel_replacement'] } }),
    prisma.employee.create({ data: { garageId: garage.id, userId: staffUsers[4].id, firstName: 'Ali', lastName: 'Khelifi', email: 'ali@autotech.tn', phone: '+216 97 999 000', role: EmployeeRole.TIRE_SPECIALIST, department: EmployeeDepartment.TIRE_ALIGNMENT, status: EmployeeStatus.ACTIVE, hireDate: new Date('2023-08-15'), hourlyRate: 22, skills: ['tire_change', 'balancing', 'alignment'] } }),
  ]);

  // Create Customers (Tunisian names)
  const customers = await Promise.all([
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Ahmed', lastName: 'Ben Ali', email: 'ahmed.benali@email.tn', phone: '+216 22 111 222', address: 'Rue de la Liberté, Tunis', status: CustomerStatus.VIP, loyaltyTier: 'gold', totalSpent: 4500, visitCount: 15 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Fatima', lastName: 'Mahmoud', email: 'fatima.m@email.tn', phone: '+216 22 333 444', address: 'Avenue Farhat Hached, Sousse', status: CustomerStatus.ACTIVE, loyaltyTier: 'silver', totalSpent: 2200, visitCount: 8 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Omar', lastName: 'Trabelsi', email: 'omar.t@email.tn', phone: '+216 22 555 666', address: 'Rue Ibn Khaldoun, Sfax', status: CustomerStatus.ACTIVE, loyaltyTier: 'bronze', totalSpent: 1100, visitCount: 4 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Leila', lastName: 'Sassi', email: 'leila.s@email.tn', phone: '+216 22 777 888', address: 'Boulevard 7 Novembre, Bizerte', status: CustomerStatus.VIP, loyaltyTier: 'platinum', totalSpent: 8900, visitCount: 25 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Sami', lastName: 'Gharbi', phone: '+216 22 999 000', address: 'Tunis', status: CustomerStatus.ACTIVE, loyaltyTier: 'bronze', totalSpent: 600, visitCount: 2 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Nadia', lastName: 'Khelifi', email: 'nadia.k@email.tn', phone: '+216 23 111 222', address: 'Nabeul', status: CustomerStatus.ACTIVE, totalSpent: 950, visitCount: 3 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Sami', lastName: 'Chaabane', phone: '+216 23 333 444', address: 'La Marsa', status: CustomerStatus.ACTIVE, totalSpent: 1800, visitCount: 6 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Nadia', lastName: 'Bouzid', email: 'nadia.b@email.tn', phone: '+216 23 555 666', address: 'Ariana', status: CustomerStatus.ACTIVE, loyaltyTier: 'silver', totalSpent: 3200, visitCount: 10 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Yasmine', lastName: 'Hamdi', phone: '+216 23 777 888', address: 'Ben Arous', status: CustomerStatus.ACTIVE, totalSpent: 450, visitCount: 2 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Karim', lastName: 'Jebali', email: 'karim.j@email.tn', phone: '+216 24 111 222', address: 'Monastir', status: CustomerStatus.ACTIVE, totalSpent: 2100, visitCount: 7 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Amira', lastName: 'Mrad', phone: '+216 24 333 444', address: 'Hammamet', status: CustomerStatus.ACTIVE, totalSpent: 780, visitCount: 3 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Walid', lastName: 'Zouari', phone: '+216 24 555 666', address: 'Gabes', status: CustomerStatus.INACTIVE, totalSpent: 350, visitCount: 1 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Ines', lastName: 'Ferchichi', email: 'ines.f@email.tn', phone: '+216 24 777 888', address: 'Manouba', status: CustomerStatus.VIP, loyaltyTier: 'gold', totalSpent: 5600, visitCount: 18 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Hatem', lastName: 'Belhaj', phone: '+216 25 111 222', address: 'Kasserine', status: CustomerStatus.ACTIVE, totalSpent: 900, visitCount: 3 } }),
    prisma.customer.create({ data: { garageId: garage.id, firstName: 'Rim', lastName: 'Mansouri', email: 'rim.m@email.tn', phone: '+216 25 333 444', address: 'Djerba', status: CustomerStatus.ACTIVE, loyaltyTier: 'silver', totalSpent: 2800, visitCount: 9 } }),
  ]);

  // Create Cars
  const cars = await Promise.all([
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[0].id, make: 'Peugeot', model: '308', year: 2020, licensePlate: '123TUN456', color: 'White', mileage: 45000, engineType: 'diesel', transmission: 'manual' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[0].id, make: 'Volkswagen', model: 'Golf 8', year: 2022, licensePlate: '234TUN567', color: 'Gray', mileage: 22000, engineType: 'petrol', transmission: 'automatic' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[1].id, make: 'Renault', model: 'Clio', year: 2019, licensePlate: '789TUN123', color: 'Red', mileage: 62000, engineType: 'petrol', transmission: 'manual' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[2].id, make: 'BMW', model: 'X3', year: 2021, licensePlate: '456TUN789', color: 'Black', mileage: 35000, engineType: 'diesel', transmission: 'automatic' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[3].id, make: 'Ford', model: 'Focus', year: 2018, licensePlate: '321TUN654', color: 'Blue', mileage: 78000, engineType: 'petrol', transmission: 'manual' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[4].id, make: 'Hyundai', model: 'Tucson', year: 2023, licensePlate: '555TUN888', color: 'Silver', mileage: 12000, engineType: 'hybrid', transmission: 'automatic' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[5].id, make: 'Kia', model: 'Sportage', year: 2022, licensePlate: '999TUN111', color: 'White', mileage: 18000, engineType: 'diesel', transmission: 'automatic' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[6].id, make: 'Volkswagen', model: 'Golf', year: 2020, licensePlate: '987TUN321', color: 'Gray', mileage: 40000, engineType: 'petrol', transmission: 'manual' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[7].id, make: 'Toyota', model: 'Corolla', year: 2019, licensePlate: '654TUN987', color: 'White', mileage: 55000, engineType: 'petrol', transmission: 'automatic' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[8].id, make: 'Nissan', model: 'Qashqai', year: 2021, licensePlate: '333TUN777', color: 'Red', mileage: 28000, engineType: 'diesel', transmission: 'automatic' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[9].id, make: 'Mercedes', model: 'C-Class', year: 2020, licensePlate: '777TUN333', color: 'Black', mileage: 42000, engineType: 'diesel', transmission: 'automatic' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[10].id, make: 'Fiat', model: '500', year: 2021, licensePlate: '111TUN999', color: 'Yellow', mileage: 15000, engineType: 'petrol', transmission: 'manual' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[11].id, make: 'Citroen', model: 'C3', year: 2018, licensePlate: '444TUN666', color: 'White', mileage: 72000, engineType: 'diesel', transmission: 'manual' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[12].id, make: 'Audi', model: 'A4', year: 2022, licensePlate: '888TUN222', color: 'Silver', mileage: 20000, engineType: 'petrol', transmission: 'automatic' } }),
    prisma.car.create({ data: { garageId: garage.id, customerId: customers[13].id, make: 'Renault', model: 'Megane', year: 2019, licensePlate: '222TUN888', color: 'Gray', mileage: 58000, engineType: 'diesel', transmission: 'manual' } }),
  ]);

  // Create Appointments (April – July 2026)
  const d = (month: number, day: number, hour: number, min = 0) =>
    new Date(2026, month - 1, day, hour, min);

  const apt = (cust: number, car: number, emp: number | null, title: string, start: Date, end: Date, status: AppointmentStatus, type: string, priority = 'medium') =>
    prisma.appointment.create({ data: { garageId: garage.id, customerId: customers[cust].id, carId: cars[car].id, ...(emp !== null ? { employeeId: employees[emp].id } : {}), title, startTime: start, endTime: end, status, type, priority } });

  const appointments = await Promise.all([
    // ── April 2026 ──
    // Past (completed)
    apt(0, 0, 0, 'Oil Change + Inspection', d(4,10,9), d(4,10,10), AppointmentStatus.COMPLETED, 'oil-change'),
    apt(1, 2, 1, 'Brake System Repair', d(4,10,10,30), d(4,10,13,30), AppointmentStatus.COMPLETED, 'brake-service', 'high'),
    apt(6, 7, 0, 'Oil Change', d(4,11,9), d(4,11,10), AppointmentStatus.COMPLETED, 'oil-change', 'low'),
    apt(7, 8, 3, 'Dent Repair', d(4,11,10), d(4,11,16), AppointmentStatus.COMPLETED, 'bodywork'),
    // Today / upcoming this week
    apt(2, 3, 2, 'Engine Diagnostics', d(4,14,9), d(4,14,11), AppointmentStatus.SCHEDULED, 'engine-diagnostics'),
    apt(3, 4, null, 'Transmission Service', d(4,14,14), d(4,14,18), AppointmentStatus.SCHEDULED, 'transmission', 'high'),
    apt(4, 5, 4, 'Tire Replacement', d(4,14,15), d(4,14,16), AppointmentStatus.SCHEDULED, 'tire-replacement', 'low'),
    apt(5, 6, 2, 'AC Service', d(4,15,9), d(4,15,11), AppointmentStatus.CONFIRMED, 'electrical'),
    apt(8, 9, 0, 'Battery Replacement', d(4,15,10), d(4,15,11), AppointmentStatus.CONFIRMED, 'electrical', 'low'),
    apt(9, 10, 1, 'Suspension Check', d(4,16,8), d(4,16,10), AppointmentStatus.SCHEDULED, 'inspection'),
    apt(10, 11, 4, 'Tire Balancing', d(4,16,10), d(4,16,11), AppointmentStatus.SCHEDULED, 'tire-replacement', 'low'),
    apt(11, 12, 3, 'Paint Touch-up', d(4,17,9), d(4,17,12), AppointmentStatus.SCHEDULED, 'bodywork'),
    apt(12, 13, 0, 'Full Service', d(4,17,14), d(4,17,17), AppointmentStatus.SCHEDULED, 'oil-change', 'high'),
    // Rest of April
    apt(0, 1, 2, 'ECU Diagnostics', d(4,21,9), d(4,21,11), AppointmentStatus.SCHEDULED, 'engine-diagnostics'),
    apt(13, 14, 1, 'Brake Pad Replacement', d(4,21,14), d(4,21,16), AppointmentStatus.SCHEDULED, 'brake-service'),
    apt(14, 14, 4, 'Wheel Alignment', d(4,22,8), d(4,22,9,30), AppointmentStatus.SCHEDULED, 'tire-replacement', 'low'),
    apt(1, 2, 0, 'Oil Change', d(4,23,9), d(4,23,10), AppointmentStatus.SCHEDULED, 'oil-change', 'low'),
    apt(5, 6, 2, 'Alternator Repair', d(4,24,10), d(4,24,13), AppointmentStatus.SCHEDULED, 'electrical', 'high'),
    apt(3, 4, 3, 'Body Panel Repair', d(4,25,9), d(4,25,14), AppointmentStatus.SCHEDULED, 'bodywork', 'high'),
    apt(8, 9, 0, 'Timing Belt Replacement', d(4,28,8), d(4,28,12), AppointmentStatus.SCHEDULED, 'engine-diagnostics', 'high'),
    apt(9, 10, 1, 'Brake Fluid Flush', d(4,28,14), d(4,28,15,30), AppointmentStatus.SCHEDULED, 'brake-service'),
    apt(6, 7, 4, 'Tire Rotation', d(4,29,9), d(4,29,10), AppointmentStatus.SCHEDULED, 'tire-replacement', 'low'),
    apt(2, 3, 2, 'Check Engine Light', d(4,30,10), d(4,30,12), AppointmentStatus.SCHEDULED, 'engine-diagnostics'),

    // ── May 2026 ──
    apt(0, 0, 0, 'Oil Change', d(5,4,9), d(5,4,10), AppointmentStatus.SCHEDULED, 'oil-change', 'low'),
    apt(12, 13, 1, 'Brake Inspection', d(5,4,10), d(5,4,11,30), AppointmentStatus.SCHEDULED, 'brake-service'),
    apt(4, 5, 2, 'Battery Test', d(5,5,9), d(5,5,10), AppointmentStatus.SCHEDULED, 'electrical', 'low'),
    apt(7, 8, 3, 'Bumper Repair', d(5,5,10), d(5,5,14), AppointmentStatus.SCHEDULED, 'bodywork', 'high'),
    apt(10, 11, 4, 'New Tires', d(5,6,8), d(5,6,10), AppointmentStatus.SCHEDULED, 'tire-replacement'),
    apt(1, 2, 0, 'Clutch Adjustment', d(5,7,9), d(5,7,11), AppointmentStatus.SCHEDULED, 'transmission'),
    apt(3, 4, 2, 'Wiring Repair', d(5,8,14), d(5,8,17), AppointmentStatus.SCHEDULED, 'electrical', 'high'),
    apt(5, 6, 1, 'Front Brake Replacement', d(5,11,9), d(5,11,12), AppointmentStatus.SCHEDULED, 'brake-service', 'high'),
    apt(6, 7, 0, 'Oil & Filter Change', d(5,12,9), d(5,12,10), AppointmentStatus.SCHEDULED, 'oil-change', 'low'),
    apt(14, 14, 3, 'Scratch Repair', d(5,12,14), d(5,12,16), AppointmentStatus.SCHEDULED, 'bodywork'),
    apt(8, 9, 4, 'Tire Pressure Sensors', d(5,13,10), d(5,13,11,30), AppointmentStatus.SCHEDULED, 'tire-replacement'),
    apt(2, 3, 2, 'Engine Mount Replacement', d(5,14,8), d(5,14,12), AppointmentStatus.SCHEDULED, 'engine-diagnostics', 'high'),
    apt(9, 10, 0, 'Coolant Flush', d(5,18,9), d(5,18,10,30), AppointmentStatus.SCHEDULED, 'oil-change'),
    apt(11, 12, 1, 'ABS Sensor Check', d(5,19,14), d(5,19,16), AppointmentStatus.SCHEDULED, 'brake-service'),
    apt(0, 1, 4, 'Wheel Balancing', d(5,20,8), d(5,20,9), AppointmentStatus.SCHEDULED, 'tire-replacement', 'low'),
    apt(13, 14, 3, 'Door Dent Repair', d(5,21,10), d(5,21,13), AppointmentStatus.SCHEDULED, 'bodywork'),
    apt(4, 5, 2, 'Headlight Wiring', d(5,22,9), d(5,22,11), AppointmentStatus.SCHEDULED, 'electrical'),
    apt(7, 8, 0, 'Full Service 60k', d(5,25,8), d(5,25,12), AppointmentStatus.SCHEDULED, 'oil-change', 'high'),
    apt(1, 2, 1, 'Rear Brake Pads', d(5,26,14), d(5,26,16), AppointmentStatus.SCHEDULED, 'brake-service'),
    apt(3, 4, 2, 'Starter Motor', d(5,27,9), d(5,27,12), AppointmentStatus.SCHEDULED, 'electrical', 'high'),

    // ── June 2026 ──
    apt(0, 0, 0, 'Oil Change', d(6,1,9), d(6,1,10), AppointmentStatus.SCHEDULED, 'oil-change', 'low'),
    apt(5, 6, 1, 'Brake Disc Replacement', d(6,1,10), d(6,1,13), AppointmentStatus.SCHEDULED, 'brake-service', 'high'),
    apt(10, 11, 4, 'Summer Tires', d(6,2,8), d(6,2,10), AppointmentStatus.SCHEDULED, 'tire-replacement'),
    apt(2, 3, 2, 'AC Recharge', d(6,3,9), d(6,3,10,30), AppointmentStatus.SCHEDULED, 'electrical'),
    apt(12, 13, 3, 'Full Respray', d(6,4,8), d(6,4,17), AppointmentStatus.SCHEDULED, 'bodywork', 'high'),
    apt(8, 9, 0, 'Transmission Fluid', d(6,8,9), d(6,8,10,30), AppointmentStatus.SCHEDULED, 'transmission'),
    apt(6, 7, 1, 'Handbrake Cable', d(6,9,14), d(6,9,16), AppointmentStatus.SCHEDULED, 'brake-service'),
    apt(14, 14, 2, 'Alternator Belt', d(6,10,9), d(6,10,10,30), AppointmentStatus.SCHEDULED, 'electrical'),
    apt(9, 10, 4, 'Tire Replacement', d(6,11,8), d(6,11,9,30), AppointmentStatus.SCHEDULED, 'tire-replacement', 'low'),
    apt(4, 5, 0, 'Full Service', d(6,15,8), d(6,15,12), AppointmentStatus.SCHEDULED, 'oil-change'),
    apt(1, 2, 3, 'Windshield Chip Repair', d(6,16,10), d(6,16,11), AppointmentStatus.SCHEDULED, 'bodywork', 'low'),
    apt(11, 12, 1, 'Brake Fluid Change', d(6,17,9), d(6,17,10), AppointmentStatus.SCHEDULED, 'brake-service'),
    apt(3, 4, 2, 'AC Compressor', d(6,18,9), d(6,18,13), AppointmentStatus.SCHEDULED, 'electrical', 'high'),
    apt(7, 8, 0, 'Oil Change', d(6,22,9), d(6,22,10), AppointmentStatus.SCHEDULED, 'oil-change', 'low'),
    apt(0, 1, 4, 'Alignment Check', d(6,23,14), d(6,23,15,30), AppointmentStatus.SCHEDULED, 'tire-replacement'),
    apt(13, 14, 1, 'Brake Caliper Rebuild', d(6,24,8), d(6,24,12), AppointmentStatus.SCHEDULED, 'brake-service', 'high'),
    apt(5, 6, 3, 'Side Mirror Replacement', d(6,25,10), d(6,25,11,30), AppointmentStatus.SCHEDULED, 'bodywork'),
    apt(2, 3, 0, 'Spark Plug Replacement', d(6,29,9), d(6,29,10,30), AppointmentStatus.SCHEDULED, 'engine-diagnostics'),
    apt(8, 9, 2, 'Power Window Fix', d(6,30,14), d(6,30,16), AppointmentStatus.SCHEDULED, 'electrical'),

    // ── July 2026 ──
    apt(6, 7, 0, 'Oil Change', d(7,1,9), d(7,1,10), AppointmentStatus.SCHEDULED, 'oil-change', 'low'),
    apt(9, 10, 1, 'Front Brakes', d(7,1,10), d(7,1,12), AppointmentStatus.SCHEDULED, 'brake-service'),
    apt(4, 5, 4, 'Tire Rotation', d(7,2,8), d(7,2,9), AppointmentStatus.SCHEDULED, 'tire-replacement', 'low'),
    apt(12, 13, 2, 'Battery Replacement', d(7,2,9), d(7,2,10), AppointmentStatus.SCHEDULED, 'electrical'),
    apt(1, 2, 3, 'Fender Repair', d(7,6,9), d(7,6,14), AppointmentStatus.SCHEDULED, 'bodywork', 'high'),
    apt(0, 0, 0, 'Full Service 80k', d(7,7,8), d(7,7,12), AppointmentStatus.SCHEDULED, 'oil-change', 'high'),
    apt(3, 4, 1, 'Brake Inspection', d(7,8,9), d(7,8,10,30), AppointmentStatus.SCHEDULED, 'brake-service'),
    apt(14, 14, 2, 'Headlight Adjustment', d(7,9,14), d(7,9,15), AppointmentStatus.SCHEDULED, 'electrical', 'low'),
    apt(10, 11, 4, 'New Summer Tires', d(7,13,8), d(7,13,10), AppointmentStatus.SCHEDULED, 'tire-replacement'),
    apt(7, 8, 0, 'Engine Tune-up', d(7,14,9), d(7,14,12), AppointmentStatus.SCHEDULED, 'engine-diagnostics'),
    apt(5, 6, 3, 'Hood Repaint', d(7,15,8), d(7,15,15), AppointmentStatus.SCHEDULED, 'bodywork', 'high'),
    apt(11, 12, 1, 'Emergency Brake Fix', d(7,16,14), d(7,16,16), AppointmentStatus.SCHEDULED, 'brake-service', 'high'),
    apt(2, 3, 2, 'Fuel Pump Replacement', d(7,20,9), d(7,20,13), AppointmentStatus.SCHEDULED, 'engine-diagnostics', 'high'),
    apt(8, 9, 0, 'Oil Change', d(7,21,9), d(7,21,10), AppointmentStatus.SCHEDULED, 'oil-change', 'low'),
    apt(13, 14, 4, 'Wheel Alignment', d(7,22,8), d(7,22,9,30), AppointmentStatus.SCHEDULED, 'tire-replacement'),
    apt(0, 1, 1, 'Rear Brakes', d(7,23,14), d(7,23,16,30), AppointmentStatus.SCHEDULED, 'brake-service'),
    apt(6, 7, 2, 'AC Service', d(7,27,9), d(7,27,11), AppointmentStatus.SCHEDULED, 'electrical'),
    apt(9, 10, 3, 'Bumper Respray', d(7,28,10), d(7,28,14), AppointmentStatus.SCHEDULED, 'bodywork'),
    apt(4, 5, 0, 'Transmission Check', d(7,29,9), d(7,29,11), AppointmentStatus.SCHEDULED, 'transmission'),
    apt(1, 2, 4, 'Tire Inspection', d(7,30,8), d(7,30,9), AppointmentStatus.SCHEDULED, 'tire-replacement', 'low'),
  ]);

  // Create Suppliers
  const suppliers = await Promise.all([
    prisma.supplier.create({ data: { garageId: garage.id, name: 'TunisAuto Parts', email: 'orders@tunisauto.tn', phone: '+216 71 888 999', address: 'Zone Industrielle, Tunis' } }),
    prisma.supplier.create({ data: { garageId: garage.id, name: 'MaghrEb Pièces', email: 'contact@maghrebpieces.tn', phone: '+216 71 777 666', address: 'Sousse' } }),
  ]);

  // Create Parts (50+)
  const partData = [
    { name: 'Oil Filter - Universal', partNumber: 'OF-001', category: 'Filters', quantity: 25, minQuantity: 10, unitPrice: 15, costPrice: 8 },
    { name: 'Air Filter - Peugeot 308', partNumber: 'AF-P308', category: 'Filters', quantity: 8, minQuantity: 5, unitPrice: 25, costPrice: 14 },
    { name: 'Brake Pads - Front (Universal)', partNumber: 'BP-F001', category: 'Brakes', quantity: 12, minQuantity: 6, unitPrice: 45, costPrice: 25 },
    { name: 'Brake Pads - Rear (Universal)', partNumber: 'BP-R001', category: 'Brakes', quantity: 10, minQuantity: 6, unitPrice: 40, costPrice: 22 },
    { name: 'Brake Disc - Front', partNumber: 'BD-F001', category: 'Brakes', quantity: 4, minQuantity: 4, unitPrice: 85, costPrice: 50 },
    { name: 'Engine Oil 5W-40 (5L)', partNumber: 'EO-5W40', category: 'Fluids', quantity: 30, minQuantity: 15, unitPrice: 55, costPrice: 32 },
    { name: 'Transmission Fluid ATF (1L)', partNumber: 'TF-ATF', category: 'Fluids', quantity: 15, minQuantity: 8, unitPrice: 22, costPrice: 12 },
    { name: 'Coolant (5L)', partNumber: 'CL-5L', category: 'Fluids', quantity: 20, minQuantity: 10, unitPrice: 18, costPrice: 10 },
    { name: 'Spark Plug - NGK', partNumber: 'SP-NGK01', category: 'Ignition', quantity: 40, minQuantity: 20, unitPrice: 12, costPrice: 6 },
    { name: 'Battery 12V 60Ah', partNumber: 'BAT-60', category: 'Electrical', quantity: 5, minQuantity: 3, unitPrice: 120, costPrice: 75 },
    { name: 'Alternator Belt', partNumber: 'AB-001', category: 'Belts', quantity: 8, minQuantity: 4, unitPrice: 35, costPrice: 18 },
    { name: 'Timing Belt Kit', partNumber: 'TB-KIT01', category: 'Belts', quantity: 3, minQuantity: 2, unitPrice: 180, costPrice: 110 },
    { name: 'Wiper Blades (pair)', partNumber: 'WB-001', category: 'Accessories', quantity: 15, minQuantity: 8, unitPrice: 20, costPrice: 10 },
    { name: 'Cabin Air Filter', partNumber: 'CAF-001', category: 'Filters', quantity: 3, minQuantity: 5, unitPrice: 18, costPrice: 9 },
    { name: 'Tire 205/55 R16', partNumber: 'T-20555R16', category: 'Tires', quantity: 8, minQuantity: 4, unitPrice: 95, costPrice: 65 },
  ];

  const parts = await Promise.all(
    partData.map((p, i) =>
      prisma.part.create({
        data: { ...p, garageId: garage.id, supplierId: i % 2 === 0 ? suppliers[0].id : suppliers[1].id, location: `Shelf ${String.fromCharCode(65 + (i % 5))}-${Math.floor(i / 5) + 1}` },
      })
    )
  );

  // Create Maintenance Jobs
  const maintenanceJobs = await Promise.all([
    prisma.maintenanceJob.create({ data: { garageId: garage.id, carId: cars[2].id, employeeId: employees[1].id, title: 'Complete Brake Overhaul', description: 'Replace all brake pads, front discs, and bleed system', status: MaintenanceStatus.IN_PROGRESS, priority: 'high', estimatedHours: 4, estimatedCost: 450, startDate: new Date() } }),
    prisma.maintenanceJob.create({ data: { garageId: garage.id, carId: cars[7].id, employeeId: employees[0].id, title: 'Major Service - 60k km', description: 'Oil change, all filters, spark plugs, timing belt inspection', status: MaintenanceStatus.QUALITY_CHECK, priority: 'medium', estimatedHours: 3, actualHours: 2.5, estimatedCost: 350, actualCost: 320 } }),
    prisma.maintenanceJob.create({ data: { garageId: garage.id, carId: cars[8].id, employeeId: employees[3].id, title: 'Rear Fender Dent Repair', description: 'Minor dent repair and paint touch-up on rear left fender', status: MaintenanceStatus.COMPLETED, priority: 'low', estimatedHours: 6, actualHours: 5, estimatedCost: 600, actualCost: 550, completionDate: new Date(Date.now() - 86400000) } }),
    prisma.maintenanceJob.create({ data: { garageId: garage.id, carId: cars[3].id, employeeId: employees[2].id, title: 'ECU Diagnostics', description: 'Check engine light diagnostics and sensor inspection', status: MaintenanceStatus.PENDING, priority: 'medium', estimatedHours: 2, estimatedCost: 150 } }),
    prisma.maintenanceJob.create({ data: { garageId: garage.id, carId: cars[4].id, title: 'Transmission Fluid Change', description: 'Full transmission fluid flush and filter replacement', status: MaintenanceStatus.WAITING_APPROVAL, priority: 'high', estimatedHours: 3, estimatedCost: 280 } }),
  ]);

  // Create Invoices (spread across Jan–Apr 2026 for revenue chart)
  const invoiceData = [
    // January 2026
    { customerId: customers[0].id, invoiceNumber: 'INV-202601-0001', status: InvoiceStatus.PAID, subtotal: 280, taxAmount: 53.2, total: 333.2, createdAt: new Date('2026-01-10'), dueDate: new Date('2026-01-24'), paidAt: new Date('2026-01-15') },
    { customerId: customers[3].id, invoiceNumber: 'INV-202601-0002', status: InvoiceStatus.PAID, subtotal: 650, taxAmount: 123.5, total: 773.5, createdAt: new Date('2026-01-22'), dueDate: new Date('2026-02-05'), paidAt: new Date('2026-01-28') },
    // February 2026
    { customerId: customers[1].id, invoiceNumber: 'INV-202602-0001', status: InvoiceStatus.PAID, subtotal: 420, taxAmount: 79.8, total: 499.8, createdAt: new Date('2026-02-05'), dueDate: new Date('2026-02-19'), paidAt: new Date('2026-02-12') },
    { customerId: customers[7].id, invoiceNumber: 'INV-202602-0002', status: InvoiceStatus.PAID, subtotal: 890, taxAmount: 169.1, total: 1059.1, createdAt: new Date('2026-02-18'), dueDate: new Date('2026-03-04'), paidAt: new Date('2026-02-25') },
    { customerId: customers[4].id, invoiceNumber: 'INV-202602-0003', status: InvoiceStatus.PAID, subtotal: 180, taxAmount: 34.2, total: 214.2, createdAt: new Date('2026-02-26'), dueDate: new Date('2026-03-12'), paidAt: new Date('2026-03-02') },
    // March 2026
    { customerId: customers[6].id, invoiceNumber: 'INV-202603-0001', status: InvoiceStatus.PAID, subtotal: 550, taxAmount: 104.5, total: 654.5, createdAt: new Date('2026-03-03'), dueDate: new Date('2026-03-17'), paidAt: new Date('2026-03-10') },
    { customerId: customers[9].id, invoiceNumber: 'INV-202603-0002', status: InvoiceStatus.PAID, subtotal: 1200, taxAmount: 228, total: 1428, createdAt: new Date('2026-03-15'), dueDate: new Date('2026-03-29'), paidAt: new Date('2026-03-22') },
    { customerId: customers[12].id, invoiceNumber: 'INV-202603-0003', status: InvoiceStatus.PAID, subtotal: 320, taxAmount: 60.8, total: 380.8, createdAt: new Date('2026-03-28'), dueDate: new Date('2026-04-11'), paidAt: new Date('2026-04-02') },
    // April 2026
    { customerId: customers[0].id, invoiceNumber: 'INV-202604-0001', status: InvoiceStatus.PAID, subtotal: 750, taxAmount: 142.5, total: 892.5, createdAt: new Date('2026-04-02'), dueDate: new Date('2026-04-16'), paidAt: new Date('2026-04-08') },
    { customerId: customers[1].id, invoiceNumber: 'INV-202604-0002', status: InvoiceStatus.SENT, subtotal: 450, taxAmount: 85.5, total: 535.5, createdAt: new Date('2026-04-10'), dueDate: new Date('2026-04-24') },
    { customerId: customers[3].id, invoiceNumber: 'INV-202604-0003', status: InvoiceStatus.DRAFT, subtotal: 380, taxAmount: 72.2, total: 452.2, createdAt: new Date('2026-04-13') },
    { customerId: customers[14].id, invoiceNumber: 'INV-202604-0004', status: InvoiceStatus.OVERDUE, subtotal: 290, taxAmount: 55.1, total: 345.1, createdAt: new Date('2026-04-01'), dueDate: new Date('2026-04-08') },
  ];

  const invoices = await Promise.all(
    invoiceData.map(inv => prisma.invoice.create({ data: { garageId: garage.id, ...inv } }))
  );

  // Create Notifications
  await Promise.all([
    prisma.notification.create({ data: { garageId: garage.id, userId: owner.id, type: NotificationType.APPOINTMENT_REMINDER, title: 'Upcoming Appointment', message: 'Ahmed Ben Ali - Peugeot 308 at 09:00 tomorrow', isRead: false } }),
    prisma.notification.create({ data: { garageId: garage.id, type: NotificationType.MAINTENANCE_STATUS, title: 'Job Completed', message: 'Oil change for VW Golf completed by Mohamed', isRead: false } }),
    prisma.notification.create({ data: { garageId: garage.id, userId: owner.id, type: NotificationType.APPROVAL_REQUEST, title: 'Approval Required', message: 'Additional brake disc replacement - 450 TND for Fatima Mahmoud', isRead: false } }),
    prisma.notification.create({ data: { garageId: garage.id, type: NotificationType.LOW_STOCK, title: 'Low Stock Alert', message: 'Cabin Air Filter (CAF-001) - Only 3 remaining (min: 5)', isRead: false } }),
    prisma.notification.create({ data: { garageId: garage.id, userId: owner.id, type: NotificationType.INVOICE_OVERDUE, title: 'Overdue Invoice', message: 'Invoice INV-202603-0006 for Karim Jebali is 5 days overdue', isRead: true } }),
    prisma.notification.create({ data: { garageId: garage.id, type: NotificationType.SYSTEM, title: 'System Update', message: 'New module available: AI Features - Get AI-powered diagnostics', isRead: true } }),
  ]);

  // Activate all modules for demo
  const allModules = ['dashboard', 'customers', 'cars', 'appointments', 'calendar', 'maintenance', 'invoicing', 'inventory', 'employees', 'reports', 'approvals', 'users', 'settings', 'ai', 'notifications'];
  await prisma.garageModule.createMany({
    data: allModules.map(moduleId => ({ garageId: garage.id, moduleId })),
  });

  console.log('Seed completed successfully!');
  console.log(`Created: 1 garage, ${1 + staffUsers.length} users, ${employees.length} employees, ${customers.length} customers, ${cars.length} cars`);
  console.log(`Login credentials: owner@autotech.tn / password123 (owner), mohamed/staff123 (staff)`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
