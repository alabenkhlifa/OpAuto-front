export interface Employee {
  id: string;
  employeeNumber: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string;
    email: string;
    address: string;
    dateOfBirth: Date;
  };
  employment: {
    hireDate: Date;
    role: EmployeeRole;
    department: EmployeeDepartment;
    status: EmployeeStatus;
    salary: number;
    workingHours: WorkingSchedule;
    contractType: ContractType;
  };
  skills: {
    specialties: string[];
    certifications: string[];
    experienceLevel: ExperienceLevel;
    skillRating: number; // 1-5 scale
  };
  availability: {
    isAvailable: boolean;
    currentWorkload: number;
    maxWorkload: number;
    unavailableUntil?: Date;
    unavailableReason?: string;
  };
  performance: {
    completedJobs: number;
    averageJobDuration: number;
    customerRating: number;
    totalRevenue: number;
    efficiencyScore: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type EmployeeRole = 'admin' | 'senior-mechanic' | 'junior-mechanic' | 'apprentice' | 'service-advisor';
export type EmployeeDepartment = 'management' | 'mechanical' | 'bodywork' | 'electrical' | 'service';
export type EmployeeStatus = 'active' | 'inactive' | 'on-leave' | 'terminated';
export type ContractType = 'full-time' | 'part-time' | 'contract' | 'apprentice';
export type ExperienceLevel = 'entry' | 'junior' | 'mid' | 'senior' | 'expert';

export interface WorkingSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  isWorkingDay: boolean;
  startTime: string; // "08:00"
  endTime: string;   // "17:00"
  breakStart?: string; // "12:00"
  breakEnd?: string;   // "13:00"
}

export interface EmployeeFilters {
  searchTerm?: string;
  role?: EmployeeRole[];
  department?: EmployeeDepartment[];
  status?: EmployeeStatus[];
  experienceLevel?: ExperienceLevel[];
  isAvailable?: boolean;
}

export interface EmployeeStats {
  totalEmployees: number;
  activeEmployees: number;
  availableEmployees: number;
  onLeaveEmployees: number;
  averageExperience: number;
  totalSalaryExpense: number;
  departmentDistribution: {
    [key in EmployeeDepartment]: number;
  };
  roleDistribution: {
    [key in EmployeeRole]: number;
  };
}

export interface EmployeePerformanceMetrics {
  employeeId: string;
  employeeName: string;
  period: string;
  jobsCompleted: number;
  averageJobTime: number;
  customerSatisfaction: number;
  revenue: number;
  utilizationRate: number;
  qualityScore: number;
}

// Legacy compatibility - extend Mechanic interface for backward compatibility
export interface Mechanic extends Pick<Employee, 'id'> {
  name: string;
  specialties: string[];
  isAvailable: boolean;
  currentWorkload: number;
}