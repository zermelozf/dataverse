import { UseCaseToolMapping } from './use-case';

export interface Tool {
  id: string;
  name: string;
  description: string;
  useCaseToolMappings: UseCaseToolMapping[]; // Use cases this tool can realize
  createdAt: Date;
  updatedAt: Date;
}

