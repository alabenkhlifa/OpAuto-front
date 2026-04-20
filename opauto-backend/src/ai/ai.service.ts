import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiChatDto,
  AiDiagnoseDto,
  AiEstimateDto,
  AiPredictChurnDto,
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
      warning?: string;
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

    // 2b — Load garage working hours
    const garage = await this.prisma.garage.findUnique({
      where: { id: garageId },
      select: { businessHours: true },
    });
    const businessHours = (garage?.businessHours as Record<string, any>) || null;
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    // 2c — Compute search window
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
      warning?: string;
    }> = [];
    const breakCandidates: typeof candidates = [];
    const durationMs = dto.estimatedDuration * 60 * 1000;

    const dayCount = Math.ceil(
      (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    for (let d = 0; d < dayCount && candidates.length < 20; d++) {
      const dayDate = new Date(windowStart);
      dayDate.setDate(dayDate.getDate() + d);

      // Read garage hours for this day of week
      const dayKey = dayKeys[dayDate.getDay()];
      const daySchedule = businessHours?.[dayKey] || businessHours?.[dayKey + 'day'];
      let openHour = 8, openMin = 0, closeHour = 18, closeMin = 0;
      let breakStartH = -1, breakStartM = 0, breakEndH = -1, breakEndM = 0;

      if (daySchedule) {
        // Skip closed days
        if (daySchedule.open === null || daySchedule.close === null) continue;
        if (daySchedule.isWorkingDay === false) continue;
        const openParts = (daySchedule.open || daySchedule.openTime || '08:00').split(':');
        const closeParts = (daySchedule.close || daySchedule.closeTime || '18:00').split(':');
        openHour = parseInt(openParts[0]); openMin = parseInt(openParts[1] || '0');
        closeHour = parseInt(closeParts[0]); closeMin = parseInt(closeParts[1] || '0');
        // Parse break if defined
        if (daySchedule.lunchBreak) {
          const bs = (daySchedule.lunchBreak.startTime || '').split(':');
          const be = (daySchedule.lunchBreak.endTime || '').split(':');
          if (bs.length === 2 && be.length === 2) {
            breakStartH = parseInt(bs[0]); breakStartM = parseInt(bs[1]);
            breakEndH = parseInt(be[0]); breakEndM = parseInt(be[1]);
          }
        }
      }

      const dayStart = new Date(dayDate);
      dayStart.setHours(openHour, openMin, 0, 0);
      const dayEnd = new Date(dayDate);
      dayEnd.setHours(closeHour, closeMin, 0, 0);

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

        // Build blocked intervals: existing appointments + lunch break
        const blocked: Array<{ start: Date; end: Date }> = empAppts.map(a => ({
          start: new Date(a.startTime),
          end: new Date(a.endTime),
        }));
        if (breakStartH >= 0) {
          const breakStart = new Date(dayDate);
          breakStart.setHours(breakStartH, breakStartM, 0, 0);
          const breakEnd = new Date(dayDate);
          breakEnd.setHours(breakEndH, breakEndM, 0, 0);
          blocked.push({ start: breakStart, end: breakEnd });
        }
        blocked.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Build free windows from gaps between blocked intervals
        const freeWindows: Array<{ from: Date; to: Date }> = [];
        let cursor = effectiveDayStart;
        for (const b of blocked) {
          if (b.start > cursor) {
            freeWindows.push({ from: new Date(cursor), to: new Date(b.start) });
          }
          if (b.end > cursor) cursor = b.end;
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

        // Also generate break-overlap slots as fallback (only appointment conflicts blocked, not break)
        if (breakStartH >= 0) {
          const apptOnly: Array<{ start: Date; end: Date }> = empAppts.map(a => ({
            start: new Date(a.startTime), end: new Date(a.endTime),
          }));
          apptOnly.sort((a, b) => a.start.getTime() - b.start.getTime());
          const breakFreeWindows: Array<{ from: Date; to: Date }> = [];
          let bCursor = effectiveDayStart;
          for (const b of apptOnly) {
            if (b.start > bCursor) breakFreeWindows.push({ from: new Date(bCursor), to: new Date(b.start) });
            if (b.end > bCursor) bCursor = b.end;
          }
          if (bCursor < dayEnd) breakFreeWindows.push({ from: new Date(bCursor), to: new Date(dayEnd) });

          const breakStartTime = new Date(dayDate);
          breakStartTime.setHours(breakStartH, breakStartM, 0, 0);
          const breakEndTime = new Date(dayDate);
          breakEndTime.setHours(breakEndH, breakEndM, 0, 0);

          for (const w of breakFreeWindows) {
            let slotS = new Date(w.from);
            const m = slotS.getMinutes();
            if (m % 30 !== 0) slotS.setMinutes(Math.ceil(m / 30) * 30, 0, 0);
            else slotS.setSeconds(0, 0);
            while (slotS.getTime() + durationMs <= w.to.getTime() && breakCandidates.length < 10) {
              const slotE = new Date(slotS.getTime() + durationMs);
              // Only include if it actually overlaps the break
              if (slotS < breakEndTime && slotE > breakStartTime) {
                breakCandidates.push({
                  start: slotS.toISOString(), end: slotE.toISOString(),
                  mechanicId: emp.id, mechanicName: `${emp.firstName} ${emp.lastName}`,
                  warning: 'lunch_break',
                });
              }
              slotS = new Date(slotS.getTime() + 30 * 60 * 1000);
            }
          }
        }
      }
    }

    // If no normal candidates, use break-overlap candidates as fallback
    if (candidates.length === 0 && breakCandidates.length > 0) {
      candidates.push(...breakCandidates);
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
    // Build skill rating map
    const ratingMap = new Map<string, number>();
    for (const emp of employees) {
      ratingMap.set(emp.id, (emp as any).skillRating || (emp.hourlyRate ? Math.min(emp.hourlyRate / 10, 5) : 3));
    }

    // Sort diverse candidates: skilled first, then by rating descending, then workload ascending
    diverseCandidates.sort((a, b) => {
      const aSkilled = skilledEmployeeIds.has(a.mechanicId) ? 0 : 1;
      const bSkilled = skilledEmployeeIds.has(b.mechanicId) ? 0 : 1;
      if (aSkilled !== bSkilled) return aSkilled - bSkilled;
      const rA = ratingMap.get(a.mechanicId) || 0;
      const rB = ratingMap.get(b.mechanicId) || 0;
      if (rA !== rB) return rB - rA; // higher rating first
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
  const rating = ratingMap.get(c.mechanicId) || 0;
  const warn = c.warning ? ' | ⚠️ DURING LUNCH BREAK' : '';
  return `${i}: ${c.mechanicName} | ${c.start} - ${c.end} | Skills: ${emp?.skills?.join(', ') || 'general'} | Rating: ${rating}/5 | Workload: ${workload} appointments this week${warn}`;
}).join('\n')}

Consider: (1) Mechanic specialty match, (2) Skill rating (higher is better), (3) Workload balance (prefer less busy), (4) Time convenience (morning preferred).

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

  async predictChurn(
    garageId: string,
    dto: AiPredictChurnDto = {},
  ): Promise<{
    predictions: Array<{
      customerId: string;
      customerName: string;
      churnRisk: number;
      riskLevel: 'low' | 'medium' | 'high';
      factors: string[];
      suggestedAction: string;
    }>;
    provider: string;
  }> {
    const where: any = { garageId };
    if (dto.customerId) where.id = dto.customerId;

    const customers = await this.prisma.customer.findMany({
      where,
      include: {
        appointments: { select: { startTime: true, status: true } },
        invoices: { select: { createdAt: true, paidAt: true, total: true } },
      },
    });

    const now = new Date();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    const scored = customers
      .map((c) => this.scoreCustomerChurn(c, now, MS_PER_DAY, dto.language || 'en'))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Sort by risk desc
    scored.sort((a, b) => b.churnRisk - a.churnRisk);

    // Get suggestedAction for at-risk (medium+high) ones via LLM if keys available, else templated
    const atRisk = scored.filter((s) => s.riskLevel !== 'low');
    let suggestions = new Map<string, string>();
    let provider = 'template';

    if (atRisk.length > 0 && (this.anthropicKey || this.openaiKey || this.geminiKey || this.groqKey)) {
      try {
        const langMap: Record<string, string> = { en: 'English', fr: 'French', ar: 'Arabic' };
        const responseLang = langMap[dto.language || 'en'] || 'English';
        const top = atRisk.slice(0, 10);
        const prompt = `You are assisting a garage owner with customer retention. For each at-risk customer below, suggest ONE short, specific action (one sentence, written in ${responseLang}) the owner can take to re-engage them.

Customers:
${top.map((c, i) => `${i}: ${c.customerName} | risk=${c.riskLevel} | ${c.factors.join('; ')}`).join('\n')}

Respond ONLY with a JSON array, one object per customer in the same order, no other text.
CRITICAL: The "action" field MUST be written ENTIRELY in ${responseLang}.
[{"index": 0, "action": "..."}, ...]`;

        const aiResponse = await this.chat({
          messages: [{ role: 'user', content: prompt }],
          context: 'churn_retention',
        });
        const jsonMatch = aiResponse.message.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const picks = JSON.parse(jsonMatch[0]) as Array<{ index: number; action: string }>;
          for (const p of picks) {
            if (top[p.index]) suggestions.set(top[p.index].customerId, p.action);
          }
          provider = aiResponse.provider;
        }
      } catch (error) {
        this.logger.warn('Churn LLM narrative failed, falling back to template', error);
      }
    }

    const predictions = scored.map((s) => ({
      ...s,
      suggestedAction:
        suggestions.get(s.customerId) ||
        this.templatedChurnAction(s.riskLevel, dto.language || 'en'),
    }));

    return { predictions, provider };
  }

  private scoreCustomerChurn(
    customer: any,
    now: Date,
    msPerDay: number,
    language: string,
  ): {
    customerId: string;
    customerName: string;
    churnRisk: number;
    riskLevel: 'low' | 'medium' | 'high';
    factors: string[];
  } | null {
    // Derive last activity: max of completed appointments startTime + paid invoice paidAt
    const activityDates: number[] = [];
    for (const appt of customer.appointments || []) {
      if (appt.status === 'COMPLETED' && appt.startTime) {
        activityDates.push(new Date(appt.startTime).getTime());
      }
    }
    for (const inv of customer.invoices || []) {
      if (inv.paidAt) activityDates.push(new Date(inv.paidAt).getTime());
    }

    // Use the max of stored visitCount and actual completed activities — stored
    // visitCount is only seeded, never incremented by the app, so it drifts.
    const derivedVisitCount = activityDates.length;
    const visitCount = Math.max(customer.visitCount || 0, derivedVisitCount);
    if (visitCount < 2) return null; // insufficient history

    const lastActivityMs = activityDates.length > 0 ? Math.max(...activityDates) : null;
    if (lastActivityMs === null) return null; // can't score without any activity

    const daysSince = Math.floor((now.getTime() - lastActivityMs) / msPerDay);
    const customerAgeDays = Math.max(
      1,
      Math.floor((now.getTime() - new Date(customer.createdAt).getTime()) / msPerDay),
    );
    const avgInterval = Math.max(30, Math.floor(customerAgeDays / visitCount));
    const ratio = daysSince / avgInterval;

    let score: number;
    if (ratio < 1.0) score = 0.0;
    else if (ratio < 2.0) score = 0.3;
    else if (ratio < 3.0) score = 0.6;
    else score = 0.9;

    const factors: string[] = [];
    factors.push(this.t(language, 'daysSince', { days: daysSince, typical: avgInterval }));

    // Future appointment is a strong anti-churn signal
    const futureAppts = (customer.appointments || []).filter((a: any) => {
      const t = a.startTime ? new Date(a.startTime).getTime() : 0;
      return t > now.getTime() && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW';
    }).length;
    if (futureAppts > 0) {
      score *= 0.3;
      factors.push(this.t(language, 'futureAppts', { count: futureAppts }));
    }

    if (customer.status === 'INACTIVE') {
      score = Math.max(score, 0.7);
      factors.push(this.t(language, 'markedInactive'));
    }

    score = Math.min(1, Math.max(0, score));
    const riskLevel: 'low' | 'medium' | 'high' =
      score < 0.3 ? 'low' : score < 0.6 ? 'medium' : 'high';

    return {
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      churnRisk: Math.round(score * 100) / 100,
      riskLevel,
      factors,
    };
  }

  private t(lang: string, key: string, params: Record<string, any> = {}): string {
    const dict: Record<string, Record<string, string>> = {
      en: {
        daysSince: `${params['days']} days since last visit (typical: ${params['typical']})`,
        futureAppts: `Has ${params['count']} upcoming appointment(s)`,
        markedInactive: 'Marked inactive',
      },
      fr: {
        daysSince: `${params['days']} jours depuis la dernière visite (typique: ${params['typical']})`,
        futureAppts: `A ${params['count']} rendez-vous à venir`,
        markedInactive: 'Marqué inactif',
      },
      ar: {
        daysSince: `${params['days']} يوم منذ آخر زيارة (المعتاد: ${params['typical']})`,
        futureAppts: `لديه ${params['count']} موعد قادم`,
        markedInactive: 'تم تمييزه كغير نشط',
      },
    };
    return dict[lang]?.[key] || dict['en'][key] || key;
  }

  private templatedChurnAction(
    level: 'low' | 'medium' | 'high',
    lang: string,
  ): string {
    const dict: Record<string, Record<string, string>> = {
      en: {
        low: 'No action needed — customer is on schedule.',
        medium: 'Send a service reminder (SMS or email).',
        high: 'Call personally and offer a maintenance incentive.',
      },
      fr: {
        low: 'Aucune action nécessaire — le client est dans les temps.',
        medium: 'Envoyer un rappel de service (SMS ou e-mail).',
        high: 'Appeler personnellement et offrir une incitation d\'entretien.',
      },
      ar: {
        low: 'لا إجراء مطلوب — العميل في الموعد.',
        medium: 'أرسل تذكيرًا بالخدمة (رسالة نصية أو بريد).',
        high: 'اتصل شخصيًا واعرض حافزًا للصيانة.',
      },
    };
    return dict[lang]?.[level] || dict['en'][level];
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
