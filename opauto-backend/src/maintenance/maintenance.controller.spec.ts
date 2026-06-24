import { MaintenanceController } from './maintenance.controller';

describe('MaintenanceController approval email delivery', () => {
  const job = {
    id: 'job-1',
    title: 'Maintenance job',
    car: {
      year: 2020,
      make: 'TestMake',
      model: 'WorkflowCar',
      licensePlate: 'AI-MNT-034633',
      customer: {
        firstName: 'AI',
        lastName: 'Customer',
        email: 'ala.khllifa+Job1@gmail.com',
        phone: '+21600000000',
      },
    },
    parts: [
      {
        description: 'Cabin air filter',
        quantity: 1,
        unitPrice: 18,
        tvaRate: 0,
        discountPct: 0,
      },
    ],
  };

  function buildController(overrides: { emailSend?: jest.Mock } = {}) {
    const service = {
      findOne: jest.fn().mockResolvedValue(job),
      createApprovalRequest: jest.fn().mockResolvedValue({
        id: 'approval-1',
        requestedAmount: 122.57,
        summary: 'Please approve the requested work.',
        status: 'PENDING',
      }),
    };
    const tokens = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };
    const email = {
      send:
        overrides.emailSend ??
        jest.fn().mockResolvedValue({
          providerMessageId: 'msg-1',
          status: 'queued',
        }),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'PUBLIC_BASE_URL' ? 'https://opauto.test' : undefined,
      ),
    };
    const controller = new MaintenanceController(
      service as any,
      tokens as any,
      email as any,
      config as any,
    );
    return { controller, service, tokens, email, config };
  }

  it('sends the public approval link when email is selected', async () => {
    const { controller, service, email } = buildController();

    const result = await controller.createApprovalRequest(
      'job-1',
      'garage-1',
      'user-1',
      'owner@example.com',
      {
        description: 'Please approve the requested work.',
        estimatedPrice: 122.57,
        sentVia: ['email'],
      },
    );

    expect(service.createApprovalRequest).toHaveBeenCalledWith(
      'job-1',
      'garage-1',
      'user-1',
      expect.objectContaining({
        customerEmail: 'ala.khllifa+Job1@gmail.com',
        customerName: 'AI Customer',
        sendVia: 'email',
      }),
    );
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ala.khllifa+Job1@gmail.com',
        subject:
          'Maintenance approval request for 2020 TestMake WorkflowCar (AI-MNT-034633)',
        replyTo: 'owner@example.com',
        html: expect.stringContaining(
          'https://opauto.test/public/job-approvals/signed-token',
        ),
        text: expect.stringContaining(
          'https://opauto.test/public/job-approvals/signed-token',
        ),
      }),
    );
    expect(result).toMatchObject({
      publicToken: 'signed-token',
      publicUrl: 'https://opauto.test/public/job-approvals/signed-token',
      emailDelivery: {
        attempted: true,
        status: 'queued',
        to: 'ala.khllifa+Job1@gmail.com',
        providerMessageId: 'msg-1',
      },
    });
  });

  it('returns a failed delivery status without rolling back the approval', async () => {
    const emailSend = jest.fn().mockRejectedValue(new Error('Resend rejected'));
    const { controller, service } = buildController({ emailSend });

    const result = await controller.createApprovalRequest(
      'job-1',
      'garage-1',
      'user-1',
      'owner@example.com',
      {
        description: 'Please approve the requested work.',
        estimatedPrice: 122.57,
        sendVia: 'email',
      },
    );

    expect(service.createApprovalRequest).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'approval-1',
      emailDelivery: {
        attempted: true,
        status: 'failed',
        to: 'ala.khllifa+Job1@gmail.com',
        error: 'Resend rejected',
      },
    });
  });
});
