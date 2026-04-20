export interface AiError {
  code: 'PROVIDER_UNAVAILABLE' | 'RATE_LIMITED' | 'NOT_IMPLEMENTED' | 'UNKNOWN';
  message: string;
}

// Chat
export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
  context?: string;
}

export interface AiChatResponse {
  message: string;
  provider: string;
}

// Diagnose
export interface AiDiagnoseRequest {
  symptoms: string;
  carMake?: string;
  carModel?: string;
  carYear?: string;
}

export interface AiDiagnoseResponse {
  diagnosis: string;
  recommendations: string[];
  urgency: string;
  provider: string;
}

// Estimate
export interface AiEstimateRequest {
  serviceType: string;
  carMake?: string;
  carModel?: string;
  description?: string;
}

export interface AiEstimateResponse {
  estimatedCost: { min: number; max: number };
  estimatedHours: number;
  breakdown: string[];
  provider: string;
}

// Schedule (future)
export interface AiScheduleSuggestion {
  start: string;
  end: string;
  mechanicId: string;
  mechanicName: string;
  score: number;
  reason: string;
  warning?: string;
}

export interface AiScheduleRequest {
  appointmentType: string;
  preferredDate?: string;
  mechanicId?: string;
  estimatedDuration: number;
  language?: string;
}

export interface AiScheduleResponse {
  suggestedSlots: AiScheduleSuggestion[];
  provider: string;
}

// Insights (future)
export interface AiInsightHighlight {
  label: string;
  trend: 'up' | 'down' | 'stable';
  detail: string;
}

export interface AiInsightsRequest {
  period: 'week' | 'month' | 'quarter';
  metrics?: Record<string, number>;
}

export interface AiInsightsResponse {
  insights: string[];
  highlights: AiInsightHighlight[];
  provider: string;
}

// Maintenance prediction (future)
export interface AiMaintenancePrediction {
  service: string;
  predictedDate: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
  reason: string;
}

export interface AiMaintenancePredictionRequest {
  carId: string;
  currentMileage: number;
}

export interface AiMaintenancePredictionResponse {
  predictions: AiMaintenancePrediction[];
  provider: string;
}

// Churn prediction (future)
export interface AiChurnPrediction {
  customerId: string;
  customerName: string;
  churnRisk: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  suggestedAction: string;
}

export interface AiChurnPredictionRequest {
  customerId?: string;
  language?: string;
}

export interface AiChurnPredictionResponse {
  predictions: AiChurnPrediction[];
  provider: string;
}
