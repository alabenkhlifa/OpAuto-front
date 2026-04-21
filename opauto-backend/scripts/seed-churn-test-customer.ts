import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_PHONE = '+21656829196';
const FIRST_NAME = 'Churn';
const LAST_NAME = 'Test';

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

async function main() {
  const garage = await prisma.garage.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!garage) {
    throw new Error('No garage found — run `npx prisma db seed` first.');
  }

  const existing = await prisma.customer.findFirst({
    where: { garageId: garage.id, phone: TEST_PHONE },
  });

  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: {
          firstName: FIRST_NAME,
          lastName: LAST_NAME,
          status: 'ACTIVE',
          visitCount: 12,
          smsOptIn: true,
          createdAt: daysAgo(400),
        },
      })
    : await prisma.customer.create({
        data: {
          garageId: garage.id,
          firstName: FIRST_NAME,
          lastName: LAST_NAME,
          phone: TEST_PHONE,
          email: null,
          status: 'ACTIVE',
          visitCount: 12,
          smsOptIn: true,
          createdAt: daysAgo(400),
        },
      });

  let car = await prisma.car.findFirst({ where: { customerId: customer.id } });
  if (!car) {
    car = await prisma.car.create({
      data: {
        garageId: garage.id,
        customerId: customer.id,
        make: 'Peugeot',
        model: '208',
        year: 2019,
        licensePlate: `CHURN-${customer.id.slice(0, 6)}`,
      },
    });
  }

  await prisma.appointment.deleteMany({ where: { customerId: customer.id } });
  await prisma.appointment.createMany({
    data: [
      {
        garageId: garage.id,
        customerId: customer.id,
        carId: car.id,
        status: 'COMPLETED',
        title: 'Vidange',
        startTime: daysAgo(300),
        endTime: daysAgo(300),
      },
      {
        garageId: garage.id,
        customerId: customer.id,
        carId: car.id,
        status: 'COMPLETED',
        title: 'Révision',
        startTime: daysAgo(220),
        endTime: daysAgo(220),
      },
      {
        garageId: garage.id,
        customerId: customer.id,
        carId: car.id,
        status: 'COMPLETED',
        title: 'Freins',
        startTime: daysAgo(150),
        endTime: daysAgo(150),
      },
    ],
  });

  console.log('✅ Test customer ready:');
  console.log(`   id:        ${customer.id}`);
  console.log(`   name:      ${FIRST_NAME} ${LAST_NAME}`);
  console.log(`   phone:     ${TEST_PHONE}`);
  console.log(`   smsOptIn:  ${customer.smsOptIn}`);
  console.log(`   lastActivity: 150 days ago (high-risk)`);
  console.log(`   garage:    ${garage.name} (${garage.id})`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
