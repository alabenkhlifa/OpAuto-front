import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiActionKind, DiscountKind } from '@prisma/client';
import {
  AiChatDto,
  AiDiagnoseDto,
  AiEstimateDto,
  AiPredictChurnDto,
  AiPredictMaintenanceDto,
  AiSuggestScheduleDto,
} from './dto/chat.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface ChurnActionDraft {
  kind: AiActionKind;
  messageBody: string;
  discountKind?: DiscountKind;
  discountValue?: number;
  expiresAtDays?: number;
  churnRiskSnapshot: number;
  factorsSnapshot: string[];
}

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

    // Per-employee cap so the first employee in the list can't gobble all 20
    // global slots before later employees ever get a turn. Without this, a
    // less-busy mechanic appears unrankable because they have no candidates.
    const perEmpCap = Math.max(2, Math.ceil(20 / Math.max(1, employees.length)));
    const empSlotCount = new Map<string, number>();

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
            candidates.length < 20 &&
            (empSlotCount.get(emp.id) || 0) < perEmpCap
          ) {
            const slotEnd = new Date(slotStart.getTime() + durationMs);
            candidates.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              mechanicId: emp.id,
              mechanicName: `${emp.firstName} ${emp.lastName}`,
            });
            empSlotCount.set(emp.id, (empSlotCount.get(emp.id) || 0) + 1);
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

  // ── Churn Action Drafting (executable recommendations) ─────────

  async proposeAction(garageId: string, customerId: string): Promise<ChurnActionDraft> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, garageId },
      include: {
        appointments: { select: { startTime: true, status: true } },
        invoices: { select: { createdAt: true, paidAt: true, total: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const now = new Date();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const scored = this.scoreCustomerChurn(customer, now, MS_PER_DAY, 'fr');
    const risk = scored?.churnRisk ?? 0;
    const factors = scored?.factors ?? [];
    const level: 'low' | 'medium' | 'high' = scored?.riskLevel ?? 'low';

    const llmDraft = await this.draftWithLlm(customer, level, factors);
    const draft = llmDraft ?? this.templatedActionDraft(customer, level);

    return {
      ...draft,
      churnRiskSnapshot: risk,
      factorsSnapshot: factors,
    };
  }

  private async draftWithLlm(
    customer: { firstName: string; lastName: string; loyaltyTier: string | null },
    level: 'low' | 'medium' | 'high',
    factors: string[],
  ): Promise<Omit<ChurnActionDraft, 'churnRiskSnapshot' | 'factorsSnapshot'> | null> {
    if (!this.anthropicKey && !this.openaiKey && !this.geminiKey && !this.groqKey) return null;

    const fullName = `${customer.firstName} ${customer.lastName}`.trim();
    const prompt = `You draft short win-back SMS copy (IN FRENCH) for a Tunisian car garage.
Customer: ${fullName} | loyaltyTier=${customer.loyaltyTier ?? 'none'} | riskLevel=${level}
Churn factors: ${factors.join('; ') || 'none'}

Rules:
- Output ONLY a single JSON object, no prose before/after.
- SMS body MUST be in French, under 320 characters, friendly, first-person plural ("nous"), no emoji, no links.
- If riskLevel is "medium": kind="REMINDER_SMS", no discount. Just a warm reminder inviting them back.
- If riskLevel is "high": kind="DISCOUNT_SMS", include a discount. Choose EITHER percent (5-20) OR a fixed TND amount (20-100), whichever feels more appropriate for the factors. expiresAtDays between 7 and 30.
- Address the customer by first name.
- Mention the discount value + expiry in the SMS body when applicable (e.g. "15% valable jusqu'au DD/MM/YYYY").

JSON schema:
{
  "kind": "REMINDER_SMS" | "DISCOUNT_SMS",
  "messageBody": "<French SMS text>",
  "discountKind": "PERCENT" | "AMOUNT" | null,
  "discountValue": <number> | null,
  "expiresAtDays": <number> | null
}`;

    try {
      const res = await this.chat({ messages: [{ role: 'user', content: prompt }], context: 'churn_action_draft' });
      const match = res.message.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]) as {
        kind: string;
        messageBody: string;
        discountKind: string | null;
        discountValue: number | null;
        expiresAtDays: number | null;
      };
      const kind: AiActionKind = parsed.kind === 'DISCOUNT_SMS' ? 'DISCOUNT_SMS' : 'REMINDER_SMS';
      const draft: Omit<ChurnActionDraft, 'churnRiskSnapshot' | 'factorsSnapshot'> = {
        kind,
        messageBody: parsed.messageBody.trim(),
      };
      if (kind === 'DISCOUNT_SMS' && parsed.discountKind && parsed.discountValue) {
        draft.discountKind = parsed.discountKind === 'AMOUNT' ? 'AMOUNT' : 'PERCENT';
        draft.discountValue = parsed.discountValue;
        draft.expiresAtDays = parsed.expiresAtDays ?? 14;
      }
      return draft;
    } catch (err) {
      this.logger.warn(`proposeAction LLM failed, falling back to template: ${err}`);
      return null;
    }
  }

  private templatedActionDraft(
    customer: { firstName: string },
    level: 'low' | 'medium' | 'high',
  ): Omit<ChurnActionDraft, 'churnRiskSnapshot' | 'factorsSnapshot'> {
    const first = customer.firstName.trim();
    if (level === 'high') {
      const days = 14;
      const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const dd = String(expiry.getDate()).padStart(2, '0');
      const mm = String(expiry.getMonth() + 1).padStart(2, '0');
      const yyyy = String(expiry.getFullYear());
      return {
        kind: 'DISCOUNT_SMS',
        messageBody: `Bonjour ${first}, vous nous manquez ! Profitez de 10% de réduction sur votre prochaine visite. Valable jusqu'au ${dd}/${mm}/${yyyy}. Présentez ce SMS à l'atelier.`,
        discountKind: 'PERCENT',
        discountValue: 10,
        expiresAtDays: days,
      };
    }
    return {
      kind: 'REMINDER_SMS',
      messageBody: `Bonjour ${first}, il est temps de penser à l'entretien de votre véhicule. Nous serions ravis de vous revoir à l'atelier. À bientôt !`,
    };
  }

  // ── Predictive Maintenance ─────────────────────────────────────

  private readonly MAINTENANCE_INTERVALS: Array<{
    service: string;
    mileageKm: number;
    months: number;
  }> = [
    { service: 'oil-change', mileageKm: 10000, months: 6 },
    { service: 'brake-service', mileageKm: 20000, months: 12 },
    { service: 'tire-rotation', mileageKm: 10000, months: 6 },
    { service: 'air-filter', mileageKm: 20000, months: 12 },
    { service: 'timing-belt', mileageKm: 100000, months: 60 },
    { service: 'coolant-flush', mileageKm: 60000, months: 24 },
    { service: 'transmission-service', mileageKm: 60000, months: 36 },
    { service: 'general-inspection', mileageKm: 20000, months: 12 },
  ];

  // Tunisian-market heuristic when a car has no historical mileage snapshot.
  private readonly DEFAULT_KM_PER_YEAR = 15000;

  async predictMaintenance(
    garageId: string,
    dto: AiPredictMaintenanceDto = {},
  ): Promise<{
    predictions: Array<{
      carId: string;
      carLabel: string;
      service: string;
      predictedDate: string;
      confidence: number;
      urgency: 'low' | 'medium' | 'high';
      reason: string;
    }>;
    provider: string;
  }> {
    const where: any = { garageId };
    if (dto.carId) where.id = dto.carId;

    const cars = await this.prisma.car.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true } },
        appointments: {
          where: { status: 'COMPLETED' },
          select: { startTime: true, type: true, title: true },
        },
        maintenanceJobs: {
          where: { status: 'COMPLETED' },
          select: { completionDate: true, title: true },
        },
      },
    });

    const now = new Date();
    const lang = dto.language || 'en';

    const all: Array<{
      carId: string;
      carLabel: string;
      service: string;
      predictedDate: string;
      confidence: number;
      urgency: 'low' | 'medium' | 'high';
      reason: string;
      _sortKey: number;
    }> = [];

    for (const car of cars) {
      const scored = this.scoreMaintenanceForCar(car, now, lang);
      for (const s of scored) all.push(s);
    }

    // Sort by urgency weight desc, then soonest first
    all.sort((a, b) => b._sortKey - a._sortKey);

    // LLM polish: only for alerts we're actually going to surface (non-low, top 10)
    const atRisk = all.filter((p) => p.urgency !== 'low').slice(0, 10);
    let provider: string = atRisk.length === 0 ? 'template' : 'template';

    if (atRisk.length > 0 && (this.groqKey || this.anthropicKey || this.openaiKey || this.geminiKey)) {
      try {
        const langMap: Record<string, string> = { en: 'English', fr: 'French', ar: 'Arabic' };
        const responseLang = langMap[lang] || 'English';
        const prompt = `You are assisting a garage owner with preventive maintenance. For each vehicle alert below, write ONE short, specific reason (one sentence, max 20 words, in ${responseLang}) explaining why this service is due now.

Alerts:
${atRisk.map((a, i) => `${i}: ${a.carLabel} | ${a.service} | urgency=${a.urgency} | current context: ${a.reason}`).join('\n')}

Respond ONLY with a JSON array in the same order, no other text.
CRITICAL: The "reason" field MUST be written ENTIRELY in ${responseLang}.
[{"index": 0, "reason": "..."}, ...]`;

        const aiResponse = await this.chatForMaintenance({
          messages: [{ role: 'user', content: prompt }],
          context: 'maintenance_prediction',
        });
        const jsonMatch = aiResponse.message.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const picks = JSON.parse(jsonMatch[0]) as Array<{ index: number; reason: string }>;
          for (const p of picks) {
            if (atRisk[p.index] && typeof p.reason === 'string' && p.reason.trim()) {
              atRisk[p.index].reason = p.reason.trim();
            }
          }
          provider = aiResponse.provider;
        }
      } catch (error) {
        this.logger.warn('Maintenance LLM reason polish failed, falling back to template', error);
      }
    }

    const predictions = all.map(({ _sortKey, ...rest }) => rest);
    return { predictions, provider };
  }

  /**
   * Groq-first chat fallback used by predictMaintenance. The generic `chat()`
   * method prefers Claude/OpenAI/Gemini first — for maintenance reason polish
   * we deliberately bias toward Groq's low latency, then fall through.
   */
  private async chatForMaintenance(
    dto: AiChatDto,
  ): Promise<{ message: string; provider: string }> {
    if (this.groqKey) return this.chatWithGroq(dto);
    if (this.anthropicKey) return this.chatWithClaude(dto);
    if (this.openaiKey) return this.chatWithOpenAI(dto);
    if (this.geminiKey) return this.chatWithGemini(dto);
    return this.mockChat(dto);
  }

  private scoreMaintenanceForCar(
    car: any,
    now: Date,
    language: string,
  ): Array<{
    carId: string;
    carLabel: string;
    service: string;
    predictedDate: string;
    confidence: number;
    urgency: 'low' | 'medium' | 'high';
    reason: string;
    _sortKey: number;
  }> {
    const carLabel = this.buildCarLabel(car);
    const currentMileage = typeof car.mileage === 'number' ? car.mileage : null;
    const carCreatedMs = new Date(car.createdAt).getTime();

    // Normalize history: index completed jobs by inferred service type.
    // Appointments have a typed `.type` field; MaintenanceJob has free-text title.
    const historyByService = new Map<string, number>(); // service → latest completion epoch ms
    for (const appt of car.appointments || []) {
      if (!appt.startTime) continue;
      const type = this.normalizeServiceType(appt.type || appt.title);
      if (!type) continue;
      const t = new Date(appt.startTime).getTime();
      const prev = historyByService.get(type) ?? 0;
      if (t > prev) historyByService.set(type, t);
    }
    for (const job of car.maintenanceJobs || []) {
      if (!job.completionDate) continue;
      const type = this.normalizeServiceType(job.title);
      if (!type) continue;
      const t = new Date(job.completionDate).getTime();
      const prev = historyByService.get(type) ?? 0;
      if (t > prev) historyByService.set(type, t);
    }

    const out: Array<{
      carId: string;
      carLabel: string;
      service: string;
      predictedDate: string;
      confidence: number;
      urgency: 'low' | 'medium' | 'high';
      reason: string;
      _sortKey: number;
    }> = [];
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    for (const interval of this.MAINTENANCE_INTERVALS) {
      const lastMs = historyByService.get(interval.service) ?? null;
      const baselineMs = lastMs ?? carCreatedMs;
      const daysSince = Math.max(0, Math.floor((now.getTime() - baselineMs) / MS_PER_DAY));
      const intervalDays = interval.months * 30;

      // Time-based due date
      const dueFromTimeMs = baselineMs + intervalDays * MS_PER_DAY;

      // Mileage-based estimate. If we have no historical mileage snapshot,
      // assume the car has accumulated DEFAULT_KM_PER_YEAR since baseline.
      let dueFromMileageMs: number | null = null;
      if (currentMileage !== null) {
        const yearsSinceBaseline = Math.max(0, (now.getTime() - baselineMs) / (365 * MS_PER_DAY));
        const mileageAtBaseline = Math.max(
          0,
          currentMileage - yearsSinceBaseline * this.DEFAULT_KM_PER_YEAR,
        );
        const kmUntilDue = interval.mileageKm - (currentMileage - mileageAtBaseline);
        const kmPerDay = this.DEFAULT_KM_PER_YEAR / 365;
        const daysUntilMileageDue = kmUntilDue / kmPerDay;
        dueFromMileageMs = now.getTime() + daysUntilMileageDue * MS_PER_DAY;
      }

      // Predicted date = earliest of the two (soonest due wins)
      const predictedMs =
        dueFromMileageMs !== null
          ? Math.min(dueFromTimeMs, dueFromMileageMs)
          : dueFromTimeMs;

      const daysUntilDue = Math.floor((predictedMs - now.getTime()) / MS_PER_DAY);

      // Urgency bands
      let urgency: 'low' | 'medium' | 'high';
      if (daysUntilDue < 0) urgency = 'high';
      else if (daysUntilDue <= 30) urgency = 'medium';
      else urgency = 'low';

      // Confidence: 0.85 when real history exists, 0.6 when inferred from mileage only,
      // 0.45 for greenfield (no history and no mileage).
      let confidence: number;
      if (lastMs !== null) confidence = 0.85;
      else if (currentMileage !== null) confidence = 0.6;
      else confidence = 0.45;

      // Skip low-urgency items without history AND without mileage: noise.
      if (urgency === 'low' && lastMs === null && currentMileage === null) continue;

      const reason = this.maintenanceReasonFallback(
        language,
        interval.service,
        daysSince,
        lastMs !== null,
        daysUntilDue,
      );

      const urgencyWeight = urgency === 'high' ? 2 : urgency === 'medium' ? 1 : 0;
      const sortKey = urgencyWeight * 1_000_000 - daysUntilDue;

      out.push({
        carId: car.id,
        carLabel,
        service: interval.service,
        predictedDate: new Date(predictedMs).toISOString(),
        confidence,
        urgency,
        reason,
        _sortKey: sortKey,
      });
    }

    return out;
  }

  private buildCarLabel(car: any): string {
    const customer = car.customer
      ? `${car.customer.firstName || ''} ${car.customer.lastName || ''}`.trim()
      : '';
    const plate = car.licensePlate || '';
    const model = `${car.make || ''} ${car.model || ''}`.trim();
    const parts = [model, plate].filter(Boolean);
    const head = parts.join(' · ');
    return customer ? `${head} (${customer})` : head;
  }

  private normalizeServiceType(input: string | null | undefined): string | null {
    if (!input) return null;
    const s = input.toLowerCase();
    if (s.includes('oil')) return 'oil-change';
    if (s.includes('brake')) return 'brake-service';
    if (s.includes('tire') || s.includes('tyre') || s.includes('rotation')) return 'tire-rotation';
    if (s.includes('air filter') || s.includes('air-filter')) return 'air-filter';
    if (s.includes('timing belt') || s.includes('timing-belt')) return 'timing-belt';
    if (s.includes('coolant') || s.includes('radiator')) return 'coolant-flush';
    if (s.includes('transmission') || s.includes('gearbox')) return 'transmission-service';
    if (s.includes('inspection') || s.includes('check-up') || s.includes('checkup')) return 'general-inspection';
    return null;
  }

  private maintenanceReasonFallback(
    lang: string,
    service: string,
    daysSince: number,
    hasHistory: boolean,
    daysUntilDue: number,
  ): string {
    const serviceLabel = this.serviceLabel(lang, service);
    const dict: Record<string, (args: { label: string; days: number; hasHistory: boolean; until: number }) => string> = {
      en: ({ label, days, hasHistory, until }) =>
        until < 0
          ? `${label} is overdue by ${Math.abs(until)} days${hasHistory ? ` (${days} days since last service)` : ''}.`
          : `${label} is due in ${until} days${hasHistory ? ` (${days} days since last service)` : ' — no prior record'}.`,
      fr: ({ label, days, hasHistory, until }) =>
        until < 0
          ? `${label} en retard de ${Math.abs(until)} jours${hasHistory ? ` (${days} jours depuis le dernier entretien)` : ''}.`
          : `${label} dû dans ${until} jours${hasHistory ? ` (${days} jours depuis le dernier entretien)` : ' — aucun historique'}.`,
      ar: ({ label, days, hasHistory, until }) =>
        until < 0
          ? `${label} متأخر بـ ${Math.abs(until)} يوم${hasHistory ? ` (${days} يوم منذ آخر صيانة)` : ''}.`
          : `${label} مستحق خلال ${until} يوم${hasHistory ? ` (${days} يوم منذ آخر صيانة)` : ' — لا يوجد سجل سابق'}.`,
    };
    const fn = dict[lang] || dict['en'];
    return fn({ label: serviceLabel, days: daysSince, hasHistory, until: daysUntilDue });
  }

  private serviceLabel(lang: string, service: string): string {
    const labels: Record<string, Record<string, string>> = {
      en: {
        'oil-change': 'Oil change',
        'brake-service': 'Brake service',
        'tire-rotation': 'Tire rotation',
        'air-filter': 'Air filter',
        'timing-belt': 'Timing belt',
        'coolant-flush': 'Coolant flush',
        'transmission-service': 'Transmission service',
        'general-inspection': 'General inspection',
      },
      fr: {
        'oil-change': 'Vidange',
        'brake-service': 'Freins',
        'tire-rotation': 'Rotation des pneus',
        'air-filter': 'Filtre à air',
        'timing-belt': 'Courroie de distribution',
        'coolant-flush': 'Vidange du liquide de refroidissement',
        'transmission-service': 'Entretien de la transmission',
        'general-inspection': 'Inspection générale',
      },
      ar: {
        'oil-change': 'تغيير الزيت',
        'brake-service': 'صيانة الفرامل',
        'tire-rotation': 'تدوير الإطارات',
        'air-filter': 'فلتر الهواء',
        'timing-belt': 'سير التوقيت',
        'coolant-flush': 'غسل سائل التبريد',
        'transmission-service': 'صيانة ناقل الحركة',
        'general-inspection': 'فحص عام',
      },
    };
    return labels[lang]?.[service] || labels['en'][service] || service;
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
                  `Today's date is ${new Date().toISOString().slice(0, 10)} (UTC). ` +
                  'You are an AI assistant for OpAuto, a garage management ERP. ' +
                  'For any time-relative question (warranty windows, "since last service", ' +
                  '"last month", etc.) compute dates relative to today, never from your training data.',
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
                  `Today's date is ${new Date().toISOString().slice(0, 10)} (UTC). ` +
                  'You are an AI assistant for OpAuto, a garage management ERP. Help with ' +
                  'automotive diagnostics, scheduling, and business insights. For any ' +
                  'time-relative question (warranty windows, "since last service", "last month", etc.) ' +
                  'compute dates relative to today, never from your training data.',
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
