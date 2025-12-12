import { Injectable, signal, effect, Injector } from '@angular/core';
import { UseCase } from '../models/use-case';
import { DatabaseService } from './database.service';
import { PersonaService } from './persona.service';
import { ToolService } from './tool.service';

@Injectable({
  providedIn: 'root'
})
export class UseCaseService {
  private useCases = signal<UseCase[]>([]);
  private initialized = false;
  private toolService: ToolService | null = null;

  constructor(
    private db: DatabaseService,
    private personaService: PersonaService,
    private injector: Injector
  ) {
    this.loadData();
    
    effect(() => {
      if (this.initialized) {
        this.saveUseCases();
      }
    });
  }

  private async loadData() {
    try {
      const useCases = await this.db.useCases.toArray();
      // Migrate old use cases that have name/description to persona/action/goal format
      const useCasesWithDates = useCases.map((uc: any) => {
        // Migrate old toolIds to useCaseToolMappings
        let mappings = uc.useCaseToolMappings || [];
        if (uc.toolIds && uc.toolIds.length > 0 && mappings.length === 0) {
          mappings = uc.toolIds.map((toolId: string) => ({
            useCaseId: uc.id,
            toolId
          }));
        }
        
        // If old format had name but no action, use name as action
        const actionValue = uc.action || uc.name || '';
        
        return {
          ...uc,
          persona: uc.persona || '',
          action: actionValue,
          goal: uc.goal || '',
          useCaseToolMappings: mappings,
          createdAt: new Date(uc.createdAt),
          updatedAt: new Date(uc.updatedAt)
        };
      });
      this.useCases.set(useCasesWithDates);
      this.initialized = true;
      
      // After loading use cases, rebuild persona mappings
      await this.rebuildPersonaMappings();
    } catch (error) {
      console.error('Error loading use cases from IndexedDB:', error);
      this.initialized = true;
    }
  }

  private async rebuildPersonaMappings() {
    // Rebuild persona mappings from all use cases
    const useCases = this.useCases();
    const personaMap = new Map<string, Map<string, string[]>>(); // personaId -> useCaseId -> toolIds[]
    
    for (const useCase of useCases) {
      if (useCase.persona && useCase.persona.trim()) {
        if (!personaMap.has(useCase.persona)) {
          personaMap.set(useCase.persona, new Map());
        }
        const useCaseMap = personaMap.get(useCase.persona)!;
        const toolIds = (useCase.useCaseToolMappings || []).map(m => m.toolId);
        useCaseMap.set(useCase.id, toolIds);
      }
    }
    
    // Update all personas with their mappings
    for (const [personaId, useCaseMap] of personaMap.entries()) {
      const persona = this.personaService.getPersona(personaId);
      if (persona) {
        const mappings: Array<{ useCaseId: string; toolIds: string[] }> = [];
        for (const [useCaseId, toolIds] of useCaseMap.entries()) {
          mappings.push({ useCaseId, toolIds });
        }
        
        // Only update if mappings are different
        const currentMappings = persona.personaUseCaseMappings || [];
        const currentMappingsStr = JSON.stringify(currentMappings.sort((a, b) => a.useCaseId.localeCompare(b.useCaseId)));
        const newMappingsStr = JSON.stringify(mappings.sort((a, b) => a.useCaseId.localeCompare(b.useCaseId)));
        
        if (currentMappingsStr !== newMappingsStr) {
          console.log(`Rebuilding persona ${personaId} mappings:`, mappings);
          await this.personaService.updatePersona(personaId, {
            personaUseCaseMappings: mappings
          });
        }
      }
    }
  }

  private async saveUseCases() {
    try {
      await this.db.useCases.bulkPut(this.useCases());
    } catch (error) {
      console.error('Error saving use cases to IndexedDB:', error);
    }
  }

  getUseCases() {
    return this.useCases.asReadonly();
  }

  getUseCase(id: string): UseCase | undefined {
    return this.useCases().find(uc => uc.id === id);
  }

  async addUseCase(useCase: Omit<UseCase, 'id' | 'createdAt' | 'updatedAt'>) {
    const useCaseId = this.generateId();
    const mappings = (useCase.useCaseToolMappings || []).map(m => ({
      ...m,
      useCaseId // Ensure useCaseId is set
    }));
    
    const newUseCase: UseCase = {
      ...useCase,
      useCaseToolMappings: mappings,
      id: useCaseId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.useCases.update(useCases => [...useCases, newUseCase]);
    // Explicitly save to ensure persistence
    await this.saveUseCases();
    
    // Update persona's personaUseCaseMappings if persona is assigned
    if (newUseCase.persona && newUseCase.persona.trim()) {
      console.log(`Adding use case ${newUseCase.id} to persona ${newUseCase.persona}`);
      await this.addUseCaseToPersona(newUseCase.persona, newUseCase.id, mappings.map(m => m.toolId));
    } else {
      console.log(`Use case ${newUseCase.id} has no persona assigned`);
    }
    
    // Update tools' useCaseToolMappings
    for (const mapping of mappings) {
      await this.addUseCaseToTool(mapping.toolId, newUseCase.id);
    }
    
    return newUseCase;
  }

  async updateUseCase(id: string, updates: Partial<UseCase>) {
    const currentUseCase = this.useCases().find(uc => uc.id === id);
    if (!currentUseCase) return;

    const oldPersonaId = currentUseCase.persona;
    const newPersonaId = updates.persona;
    const oldMappings = currentUseCase.useCaseToolMappings || [];
    const newMappings = updates.useCaseToolMappings;

    // Ensure useCaseId is set in new mappings
    if (newMappings) {
      updates.useCaseToolMappings = newMappings.map(m => ({
        ...m,
        useCaseId: id
      }));
    }

    this.useCases.update(useCases =>
      useCases.map(uc =>
        uc.id === id
          ? { ...uc, ...updates, updatedAt: new Date() }
          : uc
      )
    );
    // Explicitly save to ensure persistence
    await this.saveUseCases();

    // Update persona relationships if persona changed
    if (oldPersonaId !== newPersonaId) {
      // Remove from old persona if it existed
      if (oldPersonaId) {
        await this.removeUseCaseFromPersona(oldPersonaId, id);
      }
      // Add to new persona if it exists
      if (newPersonaId) {
        const toolIds = (updates.useCaseToolMappings || currentUseCase.useCaseToolMappings || []).map(m => m.toolId);
        await this.addUseCaseToPersona(newPersonaId, id, toolIds);
      }
    }

    // Update tool relationships if mappings changed
    if (newMappings) {
      const oldToolIds = oldMappings.map(m => m.toolId);
      const newToolIds = newMappings.map(m => m.toolId);
      
      // Remove from tools that are no longer mapped
      for (const toolId of oldToolIds) {
        if (!newToolIds.includes(toolId)) {
          await this.removeUseCaseFromTool(toolId, id);
        }
      }
      
      // Add to new tools
      for (const mapping of newMappings) {
        if (!oldToolIds.includes(mapping.toolId)) {
          await this.addUseCaseToTool(mapping.toolId, id);
        }
      }
      
      // Update persona's tool mapping if persona is assigned
      if (currentUseCase.persona) {
        await this.updatePersonaUseCaseTools(currentUseCase.persona, id, newToolIds);
      }
    }
  }

  async deleteUseCase(id: string) {
    const useCase = this.useCases().find(uc => uc.id === id);
    
    // Remove from persona's personaUseCaseMappings if persona is assigned
    if (useCase?.persona) {
      await this.removeUseCaseFromPersona(useCase.persona, id);
    }

    // Remove from tools' useCaseToolMappings
    for (const mapping of (useCase?.useCaseToolMappings || [])) {
      await this.removeUseCaseFromTool(mapping.toolId, id);
    }

    this.useCases.update(useCases => useCases.filter(uc => uc.id !== id));
    try {
      await this.db.useCases.delete(id);
    } catch (error) {
      console.error('Error deleting use case from IndexedDB:', error);
    }
  }

  private async addUseCaseToPersona(personaId: string, useCaseId: string, toolIds: string[] = []) {
    // Get fresh persona data - might need to wait a bit if persona was just created
    let persona = this.personaService.getPersona(personaId);
    if (!persona) {
      // If persona not found, wait a bit and try again (in case it was just created)
      await new Promise(resolve => setTimeout(resolve, 200));
      persona = this.personaService.getPersona(personaId);
      if (!persona) {
        console.warn(`Persona ${personaId} not found when trying to add use case ${useCaseId}`);
        return;
      }
    }

    const mappings = [...(persona.personaUseCaseMappings || [])];
    const existingMapping = mappings.find(m => m.useCaseId === useCaseId);
    
    if (!existingMapping) {
      // Add new mapping if it doesn't exist, with tools from the use case
      const newMappings = [...mappings, { useCaseId, toolIds }];
      console.log(`Adding use case ${useCaseId} to persona ${personaId} with mappings:`, newMappings);
      await this.personaService.updatePersona(personaId, {
        personaUseCaseMappings: newMappings
      });
    } else {
      // Update existing mapping to include new tools (merge, avoiding duplicates)
      const mergedToolIds = [...new Set([...existingMapping.toolIds, ...toolIds])];
      const updatedMappings = mappings.map(m => 
        m.useCaseId === useCaseId ? { ...m, toolIds: mergedToolIds } : m
      );
      console.log(`Updating use case ${useCaseId} in persona ${personaId} with mappings:`, updatedMappings);
      await this.personaService.updatePersona(personaId, {
        personaUseCaseMappings: updatedMappings
      });
    }
  }

  private async removeUseCaseFromPersona(personaId: string, useCaseId: string) {
    const persona = this.personaService.getPersona(personaId);
    if (!persona) return;

    const mappings = (persona.personaUseCaseMappings || []).filter(m => m.useCaseId !== useCaseId);
    await this.personaService.updatePersona(personaId, {
      personaUseCaseMappings: mappings
    });
  }

  private async updatePersonaUseCaseTools(personaId: string, useCaseId: string, toolIds: string[]) {
    const persona = this.personaService.getPersona(personaId);
    if (!persona) return;

    const mappings = persona.personaUseCaseMappings || [];
    const existingMapping = mappings.find(m => m.useCaseId === useCaseId);
    
    if (existingMapping) {
      // Update existing mapping with new tool IDs
      await this.personaService.updatePersona(personaId, {
        personaUseCaseMappings: mappings.map(m => 
          m.useCaseId === useCaseId ? { ...m, toolIds } : m
        )
      });
    } else {
      // If mapping doesn't exist, create it
      await this.addUseCaseToPersona(personaId, useCaseId, toolIds);
    }
  }

  private getToolService(): ToolService {
    if (!this.toolService) {
      this.toolService = this.injector.get(ToolService);
    }
    return this.toolService;
  }

  private async addUseCaseToTool(toolId: string, useCaseId: string) {
    const toolService = this.getToolService();
    const tool = toolService.getTool(toolId);
    if (!tool) return;

    const mappings = tool.useCaseToolMappings || [];
    const existingMapping = mappings.find(m => m.useCaseId === useCaseId);
    
    if (!existingMapping) {
      await toolService.updateTool(toolId, {
        useCaseToolMappings: [...mappings, { useCaseId, toolId }]
      });
    }
  }

  private async removeUseCaseFromTool(toolId: string, useCaseId: string) {
    const toolService = this.getToolService();
    const tool = toolService.getTool(toolId);
    if (!tool) return;

    const mappings = (tool.useCaseToolMappings || []).filter(m => m.useCaseId !== useCaseId);
    await toolService.updateTool(toolId, {
      useCaseToolMappings: mappings
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

