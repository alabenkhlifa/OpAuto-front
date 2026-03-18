import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { execSync } from 'child_process';
import * as path from 'path';

// Use the test database — never touch the dev database
const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('OpAuto API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Shared state across tests (tests run in order)
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let garageId: string;
  let customerId: string;
  let customer2Id: string;
  let carId: string;
  let car2Id: string;
  let employeeId: string;
  let appointmentId: string;
  let appointment2Id: string;
  let partId: string;

  beforeAll(async () => {
    // Force tests to use the test database
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    // Create the test database if it doesn't exist and push schema
    try {
      execSync(`createdb -h localhost -U postgres opauto_test 2>/dev/null || true`, { env: { ...process.env, PGPASSWORD: 'postgres' } });
      execSync('npx prisma db push --skip-generate', {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
      });
    } catch {
      // db push may warn but still succeed
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Clean test database before tests
    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations')
        LOOP
          EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
        END LOOP;
      END $$;
    `);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── AUTH ────────────────────────────────────────────────

  describe('Auth', () => {
    it('POST /api/auth/register - should create owner account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test@opauto.tn',
          password: 'Test1234!',
          firstName: 'Ala',
          lastName: 'Ben Khlifa',
          garageName: 'Test Garage',
          phone: '+216 71 000 000',
        })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('test@opauto.tn');
      expect(res.body.user.firstName).toBe('Ala');
      expect(res.body.user.lastName).toBe('Ben Khlifa');
      expect(res.body.user.role).toBe('OWNER');
      expect(res.body.user.garage).toBeDefined();
      expect(res.body.user.garage.name).toBe('Test Garage');

      accessToken = res.body.access_token;
      refreshToken = res.body.refresh_token;
      userId = res.body.user.id;
      garageId = res.body.user.garage.id;
    });

    it('POST /api/auth/register - should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test@opauto.tn',
          password: 'Test1234!',
          firstName: 'Duplicate',
          lastName: 'User',
          garageName: 'Another Garage',
        })
        .expect(409);
    });

    it('POST /api/auth/login - should authenticate with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@opauto.tn', password: 'Test1234!' })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.user.email).toBe('test@opauto.tn');
      expect(res.body.user.role).toBe('OWNER');

      // Use tokens for subsequent tests
      accessToken = res.body.access_token;
      refreshToken = res.body.refresh_token;
    });

    it('POST /api/auth/login - should reject invalid password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@opauto.tn', password: 'wrong' })
        .expect(401);
    });

    it('GET /api/auth/profile - should return current user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(userId);
      expect(res.body.email).toBe('test@opauto.tn');
      expect(res.body.garage).toBeDefined();
      expect(res.body.garage.id).toBe(garageId);
    });

    it('GET /api/auth/profile - should reject without token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/profile')
        .expect(401);
    });

    it('POST /api/auth/refresh - should return new token pair using refresh_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.access_token.split('.')).toHaveLength(3);
      expect(res.body.refresh_token.split('.')).toHaveLength(3);
      expect(res.body.user.email).toBe('test@opauto.tn');

      // Use new tokens going forward
      accessToken = res.body.access_token;
      refreshToken = res.body.refresh_token;
    });

    it('POST /api/auth/refresh - should reject access_token used as refresh_token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: accessToken })
        .expect(401);
    });

    it('POST /api/auth/refresh - should reject empty body', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({})
        .expect(401);
    });

    it('GET /api/auth/profile - should work with refreshed access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe('test@opauto.tn');
    });
  });

  // ─── CUSTOMERS ───────────────────────────────────────────

  describe('Customers', () => {
    it('POST /api/customers - should create a customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Ahmed',
          lastName: 'Ben Ali',
          phone: '+216-20-123-456',
          email: 'ahmed@email.tn',
          address: '15 Avenue Bourguiba, Tunis',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.firstName).toBe('Ahmed');
      expect(res.body.lastName).toBe('Ben Ali');
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.garageId).toBe(garageId);

      customerId = res.body.id;
    });

    it('POST /api/customers - should create a second customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Fatma',
          lastName: 'Trabelsi',
          phone: '+216-25-789-123',
          email: 'fatma@email.tn',
          address: '42 Rue de la République, Sfax',
        })
        .expect(201);

      expect(res.body.firstName).toBe('Fatma');
      customer2Id = res.body.id;
    });

    it('GET /api/customers - should list all customers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      // Should include relations
      expect(res.body[0]).toHaveProperty('cars');
      expect(res.body[0]).toHaveProperty('_count');
    });

    it('GET /api/customers/:id - should return a single customer', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(customerId);
      expect(res.body.firstName).toBe('Ahmed');
    });

    it('PUT /api/customers/:id - should update a customer', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ phone: '+216-20-999-888', notes: 'VIP customer' })
        .expect(200);

      expect(res.body.phone).toBe('+216-20-999-888');
      expect(res.body.notes).toBe('VIP customer');
    });
  });

  // ─── CARS ────────────────────────────────────────────────

  describe('Cars', () => {
    it('POST /api/cars - should create a car for Ahmed', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cars')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          licensePlate: '123 TUN 2024',
          make: 'BMW',
          model: 'X5',
          year: 2020,
          customerId,
          mileage: 45000,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.make).toBe('BMW');
      expect(res.body.licensePlate).toBe('123 TUN 2024');
      expect(res.body.customerId).toBe(customerId);

      carId = res.body.id;
    });

    it('POST /api/cars - should create a car for Fatma', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cars')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          licensePlate: '456 TUN 2019',
          make: 'Honda',
          model: 'Civic',
          year: 2019,
          customerId: customer2Id,
          mileage: 78000,
        })
        .expect(201);

      expect(res.body.make).toBe('Honda');
      car2Id = res.body.id;
    });

    it('GET /api/cars - should list all cars with customer relation', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/cars')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body[0]).toHaveProperty('customer');
    });

    it('GET /api/cars - should include customer relation in response', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/cars')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const ahmedCar = res.body.find((c: any) => c.make === 'BMW');
      expect(ahmedCar).toBeDefined();
      expect(ahmedCar.customer).toBeDefined();
      expect(ahmedCar.customer.firstName).toBe('Ahmed');
    });

    it('PUT /api/cars/:id - should update mileage', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/cars/${carId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ mileage: 46000 })
        .expect(200);

      expect(res.body.mileage).toBe(46000);
    });
  });

  // ─── EMPLOYEES ───────────────────────────────────────────

  describe('Employees', () => {
    it('POST /api/employees - should create a mechanic', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/employees')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Karim',
          lastName: 'Mechanic',
          email: 'karim@opauto.tn',
          phone: '+216-20-111-222',
          role: 'MECHANIC',
          department: 'MECHANICAL',
          skills: ['oil-change', 'engine', 'brakes'],
          hourlyRate: 8,
          hireDate: '2020-01-15T00:00:00.000Z',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.firstName).toBe('Karim');
      expect(res.body.role).toBe('MECHANIC');
      expect(res.body.department).toBe('MECHANICAL');
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.skills).toEqual(['oil-change', 'engine', 'brakes']);

      employeeId = res.body.id;
    });

    it('POST /api/employees - should reject without required hireDate', async () => {
      await request(app.getHttpServer())
        .post('/api/employees')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Missing',
          lastName: 'HireDate',
          role: 'MECHANIC',
          department: 'MECHANICAL',
        })
        .expect(400);
    });

    it('GET /api/employees - should list employees', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/employees')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].firstName).toBe('Karim');
    });

    it('PUT /api/employees/:id - should update employee', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ hourlyRate: 10, skills: ['oil-change', 'engine', 'brakes', 'transmission'] })
        .expect(200);

      expect(res.body.hourlyRate).toBe(10);
      expect(res.body.skills).toContain('transmission');
    });
  });

  // ─── APPOINTMENTS ────────────────────────────────────────

  describe('Appointments', () => {
    it('POST /api/appointments - should schedule oil change', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const endTime = new Date(tomorrow);
      endTime.setHours(10, 30);

      const res = await request(app.getHttpServer())
        .post('/api/appointments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Oil Change & Filter Replacement',
          type: 'oil-change',
          startTime: tomorrow.toISOString(),
          endTime: endTime.toISOString(),
          carId,
          customerId,
          employeeId,
          notes: 'Customer requested synthetic oil',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Oil Change & Filter Replacement');
      expect(res.body.status).toBe('SCHEDULED');
      expect(res.body.customer.firstName).toBe('Ahmed');
      expect(res.body.car.make).toBe('BMW');
      expect(res.body.employee.firstName).toBe('Karim');

      appointmentId = res.body.id;
    });

    it('POST /api/appointments - should schedule brake repair', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);
      const endTime = new Date(tomorrow);
      endTime.setHours(16, 0);

      const res = await request(app.getHttpServer())
        .post('/api/appointments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Front Brake Pads Replacement',
          type: 'brake-repair',
          startTime: tomorrow.toISOString(),
          endTime: endTime.toISOString(),
          carId: car2Id,
          customerId: customer2Id,
          employeeId,
          notes: 'Customer reported squeaking noise',
        })
        .expect(201);

      expect(res.body.title).toBe('Front Brake Pads Replacement');
      expect(res.body.customer.firstName).toBe('Fatma');

      appointment2Id = res.body.id;
    });

    it('GET /api/appointments - should list all appointments with relations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);

      const apt = res.body[0];
      expect(apt).toHaveProperty('customer');
      expect(apt).toHaveProperty('car');
      expect(apt).toHaveProperty('employee');
      expect(apt.customer).toHaveProperty('firstName');
      expect(apt.car).toHaveProperty('licensePlate');
    });

    it('PUT /api/appointments/:id - should update status to IN_PROGRESS', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(res.body.status).toBe('IN_PROGRESS');
    });

    it('PUT /api/appointments/:id - should complete appointment', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'COMPLETED' })
        .expect(200);

      expect(res.body.status).toBe('COMPLETED');
    });
  });

  // ─── INVENTORY ───────────────────────────────────────────

  describe('Inventory', () => {
    it('POST /api/inventory - should add engine oil', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Engine Oil 5W-30',
          partNumber: 'EO-5W30-5L',
          description: 'Synthetic engine oil',
          category: 'fluids',
          quantity: 12,
          minQuantity: 5,
          unitPrice: 45.5,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Engine Oil 5W-30');
      expect(res.body.quantity).toBe(12);
      expect(res.body.unitPrice).toBe(45.5);

      partId = res.body.id;
    });

    it('POST /api/inventory - should add brake pads', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Brake Pads Front Set',
          partNumber: 'BP-FRONT-BMW',
          description: 'Front brake pads for BMW',
          category: 'brakes',
          quantity: 4,
          minQuantity: 2,
          unitPrice: 180.0,
        })
        .expect(201);

      expect(res.body.name).toBe('Brake Pads Front Set');
    });

    it('POST /api/inventory - should add out-of-stock item', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Air Filter Universal',
          partNumber: 'AF-UNI-001',
          description: 'Universal air filter',
          category: 'filters',
          quantity: 0,
          minQuantity: 8,
          unitPrice: 25.9,
        })
        .expect(201);

      expect(res.body.quantity).toBe(0);
    });

    it('GET /api/inventory - should list all parts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
    });

    it('PUT /api/inventory/:id - should update stock quantity', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/inventory/${partId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 10 })
        .expect(200);

      expect(res.body.quantity).toBe(10);
    });

    it('GET /api/inventory/:id - should get part by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/inventory/${partId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(partId);
      expect(res.body.name).toBe('Engine Oil 5W-30');
      expect(res.body.quantity).toBe(10);
    });
  });

  // ─── GARAGE SETTINGS ─────────────────────────────────────

  describe('Garage Settings', () => {
    it('GET /api/garage-settings - should return garage config', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/garage-settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.name).toBe('Test Garage');
      expect(res.body.currency).toBe('TND');
      expect(res.body.taxRate).toBe(19);
    });

    it('PUT /api/garage-settings - should update settings', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/garage-settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phone: '+216 71 999 999',
          email: 'garage@opauto.tn',
          address: '123 Avenue Habib Bourguiba, Tunis',
        })
        .expect(200);

      expect(res.body.phone).toBe('+216 71 999 999');
      expect(res.body.email).toBe('garage@opauto.tn');
    });
  });

  // ─── AUTH GUARD ──────────────────────────────────────────

  describe('Auth Guard (all endpoints require token)', () => {
    it('GET /api/customers - should reject without token', async () => {
      await request(app.getHttpServer()).get('/api/customers').expect(401);
    });

    it('GET /api/cars - should reject without token', async () => {
      await request(app.getHttpServer()).get('/api/cars').expect(401);
    });

    it('GET /api/appointments - should reject without token', async () => {
      await request(app.getHttpServer()).get('/api/appointments').expect(401);
    });

    it('GET /api/employees - should reject without token', async () => {
      await request(app.getHttpServer()).get('/api/employees').expect(401);
    });

    it('GET /api/inventory - should reject without token', async () => {
      await request(app.getHttpServer()).get('/api/inventory').expect(401);
    });
  });

  // ─── DELETE (cleanup ordering) ───────────────────────────

  describe('Delete operations', () => {
    it('DELETE /api/appointments/:id - should delete appointment', async () => {
      await request(app.getHttpServer())
        .delete(`/api/appointments/${appointment2Id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify deleted
      const res = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.length).toBe(1);
    });

    it('DELETE /api/inventory/:id - should delete part', async () => {
      await request(app.getHttpServer())
        .delete(`/api/inventory/${partId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('DELETE /api/cars/:id - should delete car', async () => {
      // First delete the appointment referencing the car
      await request(app.getHttpServer())
        .delete(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/cars/${carId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('DELETE /api/customers/:id - should delete customer (after cars removed)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/cars/${car2Id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/customers/${customer2Id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('DELETE /api/employees/:id - should delete employee', async () => {
      await request(app.getHttpServer())
        .delete(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
