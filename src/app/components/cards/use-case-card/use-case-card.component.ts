import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UseCaseService } from '../../../services/use-case.service';
import { ToolService } from '../../../services/tool.service';
import { PersonaService } from '../../../services/persona.service';
import { UseCase } from '../../../models/use-case';
import { Persona } from '../../../models/persona';
import { Tool } from '../../../models/tool';

@Component({
  selector: 'app-use-case-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './use-case-card.component.html',
  styleUrl: './use-case-card.component.scss'
})
export class UseCaseCardComponent {
  useCase = input.required<UseCase>();

  personas = computed(() => this.personaService.getPersonas()());
  tools = computed(() => this.toolService.getTools()());

  // Inline editing for action, goal, version
  editingField = signal<{ field: 'action' | 'goal' | 'currentVersion' | 'targetVersion' } | null>(null);
  editingFieldValue = signal<string>('');

  // Persona editing
  editingPersona = signal<boolean>(false);
  personaSearchFilter = signal<string>('');

  // Tool editing
  editingTool = signal<string | null>(null); // toolId
  addingTool = signal<boolean>(false);
  toolSearchFilter = signal<string>('');

  constructor(
    private useCaseService: UseCaseService,
    private toolService: ToolService,
    private personaService: PersonaService
  ) {}

  // Field editing methods
  startEditingField(field: 'action' | 'goal' | 'currentVersion' | 'targetVersion') {
    this.editingField.set({ field });
    this.editingFieldValue.set(this.useCase()[field] || '');
  }

  cancelEditingField() {
    this.editingField.set(null);
    this.editingFieldValue.set('');
  }

  saveField(field: 'action' | 'goal' | 'currentVersion' | 'targetVersion') {
    const value = this.editingFieldValue().trim();
    // Version fields can be empty, but action and goal are required
    if (!value && (field === 'action' || field === 'goal')) {
      this.cancelEditingField();
      return;
    }
    this.useCaseService.updateUseCase(this.useCase().id, { [field]: value || undefined });
    this.cancelEditingField();
  }

  isEditingField(field: 'action' | 'goal' | 'currentVersion' | 'targetVersion'): boolean {
    const editing = this.editingField();
    return editing?.field === field;
  }

  // Persona editing methods
  startEditingPersona() {
    this.editingPersona.set(true);
    const currentPersona = this.useCase().persona ? this.personas().find(p => p.id === this.useCase().persona) : null;
    this.personaSearchFilter.set(currentPersona?.name || '');
  }

  cancelEditingPersona() {
    this.editingPersona.set(false);
    this.personaSearchFilter.set('');
  }

  isEditingPersona(): boolean {
    return this.editingPersona();
  }

  updatePersona(personaId: string) {
    this.useCaseService.updateUseCase(this.useCase().id, { persona: personaId });
    this.cancelEditingPersona();
  }

  async createAndAssignPersona() {
    const name = this.personaSearchFilter().trim();
    if (!name) return;

    const newPersona = await this.personaService.addPersona({
      name,
      description: '',
      personaUseCaseMappings: []
    });

    this.updatePersona(newPersona.id);
  }

  handlePersonaInputBlur() {
    setTimeout(() => {
      if (this.isEditingPersona()) {
        this.cancelEditingPersona();
      }
    }, 200);
  }

  getFilteredPersonas(): Persona[] {
    const filter = this.personaSearchFilter().toLowerCase().trim();
    if (!filter) return this.personas();
    return this.personas().filter(p => p.name.toLowerCase().includes(filter));
  }

  canCreatePersona(): boolean {
    const filter = this.personaSearchFilter().trim();
    if (!filter) return false;
    return !this.personas().some(p => p.name.toLowerCase() === filter.toLowerCase());
  }

  // Tool editing methods
  startEditingTool(toolId: string) {
    this.editingTool.set(toolId);
    const tool = this.tools().find(t => t.id === toolId);
    this.toolSearchFilter.set(tool?.name || '');
  }

  cancelEditingTool() {
    this.editingTool.set(null);
    this.toolSearchFilter.set('');
  }

  isEditingTool(toolId: string): boolean {
    return this.editingTool() === toolId;
  }

  startAddingTool() {
    this.addingTool.set(true);
    this.toolSearchFilter.set('');
  }

  cancelAddingTool() {
    this.addingTool.set(false);
    this.toolSearchFilter.set('');
  }

  isAddingTool(): boolean {
    return this.addingTool();
  }

  getFilteredTools(): Tool[] {
    const filter = this.toolSearchFilter().toLowerCase().trim();
    if (!filter) return this.tools();
    return this.tools().filter(tool => tool.name.toLowerCase().includes(filter));
  }

  canCreateTool(): boolean {
    const filter = this.toolSearchFilter().trim();
    if (!filter) return false;
    return !this.tools().some(tool => tool.name.toLowerCase() === filter.toLowerCase());
  }

  updateToolMapping(oldToolId: string, newToolId: string) {
    const useCase = this.useCase();
    const mappings = (useCase.useCaseToolMappings || []).map(m => 
      m.toolId === oldToolId ? { ...m, toolId: newToolId } : m
    );
    
    this.useCaseService.updateUseCase(useCase.id, { useCaseToolMappings: mappings });
    this.cancelEditingTool();
  }

  async createAndUpdateToolMapping(oldToolId: string) {
    const toolName = this.toolSearchFilter().trim();
    if (!toolName) return;

    try {
      const newTool = await this.toolService.addTool({
        name: toolName,
        description: '',
        useCaseToolMappings: []
      });
      
      this.updateToolMapping(oldToolId, newTool.id);
    } catch (error) {
      console.error('Error creating tool:', error);
    }
  }

  addToolToUseCase(toolId: string) {
    const useCase = this.useCase();
    const existing = (useCase.useCaseToolMappings || []).find(m => m.toolId === toolId);
    if (existing) {
      this.cancelAddingTool();
      return;
    }

    const mappings = [...(useCase.useCaseToolMappings || []), { useCaseId: useCase.id, toolId }];
    this.useCaseService.updateUseCase(useCase.id, { useCaseToolMappings: mappings });
    
    // Also update tool's useCaseToolMappings (bidirectional)
    const tool = this.tools().find(t => t.id === toolId);
    if (tool) {
      const toolMappings = [...(tool.useCaseToolMappings || []), { useCaseId: useCase.id, toolId }];
      this.toolService.updateTool(toolId, { useCaseToolMappings: toolMappings });
    }
    
    this.cancelAddingTool();
  }

  async createAndAddTool() {
    const toolName = this.toolSearchFilter().trim();
    if (!toolName) return;

    try {
      const newTool = await this.toolService.addTool({
        name: toolName,
        description: '',
        useCaseToolMappings: []
      });
      
      this.addToolToUseCase(newTool.id);
    } catch (error) {
      console.error('Error creating tool:', error);
    }
  }

  removeTool(toolId: string) {
    const useCase = this.useCase();
    const mappings = (useCase.useCaseToolMappings || []).filter(m => m.toolId !== toolId);
    this.useCaseService.updateUseCase(useCase.id, { useCaseToolMappings: mappings });

    // Also update tool's useCaseToolMappings (bidirectional)
    const tool = this.tools().find(t => t.id === toolId);
    if (tool) {
      const toolMappings = (tool.useCaseToolMappings || []).filter(m => m.useCaseId !== useCase.id);
      this.toolService.updateTool(toolId, { useCaseToolMappings: toolMappings });
    }
  }

  handleToolInputBlur(toolId: string) {
    setTimeout(() => {
      if (this.isEditingTool(toolId)) {
        this.cancelEditingTool();
      }
    }, 200);
  }

  handleAddToolInputBlur() {
    setTimeout(() => {
      if (this.isAddingTool()) {
        this.cancelAddingTool();
      }
    }, 200);
  }

  deleteUseCase() {
    if (confirm('Are you sure you want to delete this use case?')) {
      this.useCaseService.deleteUseCase(this.useCase().id);
    }
  }

  duplicateUseCase() {
    const currentUseCase = this.useCase();
    this.useCaseService.addUseCase({
      persona: currentUseCase.persona,
      action: `${currentUseCase.action} (Copy)`,
      goal: currentUseCase.goal,
      useCaseToolMappings: currentUseCase.useCaseToolMappings.map(m => ({
        useCaseId: '', // Will be set by the service
        toolId: m.toolId
      })),
      currentVersion: currentUseCase.currentVersion || 'v0',
      targetVersion: currentUseCase.targetVersion || 'v0'
    });
  }

  getToolName(toolId: string): string {
    return this.tools().find(t => t.id === toolId)?.name || 'Unknown';
  }

  getPersonaName(personaId: string): string {
    return this.personas().find((p: Persona) => p.id === personaId)?.name || 'Unknown';
  }
}

