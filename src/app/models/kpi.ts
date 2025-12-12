export interface KPI {
  id: string;
  name: string;
  description?: string;
  unit?: string; // e.g., '%', '$', 'count', 'days'
  targetValue?: string;
  useCaseIds?: string[]; // Use cases that cover/address this KPI
  showOnDashboard?: boolean; // Show this KPI in the Performance section of the dashboard
  createdAt: Date;
  updatedAt: Date;
}

