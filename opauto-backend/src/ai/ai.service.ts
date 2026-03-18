import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiChatDto, AiDiagnoseDto, AiEstimateDto } from './dto/chat.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropicKey: string | undefined;
  private openaiKey: string | undefined;

  constructor(private configService: ConfigService) {
    this.anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.openaiKey = this.configService.get<string>('OPENAI_API_KEY');
  }

  async chat(dto: AiChatDto): Promise<{ message: string; provider: string }> {
    if (this.anthropicKey) {
      return this.chatWithClaude(dto);
    }
    if (this.openaiKey) {
      return this.chatWithOpenAI(dto);
    }
    return this.mockChat(dto);
  }

  async diagnose(
    dto: AiDiagnoseDto,
  ): Promise<{
    diagnosis: string;
    recommendations: string[];
    urgency: string;
    provider: string;
  }> {
    const chatDto: AiChatDto = {
      messages: [
        {
          role: 'user',
          content: `As an automotive diagnostic expert, analyze these symptoms for a ${dto.carYear || ''} ${dto.carMake || ''} ${dto.carModel || ''}: ${dto.symptoms}. Provide diagnosis, recommendations, and urgency level.`,
        },
      ],
      context: 'automotive_diagnosis',
    };

    const response = await this.chat(chatDto);
    return {
      diagnosis: response.message,
      recommendations: ['Schedule inspection', 'Check related components'],
      urgency: 'medium',
      provider: response.provider,
    };
  }

  async estimate(
    dto: AiEstimateDto,
  ): Promise<{
    estimatedCost: { min: number; max: number };
    estimatedHours: number;
    breakdown: string[];
    provider: string;
  }> {
    const estimates: Record<
      string,
      { min: number; max: number; hours: number }
    > = {
      'oil-change': { min: 80, max: 150, hours: 1 },
      'brake-service': { min: 200, max: 500, hours: 3 },
      'engine-diagnostics': { min: 100, max: 300, hours: 2 },
      transmission: { min: 500, max: 1500, hours: 6 },
      'tire-replacement': { min: 200, max: 600, hours: 1 },
      electrical: { min: 150, max: 400, hours: 2 },
      bodywork: { min: 300, max: 2000, hours: 8 },
    };

    const est = estimates[dto.serviceType] || { min: 100, max: 500, hours: 2 };
    return {
      estimatedCost: { min: est.min, max: est.max },
      estimatedHours: est.hours,
      breakdown: [
        `Labor: ${est.hours}h`,
        `Parts: estimated`,
        `Service: ${dto.serviceType}`,
      ],
      provider: 'mock',
    };
  }

  private async chatWithClaude(
    dto: AiChatDto,
  ): Promise<{ message: string; provider: string }> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system:
            'You are an AI assistant for OpAuto, a garage management ERP. Help with automotive diagnostics, scheduling, and business insights.',
          messages: dto.messages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      return {
        message: data.content?.[0]?.text || 'No response from AI',
        provider: 'claude',
      };
    } catch (error) {
      this.logger.error('Claude API error:', error);
      return this.mockChat(dto);
    }
  }

  private async chatWithOpenAI(
    dto: AiChatDto,
  ): Promise<{ message: string; provider: string }> {
    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are an AI assistant for OpAuto, a garage management ERP.',
              },
              ...dto.messages,
            ],
            max_tokens: 1024,
          }),
        },
      );

      const data = await response.json();
      return {
        message:
          data.choices?.[0]?.message?.content || 'No response from AI',
        provider: 'openai',
      };
    } catch (error) {
      this.logger.error('OpenAI API error:', error);
      return this.mockChat(dto);
    }
  }

  private mockChat(dto: AiChatDto): { message: string; provider: string } {
    const lastMessage =
      dto.messages[dto.messages.length - 1]?.content || '';

    if (lastMessage.toLowerCase().includes('diagnos')) {
      return {
        message:
          'Based on the symptoms described, this could indicate an issue with the brake system. I recommend:\n1. Inspect brake pads and rotors for wear\n2. Check brake fluid level and condition\n3. Test ABS sensor functionality\n\nUrgency: Medium - Schedule service within the next week.',
        provider: 'mock',
      };
    }

    if (
      lastMessage.toLowerCase().includes('schedule') ||
      lastMessage.toLowerCase().includes('slot')
    ) {
      return {
        message:
          'Based on current workload analysis:\n- Best available slots: Tomorrow 10:00 AM, Thursday 2:00 PM\n- Estimated service duration: 2-3 hours\n- Recommended mechanic: Khalil (brake specialist)\n\nShall I book one of these slots?',
        provider: 'mock',
      };
    }

    return {
      message:
        'I can help you with automotive diagnostics, scheduling optimization, and business insights. What would you like to know?',
      provider: 'mock',
    };
  }
}
