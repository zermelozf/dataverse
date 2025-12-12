export interface PersonaUseCaseMapping {
  useCaseId: string;
  toolIds: string[]; // Tools used by this persona to realize this use case
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  personaUseCaseMappings: PersonaUseCaseMapping[]; // Use cases and tools used by this persona
  createdAt: Date;
  updatedAt: Date;
}
