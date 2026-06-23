import { of } from 'rxjs';
import { AssistantController } from './assistant.controller';

const user = {
  id: 'user-1',
  garageId: 'garage-1',
  email: 'owner@example.com',
  role: 'OWNER',
};

function makeController() {
  const orchestrator = {
    run: jest.fn(() => of({ type: 'text', delta: 'ok' })),
  };
  const conversation = {
    getOrCreate: jest.fn().mockResolvedValue({ id: 'conversation-1' }),
  };
  const approvals = { decide: jest.fn() };
  const tools = {
    listForUser: jest.fn().mockReturnValue([{ name: 'create_invoice' }]),
  };
  const skills = { list: jest.fn().mockReturnValue([{ name: 'daily-briefing' }]) };
  const agents = { list: jest.fn().mockReturnValue([{ name: 'finance-agent' }]) };
  const modules = {
    getCatalog: jest.fn().mockReturnValue([
      { id: 'dashboard', price: 0 },
      { id: 'customers', price: 0 },
      { id: 'calendar', price: 0 },
      { id: 'invoicing', price: 29 },
      { id: 'inventory', price: 29 },
    ]),
    getActiveModules: jest.fn().mockResolvedValue([
      { moduleId: 'invoicing' },
      { moduleId: 'inventory' },
    ]),
  };

  const controller = new AssistantController(
    orchestrator as any,
    conversation as any,
    approvals as any,
    tools as any,
    skills as any,
    agents as any,
    modules as any,
  );

  return { controller, orchestrator, conversation, tools, modules };
}

describe('AssistantController', () => {
  it('builds registry context from active garage modules', async () => {
    const { controller, tools, modules } = makeController();

    const result = await controller.registry({ ...user, enabledModules: ['reports'] });

    expect(modules.getActiveModules).toHaveBeenCalledWith('garage-1');
    expect(result.tools).toEqual([{ name: 'create_invoice' }]);
    expect(tools.listForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        garageId: 'garage-1',
        role: 'OWNER',
        enabledModules: expect.arrayContaining([
          'dashboard',
          'customers',
          'calendar',
          'invoicing',
          'inventory',
          'reports',
        ]),
      }),
    );
  });

  it('uses active garage modules when starting chat runs', async () => {
    const { controller, orchestrator, conversation } = makeController();

    await controller.chat(user, {
      userMessage: 'Audit my inventory.',
      locale: 'en',
    } as any);

    expect(conversation.getOrCreate).toHaveBeenCalledWith(
      'garage-1',
      'user-1',
      undefined,
    );
    expect(orchestrator.run).toHaveBeenCalledWith(
      expect.objectContaining({
        enabledModules: expect.arrayContaining(['invoicing', 'inventory']),
      }),
      'conversation-1',
      'Audit my inventory.',
      undefined,
    );
  });
});
