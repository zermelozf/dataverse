export interface KPI {
  id: string;
  name: string;
  description?: string;
  unit?: string; // e.g., '%', '$', 'count', 'days'
  targetValue?: string;
  useCaseIds?: string[]; // Use cases that cover/address this KPI
  createdAt: Date;
  updatedAt: Date;
}

