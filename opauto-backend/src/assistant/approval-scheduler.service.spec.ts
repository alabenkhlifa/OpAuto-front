import { Logger } from '@nestjs/common';
import { ApprovalSchedulerService } from './approval-scheduler.service';
import { ApprovalService } from './approval.service';

describe('ApprovalSchedulerService', () => {
  let approvals: { expireOverdue: jest.Mock };
  let service: ApprovalSchedulerService;

  beforeEach(() => {
    approvals = { expireOverdue: jest.fn() };
    service = new ApprovalSchedulerService(approvals as unknown as ApprovalService);
  });

  it('calls approvals.expireOverdue once per run', async () => {
    approvals.expireOverdue.mockResolvedValue(0);

    await service.runExpiry();

    expect(approvals.expireOverdue).toHaveBeenCalledTimes(1);
  });

  it('logs the count when one or more approvals expired', async () => {
    approvals.expireOverdue.mockResolvedValue(3);
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await service.runExpiry();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('3'));
    logSpy.mockRestore();
  });

  it('does not log when zero approvals expired (avoids cron-noise)', async () => {
    approvals.expireOverdue.mockResolvedValue(0);
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await service.runExpiry();

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('swallows errors and logs them so the cron stays alive', async () => {
    approvals.expireOverdue.mockRejectedValue(new Error('db down'));
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(service.runExpiry()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('db down'));
    errorSpy.mockRestore();
  });
});
