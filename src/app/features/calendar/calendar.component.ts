import { Component, inject, signal, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FullCalendarModule, FullCalendarComponent as FC } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { Router } from '@angular/router';
import { CalendarService, CalendarEvent } from './services/calendar.service';
import { AppointmentService } from '../appointments/services/appointment.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { SidebarService } from '../../core/services/sidebar.service';
import { Appointment, AppointmentStatus } from '../../core/models/appointment.model';
import { AppointmentModalComponent } from '../appointments/components/appointment-modal.component';
import { RescheduleConflictModalComponent } from './components/reschedule-conflict-modal.component';
import { AiService } from '../../core/services/ai.service';
import { AiScheduleSuggestion } from '../../core/models/ai.model';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../shared/services/toast.service';
import { GarageSettingsService } from '../../core/services/garage-settings.service';
import { WorkingHours } from '../../core/models/garage-settings.model';
import { Subscription, forkJoin } from 'rxjs';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, TranslatePipe, AppointmentModalComponent, RescheduleConflictModalComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
})
export class CalendarComponent implements OnInit, OnDestroy {
  private calendarService = inject(CalendarService);
  private appointmentService = inject(AppointmentService);
  private translationService = inject(TranslationService);
  private router = inject(Router);
  public sidebarService = inject(SidebarService);
  private aiService = inject(AiService);
  private languageService = inject(LanguageService);
  private toast = inject(ToastService);
  private garageSettingsService = inject(GarageSettingsService);
  private workingHours: WorkingHours | null = null;

  @ViewChild('calendar') calendarComponent!: FC;
  @ViewChild(AppointmentModalComponent) appointmentModal?: AppointmentModalComponent;

  currentView = signal<string>('dayGridMonth');
  currentTitle = signal<string>('');
  selectedMechanic = signal<string>('all');
  mechanics = signal<{ id: string; name: string; color: string }[]>([]);

  showEventDetail = signal(false);
  selectedEvent = signal<any>(null);
  showAddModal = signal(false);
  showConflictModal = signal(false);
  conflictSuggestions = signal<AiScheduleSuggestion[]>([]);
  pendingDropAppointmentId = signal('');
  pendingDropMechanicId = signal('');
  pendingDropMechanicName = signal('');
  isRescheduling = signal(false);
  showClosedDayModal = signal(false);
  closedDayName = signal('');
  private pendingDropInfo: EventDropArg | null = null;

  private appointments: Appointment[] = [];
  private subscription?: Subscription;

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: false,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    weekends: true,
    height: 'auto',
    slotMinTime: '07:00:00',
    slotMaxTime: '20:00:00',
    slotDuration: '00:30:00',
    allDaySlot: false,
    nowIndicator: true,
    eventDisplay: 'block',
    events: [],
    select: this.handleDateSelect.bind(this),
    eventClick: this.handleEventClick.bind(this),
    eventDrop: this.handleEventDrop.bind(this),
    dayCellClassNames: (arg) => {
      return this.isClosedDay(arg.date) ? ['closed-day'] : [];
    },
    datesSet: (info) => {
      this.currentTitle.set(info.view.title);
    },
  };

  ngOnInit() {
    // Preload customers, cars, mechanics caches before mapping appointments
    this.subscription = forkJoin({
      customers: this.appointmentService.getCustomers(),
      cars: this.appointmentService.getCars(),
      mechanics: this.appointmentService.getMechanics(),
      appointments: this.appointmentService.getAppointments()
    }).subscribe(({ appointments }) => {
      this.appointments = appointments;
      this.mechanics.set(this.calendarService.getMechanicsFromAppointments(appointments));
      this.loadEvents();
    });

    this.garageSettingsService.getSettings().subscribe({
      next: (settings) => this.workingHours = settings.operationalSettings.workingHours,
      error: () => {}
    });

    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.changeView('timeGridDay');
    }
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  loadEvents() {
    let events: CalendarEvent[] = this.calendarService.mapAppointmentsToEvents(this.appointments);
    const mechFilter = this.selectedMechanic();
    if (mechFilter !== 'all') {
      events = events.filter(e => e.extendedProps.mechanicId === mechFilter);
    }
    this.calendarOptions = { ...this.calendarOptions, events };
  }

  changeView(view: string) {
    this.currentView.set(view);
    const calApi = this.calendarComponent?.getApi();
    if (calApi) {
      calApi.changeView(view);
      this.currentTitle.set(calApi.view.title);
    }
  }

  navigatePrev() {
    const calApi = this.calendarComponent?.getApi();
    if (calApi) {
      calApi.prev();
      this.currentTitle.set(calApi.view.title);
    }
  }

  navigateNext() {
    const calApi = this.calendarComponent?.getApi();
    if (calApi) {
      calApi.next();
      this.currentTitle.set(calApi.view.title);
    }
  }

  navigateToday() {
    const calApi = this.calendarComponent?.getApi();
    if (calApi) {
      calApi.today();
      this.currentTitle.set(calApi.view.title);
    }
  }

  onMechanicFilterChange() {
    this.loadEvents();
  }

  handleDateSelect(selectInfo: DateSelectArg) {
    // Clicking/dragging on an empty slot opens the Add Appointment modal
    // pre-filled with the selected start time. The form still runs the full
    // validation + conflict flow, so the user can adjust before saving.
    this.showAddModal.set(true);
    setTimeout(() => this.appointmentModal?.setInitialDate(selectInfo.start));
  }

  handleEventClick(clickInfo: EventClickArg) {
    this.selectedEvent.set({
      id: clickInfo.event.id,
      title: clickInfo.event.title,
      start: clickInfo.event.startStr,
      end: clickInfo.event.endStr,
      ...clickInfo.event.extendedProps,
    });
    this.showEventDetail.set(true);
  }

  handleEventDrop(dropInfo: EventDropArg) {
    if (this.isRescheduling()) return;

    const event = dropInfo.event;
    const status = (event.extendedProps['status'] || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled') {
      dropInfo.revert();
      this.toast.warning(this.t(`calendar.toast.cannotMove${status === 'completed' ? 'Completed' : 'Cancelled'}`));
      return;
    }
    const originalStart = dropInfo.oldEvent?.start;
    if (originalStart && originalStart < new Date()) {
      dropInfo.revert();
      this.toast.warning(this.t('calendar.toast.cannotMovePast'));
      return;
    }

    if (this.isClosedDay(event.start!)) {
      const dayName = event.start!.toLocaleDateString(this.languageService.getCurrentLanguage(), { weekday: 'long' });
      this.closedDayName.set(dayName);
      this.pendingDropInfo = dropInfo;
      this.showClosedDayModal.set(true);
      return;
    }

    this.processEventDrop(dropInfo);
  }

  private processEventDrop(dropInfo: EventDropArg) {
    this.isRescheduling.set(true);
    const event = dropInfo.event;
    const appointmentId = event.id;
    const mechanicId = event.extendedProps['mechanicId'] || '';
    const mechanicName = event.extendedProps['mechanicName'] || 'Unassigned';
    const serviceType = event.extendedProps['type'] || '';
    const startTime = event.start!;
    const endTime = event.end!;
    const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    const conflict = this.findConflict(appointmentId, mechanicId, startTime, endTime);

    if (conflict) {
      dropInfo.revert();
      this.pendingDropAppointmentId.set(appointmentId);
      this.pendingDropMechanicId.set(mechanicId);
      this.pendingDropMechanicName.set(mechanicName);

      this.aiService.suggestSchedule({
        appointmentType: serviceType,
        estimatedDuration: durationMin,
        preferredDate: startTime.toISOString(),
        mechanicId: mechanicId || undefined,
        language: this.languageService.getCurrentLanguage(),
      }).subscribe({
        next: (response) => {
          this.conflictSuggestions.set(response.suggestedSlots);
          this.showConflictModal.set(true);
          this.isRescheduling.set(false);
        },
        error: () => {
          this.conflictSuggestions.set([]);
          this.showConflictModal.set(true);
          this.isRescheduling.set(false);
        }
      });
    } else {
      this.appointmentService.updateAppointment(appointmentId, {
        scheduledDate: startTime,
        estimatedDuration: durationMin,
      }).subscribe({
        next: () => {
          this.toast.success(this.t('calendar.toast.rescheduled'));
          this.appointmentService.getAppointments().subscribe(appts => {
            this.appointments = appts;
            this.loadEvents();
            this.isRescheduling.set(false);
          });
        },
        error: () => {
          dropInfo.revert();
          this.toast.error(this.t('calendar.toast.rescheduleFailed'));
          this.isRescheduling.set(false);
        }
      });
    }
  }

  onClosedDayConfirm() {
    this.showClosedDayModal.set(false);
    if (this.pendingDropInfo) {
      this.processEventDrop(this.pendingDropInfo);
      this.pendingDropInfo = null;
    }
  }

  onClosedDayCancel() {
    this.showClosedDayModal.set(false);
    if (this.pendingDropInfo) {
      this.pendingDropInfo.revert();
      this.pendingDropInfo = null;
    }
  }

  findConflict(excludeId: string, mechanicId: string, newStart: Date, newEnd: Date): Appointment | undefined {
    if (!mechanicId) return undefined;
    return this.appointments.find(apt =>
      apt.id !== excludeId
      && apt.mechanicId === mechanicId
      && apt.status !== 'cancelled'
      && this.timesOverlap(newStart, newEnd, apt.scheduledDate, new Date(apt.scheduledDate.getTime() + apt.estimatedDuration * 60000))
    );
  }

  private timesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
    return aStart < bEnd && aEnd > bStart;
  }

  private isClosedDay(date: Date): boolean {
    if (!this.workingHours) return false;
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dayKey = dayNames[date.getDay()];
    const schedule = (this.workingHours as any)[dayKey];
    return schedule && typeof schedule === 'object' && !schedule.isWorkingDay;
  }

  onConflictSlotSelected(slot: AiScheduleSuggestion) {
    this.showConflictModal.set(false);
    const appointmentId = this.pendingDropAppointmentId();
    const durationMin = Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000);
    this.appointmentService.updateAppointment(appointmentId, {
      scheduledDate: new Date(slot.start),
      mechanicId: slot.mechanicId,
      estimatedDuration: durationMin,
    }).subscribe({
      next: () => {
        this.toast.success(this.t('calendar.toast.rescheduled'));
        this.appointmentService.getAppointments().subscribe(appts => {
          this.appointments = appts;
          this.loadEvents();
        });
      },
      error: () => this.toast.error(this.t('calendar.toast.rescheduleFailed'))
    });
  }

  onConflictCancelled() {
    this.showConflictModal.set(false);
    this.conflictSuggestions.set([]);
  }

  closeEventDetail() {
    this.showEventDetail.set(false);
    this.selectedEvent.set(null);
  }

  onAddAppointment() {
    this.showAddModal.set(true);
  }

  onAppointmentSaved() {
    this.showAddModal.set(false);
    this.appointmentService.getAppointments().subscribe(appts => {
      this.appointments = appts;
      this.loadEvents();
    });
  }

  onEditAppointment() {
    const event = this.selectedEvent();
    if (!event?.id) return;
    const appointment = this.appointments.find(a => a.id === event.id);
    if (!appointment) return;
    this.closeEventDetail();
    this.showAddModal.set(true);
    setTimeout(() => {
      this.appointmentModal?.setEditAppointment(appointment);
    });
  }

  onCancelAppointment() {
    const event = this.selectedEvent();
    if (!event?.id) return;
    const confirmMsg = this.t('calendar.confirmCancel') || 'Are you sure you want to cancel this appointment?';
    if (confirm(confirmMsg)) {
      this.appointmentService.updateAppointment(event.id, { status: 'cancelled' as any }).subscribe({
        next: () => {
          this.toast.success(this.t('calendar.toast.cancelled'));
          this.closeEventDetail();
          this.appointmentService.getAppointments().subscribe(appts => {
            this.appointments = appts;
            this.loadEvents();
          });
        },
        error: () => this.toast.error(this.t('calendar.toast.cancelFailed'))
      });
    }
  }

  canCancel(): boolean {
    const status = this.selectedEvent()?.status?.toLowerCase()?.replace('-', '_');
    return status === 'pending' || status === 'confirmed';
  }

  readonly availableStatuses: AppointmentStatus[] = ['scheduled', 'confirmed', 'pending', 'in-progress', 'completed'];

  statusKey(status: string | undefined): string {
    return (status || '').toLowerCase().replace('-', '_');
  }

  onStatusChange(newStatus: string) {
    const event = this.selectedEvent();
    if (!event?.id || !newStatus) return;
    const current = this.statusKey(event.status);
    if (this.statusKey(newStatus) === current) return;

    this.appointmentService.updateAppointment(event.id, { status: newStatus as AppointmentStatus }).subscribe({
      next: () => {
        this.toast.success(this.t('calendar.toast.statusUpdated'));
        this.appointmentService.getAppointments().subscribe(appts => {
          this.appointments = appts;
          this.loadEvents();
          const updated = appts.find(a => a.id === event.id);
          if (updated) {
            this.selectedEvent.set({ ...event, status: updated.status });
          }
        });
      },
      error: () => this.toast.error(this.t('calendar.toast.statusUpdateFailed'))
    });
  }

  t(key: string): string {
    return this.translationService.instant(key);
  }
}
