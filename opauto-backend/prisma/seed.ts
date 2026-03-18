import { PrismaClient, UserRole, AppointmentStatus, CustomerStatus, EmployeeRole, EmployeeDepartment, EmployeeStatus, MaintenanceStatus, ApprovalStatus, ApprovalType, InvoiceStatus, PaymentMethod, NotificationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  // Create Appointments (mix of past and upcoming)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const appointments = await Promise.all([
    prisma.appointment.create({ data: { garageId: garage.id, customerId: customers[0].id, carId: cars[0].id, employeeId: employees[0].id, title: 'Oil Change + Inspection', startTime: new Date(today.getTime() + 9 * 3600000), endTime: new Date(today.getTime() + 10 * 3600000), status: AppointmentStatus.COMPLETED, type: 'oil-change', priority: 'medium' } }),
    prisma.appointment.create({ data: { garageId: garage.id, customerId: customers[1].id, carId: cars[2].id, employeeId: employees[1].id, title: 'Brake System Repair', startTime: new Date(today.getTime() + 10.5 * 3600000), endTime: new Date(today.getTime() + 13.5 * 3600000), status: AppointmentStatus.IN_PROGRESS, type: 'brake-service', priority: 'high' } }),
    prisma.appointment.create({ data: { garageId: garage.id, customerId: customers[2].id, carId: cars[3].id, employeeId: employees[2].id, title: 'Engine Diagnostics', startTime: new Date(today.getTime() + 14 * 3600000), endTime: new Date(today.getTime() + 16 * 3600000), status: AppointmentStatus.SCHEDULED, type: 'engine-diagnostics', priority: 'medium' } }),
    prisma.appointment.create({ data: { garageId: garage.id, customerId: customers[3].id, carId: cars[4].id, title: 'Transmission Service', startTime: new Date(today.getTime() + 16 * 3600000), endTime: new Date(today.getTime() + 20 * 3600000), status: AppointmentStatus.SCHEDULED, type: 'transmission', priority: 'high' } }),
    prisma.appointment.create({ data: { garageId: garage.id, customerId: customers[4].id, carId: cars[5].id, employeeId: employees[4].id, title: 'Tire Replacement', startTime: new Date(today.getTime() + 17.5 * 3600000), endTime: new Date(today.getTime() + 18.5 * 3600000), status: AppointmentStatus.SCHEDULED, type: 'tire-replacement', priority: 'low' } }),
    // Tomorrow
    prisma.appointment.create({ data: { garageId: garage.id, customerId: customers[5].id, carId: cars[6].id, employeeId: employees[2].id, title: 'AC Service', startTime: new Date(today.getTime() + 33 * 3600000), endTime: new Date(today.getTime() + 35 * 3600000), status: AppointmentStatus.CONFIRMED, type: 'electrical', priority: 'medium' } }),
    prisma.appointment.create({ data: { garageId: garage.id, customerId: customers[8].id, carId: cars[9].id, employeeId: employees[0].id, title: 'Battery Replacement', startTime: new Date(today.getTime() + 34 * 3600000), endTime: new Date(today.getTime() + 35 * 3600000), status: AppointmentStatus.CONFIRMED, type: 'electrical', priority: 'low' } }),
    // Past (yesterday)
    prisma.appointment.create({ data: { garageId: garage.id, customerId: customers[6].id, carId: cars[7].id, employeeId: employees[0].id, title: 'Oil Change', startTime: new Date(today.getTime() - 15 * 3600000), endTime: new Date(today.getTime() - 14 * 3600000), status: AppointmentStatus.COMPLETED, type: 'oil-change', priority: 'low' } }),
    prisma.appointment.create({ data: { garageId: garage.id, customerId: customers[7].id, carId: cars[8].id, employeeId: employees[3].id, title: 'Dent Repair', startTime: new Date(today.getTime() - 14 * 3600000), endTime: new Date(today.getTime() - 8 * 3600000), status: AppointmentStatus.COMPLETED, type: 'bodywork', priority: 'medium' } }),
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

  // Create Invoices
  const invoiceData = [
    { customerId: customers[0].id, invoiceNumber: 'INV-202603-0001', status: InvoiceStatus.PAID, subtotal: 180, taxAmount: 34.2, total: 214.2, dueDate: new Date(Date.now() - 7 * 86400000), paidAt: new Date(Date.now() - 5 * 86400000) },
    { customerId: customers[1].id, invoiceNumber: 'INV-202603-0002', status: InvoiceStatus.SENT, subtotal: 450, taxAmount: 85.5, total: 535.5, dueDate: new Date(Date.now() + 14 * 86400000) },
    { customerId: customers[3].id, invoiceNumber: 'INV-202603-0003', status: InvoiceStatus.PAID, subtotal: 890, taxAmount: 169.1, total: 1059.1, paidAt: new Date(Date.now() - 3 * 86400000) },
    { customerId: customers[6].id, invoiceNumber: 'INV-202603-0004', status: InvoiceStatus.DRAFT, subtotal: 120, taxAmount: 22.8, total: 142.8 },
    { customerId: customers[7].id, invoiceNumber: 'INV-202603-0005', status: InvoiceStatus.PAID, subtotal: 550, taxAmount: 104.5, total: 654.5, paidAt: new Date(Date.now() - 10 * 86400000) },
    { customerId: customers[9].id, invoiceNumber: 'INV-202603-0006', status: InvoiceStatus.OVERDUE, subtotal: 320, taxAmount: 60.8, total: 380.8, dueDate: new Date(Date.now() - 5 * 86400000) },
    { customerId: customers[12].id, invoiceNumber: 'INV-202603-0007', status: InvoiceStatus.PAID, subtotal: 1200, taxAmount: 228, total: 1428, paidAt: new Date(Date.now() - 1 * 86400000) },
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
