import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiChatDto,
  AiDiagnoseDto,
  AiEstimateDto,
  AiSuggestScheduleDto,
} from './dto/chat.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropicKey: string | undefined;
  private openaiKey: string | undefined;
  private geminiKey: string | undefined;
  private groqKey: string | undefined;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.groqKey = this.configService.get<string>('GROQ_API_KEY');
  }

  async chat(dto: AiChatDto): Promise<{ message: string; provider: string }> {
    if (this.anthropicKey) {
      return this.chatWithClaude(dto);
    }
    if (this.openaiKey) {
      return this.chatWithOpenAI(dto);
    }
    if (this.geminiKey) {
      return this.chatWithGemini(dto);
    }
    if (this.groqKey) {
      return this.chatWithGroq(dto);
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

  async suggestSchedule(
    garageId: string,
    dto: AiSuggestScheduleDto,
  ): Promise<{
    suggestedSlots: Array<{
      start: string;
      end: string;
      mechanicId: string;
      mechanicName: string;
      score: number;
      reason: string;
    }>;
    provider: string;
  }> {
    // 2a — Query employees with matching skills
    // Map appointment types to the skills employees actually have in the DB
    const skillMap: Record<string, string[]> = {
      'oil-change': ['oil_change', 'engine_repair'],
      'brake-repair': ['brakes', 'suspension', 'brake_repair'],
      'inspection': ['diagnostics', 'engine_repair', 'ecu_diagnostics'],
      'transmission': ['engine_repair', 'diagnostics'],
      'engine': ['engine_repair', 'diagnostics', 'ecu_diagnostics'],
      'tires': ['tire_change', 'balancing', 'alignment'],
    };

    const relevantSkills = skillMap[dto.appointmentType] || [
      dto.appointmentType,
      dto.appointmentType.replace(/-/g, '_'),
    ];

    // Find employees who have ANY of the relevant skills
    let employees = await this.prisma.employee.findMany({
      where: {
        garageId,
        status: 'ACTIVE',
        skills: { hasSome: relevantSkills },
      },
    });

    // Fallback to all active technicians if no skill match
    if (employees.length === 0) {
      employees = await this.prisma.employee.findMany({
        where: {
          garageId,
          status: 'ACTIVE',
          role: { in: ['MECHANIC', 'ELECTRICIAN', 'BODYWORK_SPECIALIST', 'TIRE_SPECIALIST'] },
        },
      });
    }
    if (employees.length === 0) return { suggestedSlots: [], provider: 'none' };

    // Track which employees matched by skill vs fallback
    const skilledEmployeeIds = new Set(
      employees
        .filter((e) => e.skills?.some((s) => relevantSkills.includes(s)))
        .map((e) => e.id),
    );

    // 2b — Compute search window
    const now = new Date();
    let windowStart: Date;
    let windowEnd: Date;
    if (dto.preferredDate) {
      const preferred = new Date(dto.preferredDate);
      windowStart = new Date(preferred);
      windowStart.setDate(windowStart.getDate() - 3);
      windowEnd = new Date(preferred);
      windowEnd.setDate(windowEnd.getDate() + 3);
    } else {
      windowStart = new Date(now);
      windowEnd = new Date(now);
      windowEnd.setDate(windowEnd.getDate() + 7);
    }
    if (windowStart < now) windowStart = now;

    // 2c — Query existing non-cancelled appointments in window
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        garageId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startTime: { gte: windowStart, lte: windowEnd },
      },
      select: { employeeId: true, startTime: true, endTime: true },
    });

    // 2d — Compute free slots per employee
    const candidates: Array<{
      start: string;
      end: string;
      mechanicId: string;
      mechanicName: string;
    }> = [];
    const durationMs = dto.estimatedDuration * 60 * 1000;

    const dayCount = Math.ceil(
      (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    for (let d = 0; d < dayCount && candidates.length < 20; d++) {
      const dayDate = new Date(windowStart);
      dayDate.setDate(dayDate.getDate() + d);
      const dayStart = new Date(dayDate);
      dayStart.setHours(8, 0, 0, 0);
      const dayEnd = new Date(dayDate);
      dayEnd.setHours(18, 0, 0, 0);

      // Skip if day is already past
      if (dayEnd <= now) continue;

      const effectiveDayStart = dayStart < now ? now : dayStart;

      for (const emp of employees) {
        if (candidates.length >= 20) break;

        // Get this employee's appointments for this day, sorted
        const empAppts = existingAppointments
          .filter((a) => {
            const aStart = new Date(a.startTime);
            return (
              a.employeeId === emp.id &&
              aStart >= dayStart &&
              aStart < dayEnd
            );
          })
          .sort(
            (a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          );

        // Build free windows
        const freeWindows: Array<{ from: Date; to: Date }> = [];
        let cursor = effectiveDayStart;
        for (const appt of empAppts) {
          const aStart = new Date(appt.startTime);
          const aEnd = new Date(appt.endTime);
          if (aStart > cursor) {
            freeWindows.push({ from: new Date(cursor), to: new Date(aStart) });
          }
          if (aEnd > cursor) cursor = aEnd;
        }
        if (cursor < dayEnd) {
          freeWindows.push({ from: new Date(cursor), to: new Date(dayEnd) });
        }

        // Extract candidate slots from free windows
        for (const w of freeWindows) {
          if (candidates.length >= 20) break;

          // Snap start to next 30-minute boundary
          let slotStart = new Date(w.from);
          const mins = slotStart.getMinutes();
          if (mins % 30 !== 0) {
            slotStart.setMinutes(Math.ceil(mins / 30) * 30, 0, 0);
          } else {
            slotStart.setSeconds(0, 0);
          }

          while (
            slotStart.getTime() + durationMs <= w.to.getTime() &&
            candidates.length < 20
          ) {
            const slotEnd = new Date(slotStart.getTime() + durationMs);
            candidates.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              mechanicId: emp.id,
              mechanicName: `${emp.firstName} ${emp.lastName}`,
            });
            // Move to next 30-minute boundary
            slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
          }
        }
      }
    }

    if (candidates.length === 0) return { suggestedSlots: [], provider: 'mock' };

    // 2e — Build workload map
    const workloadMap = new Map<string, number>();
    for (const appt of existingAppointments) {
      const count = workloadMap.get(appt.employeeId) || 0;
      workloadMap.set(appt.employeeId, count + 1);
    }

    // Deduplicate: pick the best (earliest) slot per mechanic first, then allow repeats
    const seenMechanics = new Set<string>();
    const diverseCandidates: typeof candidates = [];
    const remainingCandidates: typeof candidates = [];
    for (const c of candidates) {
      if (!seenMechanics.has(c.mechanicId)) {
        seenMechanics.add(c.mechanicId);
        diverseCandidates.push(c);
      } else {
        remainingCandidates.push(c);
      }
    }
    // Sort diverse candidates: skilled first, then by workload ascending
    diverseCandidates.sort((a, b) => {
      const aSkilled = skilledEmployeeIds.has(a.mechanicId) ? 0 : 1;
      const bSkilled = skilledEmployeeIds.has(b.mechanicId) ? 0 : 1;
      if (aSkilled !== bSkilled) return aSkilled - bSkilled;
      const wA = workloadMap.get(a.mechanicId) || 0;
      const wB = workloadMap.get(b.mechanicId) || 0;
      return wA - wB;
    });
    const rankedCandidates = [...diverseCandidates, ...remainingCandidates];

    // 2f — AI ranking (if API key available), else heuristic
    if (this.anthropicKey || this.openaiKey || this.geminiKey || this.groqKey) {
      try {
        const top6 = rankedCandidates.slice(0, 6);
        const langMap: Record<string, string> = { en: 'English', fr: 'French', ar: 'Arabic' };
        const responseLang = langMap[dto.language || 'en'] || 'English';

        const prompt = `You are a scheduling optimizer for an automotive garage. Pick the TOP 3 slots from the candidates below and explain why each is optimal.

Service requested: ${dto.appointmentType} (${dto.estimatedDuration} min)

Candidates:
${top6.map((c, i) => {
  const emp = employees.find((e) => e.id === c.mechanicId);
  const workload = workloadMap.get(c.mechanicId) || 0;
  return `${i}: ${c.mechanicName} | ${c.start} - ${c.end} | Skills: ${emp?.skills?.join(', ') || 'general'} | Workload: ${workload} appointments this week`;
}).join('\n')}

Consider: (1) Mechanic specialty match, (2) Workload balance, (3) Time convenience (morning preferred).

Respond ONLY with a JSON array, no other text.
CRITICAL: The "reason" field MUST be written ENTIRELY in ${responseLang}. Do NOT mix languages. Do NOT use words from any other language.
[{"index": 0, "score": 0.95, "reason": "reason in ${responseLang} only"}, ...]`;

        const aiResponse = await this.chat({
          messages: [{ role: 'user', content: prompt }],
          context: 'scheduling',
        });

        // Parse AI response
        const jsonMatch = aiResponse.message.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const picks = JSON.parse(jsonMatch[0]) as Array<{
            index: number;
            score: number;
            reason: string;
          }>;
          const top3 = picks.slice(0, 3).map((pick) => ({
            ...top6[pick.index],
            score: pick.score,
            reason: pick.reason,
          }));
          return {
            suggestedSlots: top3,
            provider: aiResponse.provider,
          };
        }
      } catch (error) {
        this.logger.warn('AI ranking failed, falling back to heuristic', error);
      }
    }

    // Heuristic fallback
    const scores = [0.95, 0.75, 0.55];
    const top3 = rankedCandidates.slice(0, 3).map((c, i) => {
      const emp = employees.find((e) => e.id === c.mechanicId);
      const hasSkill = skilledEmployeeIds.has(c.mechanicId);
      const workload = workloadMap.get(c.mechanicId) || 0;
      const lang = dto.language || 'en';
      let reason: string;
      if (lang === 'fr') {
        reason = hasSkill
          ? `Spécialité : ${dto.appointmentType} (${workload} rendez-vous cette semaine)`
          : `Créneau disponible avec charge équilibrée (${workload} rendez-vous cette semaine)`;
      } else if (lang === 'ar') {
        reason = hasSkill
          ? `تخصص: ${dto.appointmentType} (${workload} مواعيد هذا الأسبوع)`
          : `موعد متاح مع توزيع متوازن (${workload} مواعيد هذا الأسبوع)`;
      } else {
        reason = hasSkill
          ? `Specialty match: ${dto.appointmentType} (${workload} appointments this week)`
          : `Available slot with balanced workload (${workload} appointments this week)`;
      }
      return { ...c, score: scores[i], reason };
    });

    return {
      suggestedSlots: top3,
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

      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP ${response.status}`;
        this.logger.warn(`Claude API returned ${response.status}: ${errorMsg}`);
        return this.mockChat(dto);
      }

      return {
        message: data.content?.[0]?.text || 'No response from AI',
        provider: 'claude',
      };
    } catch (error) {
      this.logger.warn('Claude API unreachable:', error);
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

      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP ${response.status}`;
        this.logger.warn(`OpenAI API returned ${response.status}: ${errorMsg}`);
        return this.mockChat(dto);
      }

      return {
        message:
          data.choices?.[0]?.message?.content || 'No response from AI',
        provider: 'openai',
      };
    } catch (error) {
      this.logger.warn('OpenAI API unreachable:', error);
      return this.mockChat(dto);
    }
  }

  private async chatWithGemini(
    dto: AiChatDto,
  ): Promise<{ message: string; provider: string }> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: 'You are an AI assistant for OpAuto, a garage management ERP. Help with automotive diagnostics, scheduling, and business insights.',
                },
              ],
            },
            contents: dto.messages.map((m) => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              maxOutputTokens: 1024,
            },
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP ${response.status}`;
        this.logger.warn(`Gemini API returned ${response.status}: ${errorMsg}`);
        return this.mockChat(dto);
      }

      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        'No response from AI';
      return { message: text, provider: 'gemini' };
    } catch (error) {
      this.logger.warn('Gemini API unreachable:', error);
      return this.mockChat(dto);
    }
  }

  private async chatWithGroq(
    dto: AiChatDto,
  ): Promise<{ message: string; provider: string }> {
    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content:
                  'You are an AI assistant for OpAuto, a garage management ERP. Help with automotive diagnostics, scheduling, and business insights.',
              },
              ...dto.messages,
            ],
            max_tokens: 1024,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP ${response.status}`;
        this.logger.warn(`Groq API returned ${response.status}: ${errorMsg}`);
        return this.mockChat(dto);
      }

      return {
        message:
          data.choices?.[0]?.message?.content || 'No response from AI',
        provider: 'groq',
      };
    } catch (error) {
      this.logger.warn('Groq API unreachable:', error);
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
