export interface UseCaseToolMapping {
  useCaseId: string;
  toolId: string;
}

export interface UseCase {
  id: string;
  persona: string; // Persona ID
  action: string; // The action the persona wants to perform (also serves as title)
  goal: string; // The goal/benefit of the action
  useCaseToolMappings: UseCaseToolMapping[]; // Tools that can realize this use case
  currentVersion?: string; // Current version
  targetVersion?: string; // Target version
  createdAt: Date;
  updatedAt: Date;
}
