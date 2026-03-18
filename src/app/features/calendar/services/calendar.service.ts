import { Injectable, inject, signal } from '@angular/core';
import { AppointmentService } from '../../appointments/services/appointment.service';
import { Appointment } from '../../../core/models/appointment.model';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    customerId: string;
    customerName: string;
    carInfo: string;
    mechanicId?: string;
    mechanicName?: string;
    status: string;
    type?: string;
  };
}

const MECHANIC_COLORS = [
  { bg: '#FF8400', border: '#E67700', text: '#fff' },
  { bg: '#8FA0D8', border: '#7B8CC4', text: '#fff' },
  { bg: '#F9DFC6', border: '#E8C9A8', text: '#0B0829' },
  { bg: '#22c55e', border: '#16a34a', text: '#fff' },
  { bg: '#a855f7', border: '#9333ea', text: '#fff' },
  { bg: '#06b6d4', border: '#0891b2', text: '#fff' },
  { bg: '#f43f5e', border: '#e11d48', text: '#fff' },
  { bg: '#eab308', border: '#ca8a04', text: '#0B0829' },
];

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private appointmentService = inject(AppointmentService);

  selectedMechanicFilter = signal<string | null>(null);

  private mechanicColorMap = new Map<string, typeof MECHANIC_COLORS[0]>();
  private colorIndex = 0;

  getMechanicColor(mechanicId: string): typeof MECHANIC_COLORS[0] {
    if (!this.mechanicColorMap.has(mechanicId)) {
      this.mechanicColorMap.set(mechanicId, MECHANIC_COLORS[this.colorIndex % MECHANIC_COLORS.length]);
      this.colorIndex++;
    }
    return this.mechanicColorMap.get(mechanicId)!;
  }

  mapAppointmentsToEvents(appointments: Appointment[]): CalendarEvent[] {
    return appointments.map(apt => {
      const color = apt.mechanicId
        ? this.getMechanicColor(apt.mechanicId)
        : { bg: '#FF8400', border: '#E67700', text: '#fff' };

      const customer = this.appointmentService.getCustomerById(apt.customerId);
      const car = this.appointmentService.getCarById(apt.carId);
      const mechanic = this.appointmentService.getMechanicById(apt.mechanicId);

      const customerName = customer?.name || 'Unknown Customer';
      const carInfo = car ? `${car.make} ${car.model} (${car.licensePlate})` : '';
      const mechanicName = mechanic?.name || 'Unassigned';

      const startDate = apt.scheduledDate;
      const endDate = new Date(startDate.getTime() + apt.estimatedDuration * 60000);

      return {
        id: apt.id,
        title: `${customerName} - ${apt.serviceName || apt.serviceType || 'Service'}`,
        start: this.toLocalISOString(startDate),
        end: this.toLocalISOString(endDate),
        backgroundColor: color.bg,
        borderColor: color.border,
        textColor: color.text,
        extendedProps: {
          customerId: apt.customerId || '',
          customerName,
          carInfo,
          mechanicId: apt.mechanicId,
          mechanicName,
          status: apt.status,
          type: apt.serviceType,
        },
      };
    });
  }

  getMechanicsFromAppointments(appointments: Appointment[]): { id: string; name: string; color: string }[] {
    const mechanics = new Map<string, string>();
    appointments.forEach(apt => {
      if (apt.mechanicId) {
        const mechanic = this.appointmentService.getMechanicById(apt.mechanicId);
        mechanics.set(apt.mechanicId, mechanic?.name || 'Unknown');
      }
    });
    return Array.from(mechanics.entries()).map(([id, name]) => ({
      id,
      name,
      color: this.getMechanicColor(id).bg,
    }));
  }

  private toLocalISOString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
