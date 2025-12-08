export interface KPI {
  id: string;
  name: string;
  description?: string;
  unit?: string; // e.g., '%', '$', 'count', 'days'
  targetValue?: string;
  createdAt: Date;
  updatedAt: Date;
}

