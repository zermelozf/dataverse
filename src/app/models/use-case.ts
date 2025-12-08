export interface UseCaseToolMapping {
  useCaseId: string;
  toolId: string;
}

export interface UseCase {
  id: string;
  name: string; // Use case name/title
  persona: string; // Persona ID
  action: string; // The action the persona wants to perform
  goal: string; // The goal/benefit of the action
  useCaseToolMappings: UseCaseToolMapping[]; // Tools that can realize this use case
  createdAt: Date;
  updatedAt: Date;
}

