import { Injectable, signal, effect, Injector } from '@angular/core';
import { Tool } from '../models/tool';
import { DatabaseService } from './database.service';
import { UseCaseService } from './use-case.service';

@Injectable({
  providedIn: 'root'
})
export class ToolService {
  private tools = signal<Tool[]>([]);
  private initialized = false;
  private useCaseService: UseCaseService | null = null;

  constructor(
    private db: DatabaseService,
    private injector: Injector
  ) {
    this.loadData();
    
    effect(() => {
      if (this.initialized) {
        this.saveTools();
      }
    });
  }

  private async loadData() {
    try {
      const tools = await this.db.tools.toArray();
      const toolsWithDates = tools.map((t: any) => ({
        ...t,
        useCaseToolMappings: t.useCaseToolMappings || [],
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt)
      }));
      this.tools.set(toolsWithDates);
      this.initialized = true;
    } catch (error) {
      console.error('Error loading tools from IndexedDB:', error);
      this.initialized = true;
    }
  }

  private async saveTools() {
    try {
      await this.db.tools.bulkPut(this.tools());
    } catch (error) {
      console.error('Error saving tools to IndexedDB:', error);
    }
  }

  getTools() {
    return this.tools.asReadonly();
  }

  getTool(id: string): Tool | undefined {
    return this.tools().find(tool => tool.id === id);
  }

  async addTool(tool: Omit<Tool, 'id' | 'createdAt' | 'updatedAt'>) {
    const toolId = this.generateId();
    const mappings = (tool.useCaseToolMappings || []).map(m => ({
      ...m,
      toolId // Ensure toolId is set
    }));
    
    const newTool: Tool = {
      ...tool,
      useCaseToolMappings: mappings,
      id: toolId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.tools.update(tools => [...tools, newTool]);
    // Explicitly save to ensure persistence
    await this.saveTools();
    
    // Update use cases' useCaseToolMappings
    for (const mapping of mappings) {
      await this.addToolToUseCase(mapping.useCaseId, newTool.id);
    }
    
    return newTool;
  }

  async updateTool(id: string, updates: Partial<Tool>) {
    const currentTool = this.tools().find(t => t.id === id);
    if (!currentTool) return;

    const oldMappings = currentTool.useCaseToolMappings || [];
    const newMappings = updates.useCaseToolMappings;

    this.tools.update(tools =>
      tools.map(tool =>
        tool.id === id
          ? { ...tool, ...updates, updatedAt: new Date() }
          : tool
      )
    );
    // Explicitly save to ensure persistence
    await this.saveTools();

    // Update use cases if mappings changed
    if (newMappings) {
      const oldUseCaseIds = oldMappings.map(m => m.useCaseId);
      const newUseCaseIds = newMappings.map(m => m.useCaseId);
      
      // Remove from use cases that are no longer mapped
      for (const useCaseId of oldUseCaseIds) {
        if (!newUseCaseIds.includes(useCaseId)) {
          await this.removeToolFromUseCase(useCaseId, id);
        }
      }
      
      // Add to new use cases
      for (const mapping of newMappings) {
        if (!oldUseCaseIds.includes(mapping.useCaseId)) {
          await this.addToolToUseCase(mapping.useCaseId, id);
        }
      }
    }
  }

  async deleteTool(id: string) {
    const tool = this.tools().find(t => t.id === id);
    
    // Remove from use cases' useCaseToolMappings
    if (tool) {
      for (const mapping of (tool.useCaseToolMappings || [])) {
        await this.removeToolFromUseCase(mapping.useCaseId, id);
      }
    }

    this.tools.update(tools => tools.filter(tool => tool.id !== id));
    try {
      await this.db.tools.delete(id);
    } catch (error) {
      console.error('Error deleting tool from IndexedDB:', error);
    }
  }

  private getUseCaseService(): UseCaseService {
    if (!this.useCaseService) {
      this.useCaseService = this.injector.get(UseCaseService);
    }
    return this.useCaseService;
  }

  private async addToolToUseCase(useCaseId: string, toolId: string) {
    const useCaseService = this.getUseCaseService();
    const useCase = useCaseService.getUseCase(useCaseId);
    if (!useCase) return;

    const mappings = useCase.useCaseToolMappings || [];
    const existingMapping = mappings.find(m => m.toolId === toolId);
    
    if (!existingMapping) {
      await useCaseService.updateUseCase(useCaseId, {
        useCaseToolMappings: [...mappings, { useCaseId, toolId }]
      });
    }
  }

  private async removeToolFromUseCase(useCaseId: string, toolId: string) {
    const useCaseService = this.getUseCaseService();
    const useCase = useCaseService.getUseCase(useCaseId);
    if (!useCase) return;

    const mappings = (useCase.useCaseToolMappings || []).filter(m => m.toolId !== toolId);
    await useCaseService.updateUseCase(useCaseId, {
      useCaseToolMappings: mappings
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

