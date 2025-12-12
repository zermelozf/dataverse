export interface ProjectKPIMapping {
  kpiId: string;
  currentValue?: string;
  targetValue?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  useCaseIds: string[]; // References to use cases
  kpiMappings: ProjectKPIMapping[]; // KPIs with their current/target values
  createdAt: Date;
  updatedAt: Date;
}
