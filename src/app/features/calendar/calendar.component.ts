import { Component, inject, signal, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FullCalendarModule, FullCalendarComponent as FC } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { CalendarService, CalendarEvent } from './services/calendar.service';
import { AppointmentService } from '../appointments/services/appointment.service';
import { TranslationService } from '../../core/services/translation.service';
import { SidebarService } from '../../core/services/sidebar.service';
import { Appointment } from '../../core/models/appointment.model';
import { Subscription, forkJoin } from 'rxjs';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
})
export class CalendarComponent implements OnInit, OnDestroy {
  private calendarService = inject(CalendarService);
  private appointmentService = inject(AppointmentService);
  private translationService = inject(TranslationService);
  public sidebarService = inject(SidebarService);

  @ViewChild('calendar') calendarComponent!: FC;

  currentView = signal<string>('dayGridMonth');
  currentTitle = signal<string>('');
  selectedMechanic = signal<string>('all');
  mechanics = signal<{ id: string; name: string; color: string }[]>([]);

  showEventDetail = signal(false);
  selectedEvent = signal<any>(null);

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
    // TODO: Open appointment modal with pre-filled date
    console.log('Date selected:', selectInfo.startStr);
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
    console.log('Event moved:', dropInfo.event.id, 'to', dropInfo.event.startStr);
    // TODO: Update appointment via service
  }

  closeEventDetail() {
    this.showEventDetail.set(false);
    this.selectedEvent.set(null);
  }

  t(key: string): string {
    return this.translationService.instant(key);
  }
}
