export interface Appointment {
  id: string;
  carId: string;
  customerId: string;
  mechanicId: string;
  serviceType: string;
  serviceName: string;
  scheduledDate: Date;
  estimatedDuration: number; // minutes
  status: AppointmentStatus;
  notes?: string;
  priority: AppointmentPriority;
  createdAt: Date;
  updatedAt: Date;
}

export type AppointmentStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type AppointmentPriority = 'low' | 'medium' | 'high';

export interface AppointmentSlot {
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  mechanicId?: string;
  conflictReason?: string;
}

export interface Car {
  id: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  customerId: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export interface Mechanic {
  id: string;
  name: string;
  specialties: string[];
  isAvailable: boolean;
  currentWorkload: number;
}

export interface GarageCapacity {
  totalLifts: number;
  availableLifts: number;
  totalMechanics: number;
  availableMechanics: number;
  workingHours: {
    start: string; // "08:00"
    end: string;   // "18:00"
  };
}