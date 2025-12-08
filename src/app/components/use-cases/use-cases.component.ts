import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UseCaseService } from '../../services/use-case.service';
import { ToolService } from '../../services/tool.service';
import { PersonaService } from '../../services/persona.service';
import { UseCase } from '../../models/use-case';
import { Tool } from '../../models/tool';
import { Persona } from '../../models/persona';
import { UseCaseCardComponent } from '../cards/use-case-card/use-case-card.component';
import { SearchInputComponent } from '../shared/search-input/search-input.component';

@Component({
  selector: 'app-use-cases',
  imports: [CommonModule, FormsModule, UseCaseCardComponent, SearchInputComponent],
  templateUrl: './use-cases.component.html',
  styleUrl: './use-cases.component.scss'
})
export class UseCasesComponent {
  searchQuery = signal('');
  
  allUseCases = computed(() => this.useCaseService.getUseCases()());
  useCases = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.allUseCases();
    if (!query) return all;
    return all.filter(uc => 
      uc.name?.toLowerCase().includes(query) ||
      uc.action?.toLowerCase().includes(query) ||
      uc.goal?.toLowerCase().includes(query)
    );
  });
  tools = computed(() => this.toolService.getTools()());
  personas = computed(() => this.personaService.getPersonas()());
  
  showAddModal = signal(false);
  addModalErrors = signal<{ name?: string; persona?: string; action?: string; goal?: string }>({});
  
  editingField = signal<{ useCaseId: string; field: string } | null>(null);
  editingFieldValue = signal<string>('');
  
  editingPersona = signal<{ useCaseId: string } | null>(null);
  editingPersonaInModal = signal(false);
  personaSearchFilter = signal<string>('');
  personaSearchFilterModal = signal<string>('');
  newPersonaName = signal<string>('');
  
  editingTool = signal<{ useCaseId: string; toolId: string } | null>(null);
  addingTool = signal<string | null>(null); // useCaseId
  toolSearchFilter = signal<string>('');
  
  // Modal tool editing
  addingToolInModal = signal(false);
  toolSearchFilterModal = signal<string>('');
  
  newUseCase = signal({
    name: '',
    persona: '',
    action: '',
    goal: '',
    useCaseToolMappings: [] as { useCaseId: string; toolId: string }[]
  });

  constructor(
    private useCaseService: UseCaseService,
    private toolService: ToolService,
    private personaService: PersonaService
  ) {}

  // Individual field editing with auto-save
  startEditingField(useCase: UseCase, field: 'name' | 'action' | 'goal') {
    this.editingField.set({ useCaseId: useCase.id, field });
    this.editingFieldValue.set(useCase[field] || '');
  }

  startEditingPersona(useCase: UseCase) {
    this.editingPersona.set({ useCaseId: useCase.id });
    const currentPersona = this.personas().find(p => p.id === useCase.persona);
    this.personaSearchFilter.set(currentPersona?.name || '');
    this.newPersonaName.set('');
  }

  cancelEditingPersona() {
    this.editingPersona.set(null);
    this.personaSearchFilter.set('');
    this.newPersonaName.set('');
  }

  handlePersonaInputBlur(useCaseId: string) {
    // Only cancel if no selection was made
    setTimeout(() => {
      if (this.isEditingPersona(useCaseId)) {
        this.cancelEditingPersona();
      }
    }, 200);
  }

  updatePersona(useCaseId: string, personaId: string) {
    this.useCaseService.updateUseCase(useCaseId, { persona: personaId });
    this.cancelEditingPersona();
  }

  async createAndAssignPersona(useCaseId: string) {
    const name = this.personaSearchFilter().trim();
    if (!name) return;

    // Create new persona
    const newPersona = await this.personaService.addPersona({
      name,
      description: '',
      personaUseCaseMappings: []
    });

    // Assign to use case
    this.updatePersona(useCaseId, newPersona.id);
  }

  async createAndAssignPersonaInModal() {
    const name = this.personaSearchFilterModal().trim();
    if (!name) return;

    // Create new persona
    const newPersona = await this.personaService.addPersona({
      name,
      description: '',
      personaUseCaseMappings: []
    });

    // Assign to new use case
    this.newUseCase.update(uc => ({ ...uc, persona: newPersona.id }));
    this.editingPersonaInModal.set(false);
    this.personaSearchFilterModal.set('');
  }

  assignPersonaInModal(personaId: string) {
    this.newUseCase.update(uc => ({ ...uc, persona: personaId }));
    this.editingPersonaInModal.set(false);
    this.personaSearchFilterModal.set('');
  }

  handlePersonaModalBlur() {
    setTimeout(() => {
      this.editingPersonaInModal.set(false);
    }, 200);
  }

  getFilteredPersonasForModal(): Persona[] {
    const filter = this.personaSearchFilterModal().toLowerCase().trim();
    if (!filter) {
      return this.personas();
    }
    return this.personas().filter(p => 
      p.name.toLowerCase().includes(filter)
    );
  }

  canCreatePersonaInModal(): boolean {
    const filter = this.personaSearchFilterModal().trim();
    if (!filter) return false;
    return !this.personas().some(p => 
      p.name.toLowerCase() === filter.toLowerCase()
    );
  }

  isEditingPersona(useCaseId: string): boolean {
    const editing = this.editingPersona();
    return editing?.useCaseId === useCaseId;
  }

  getFilteredPersonas(): Persona[] {
    const filter = this.personaSearchFilter().toLowerCase().trim();
    if (!filter) {
      return this.personas();
    }
    return this.personas().filter(p => 
      p.name.toLowerCase().includes(filter)
    );
  }

  canCreatePersona(): boolean {
    const filter = this.personaSearchFilter().trim();
    if (!filter) return false;
    // Check if a persona with this name already exists
    return !this.personas().some(p => 
      p.name.toLowerCase() === filter.toLowerCase()
    );
  }

  cancelEditingField() {
    this.editingField.set(null);
    this.editingFieldValue.set('');
  }

  saveField(useCaseId: string, field: 'name' | 'action' | 'goal') {
    const value = this.editingFieldValue().trim();
    if (!value) {
      this.cancelEditingField();
      return;
    }
    
    this.useCaseService.updateUseCase(useCaseId, { [field]: value });
    this.cancelEditingField();
  }

  isEditingField(useCaseId: string, field: string): boolean {
    const editing = this.editingField();
    return editing?.useCaseId === useCaseId && editing?.field === field;
  }

  // Tools inline editing
  startEditingTool(useCaseId: string, toolId: string) {
    this.editingTool.set({ useCaseId, toolId });
    const tool = this.tools().find(t => t.id === toolId);
    this.toolSearchFilter.set(tool?.name || '');
  }

  cancelEditingTool() {
    this.editingTool.set(null);
    this.toolSearchFilter.set('');
  }

  startAddingTool(useCaseId: string) {
    this.addingTool.set(useCaseId);
    this.toolSearchFilter.set('');
  }

  cancelAddingTool() {
    this.addingTool.set(null);
    this.toolSearchFilter.set('');
  }

  isEditingTool(useCaseId: string, toolId: string): boolean {
    const editing = this.editingTool();
    return editing?.useCaseId === useCaseId && editing?.toolId === toolId;
  }

  isAddingTool(useCaseId: string): boolean {
    return this.addingTool() === useCaseId;
  }

  getFilteredTools() {
    const filter = this.toolSearchFilter().toLowerCase().trim();
    if (!filter) return this.tools();
    return this.tools().filter(tool => 
      tool.name.toLowerCase().includes(filter)
    );
  }

  canCreateTool(): boolean {
    const filter = this.toolSearchFilter().trim();
    if (!filter) return false;
    // Check if a tool with this name already exists
    const exists = this.tools().some(tool => 
      tool.name.toLowerCase() === filter.toLowerCase()
    );
    return !exists && filter.length > 0;
  }

  updateToolMapping(useCaseId: string, oldToolId: string, newToolId: string) {
    const useCase = this.useCases().find(uc => uc.id === useCaseId);
    if (!useCase) return;

    const mappings = (useCase.useCaseToolMappings || []).map(m => 
      m.toolId === oldToolId ? { ...m, toolId: newToolId } : m
    );
    
    this.useCaseService.updateUseCase(useCaseId, { useCaseToolMappings: mappings });
    this.cancelEditingTool();
  }

  async createAndUpdateToolMapping(useCaseId: string, oldToolId: string) {
    const toolName = this.toolSearchFilter().trim();
    if (!toolName) return;

    try {
      const newTool = await this.toolService.addTool({
        name: toolName,
        description: '',
        useCaseToolMappings: []
      });
      
      this.updateToolMapping(useCaseId, oldToolId, newTool.id);
    } catch (error) {
      console.error('Error creating tool:', error);
    }
  }

  addToolToUseCase(useCaseId: string, toolId: string) {
    const useCase = this.useCases().find(uc => uc.id === useCaseId);
    if (!useCase) return;

    // Check if tool is already linked
    const existing = (useCase.useCaseToolMappings || []).find(m => m.toolId === toolId);
    if (existing) {
      this.cancelAddingTool();
      return;
    }

    const mappings = [...(useCase.useCaseToolMappings || []), { useCaseId, toolId }];
    this.useCaseService.updateUseCase(useCaseId, { useCaseToolMappings: mappings });
    this.cancelAddingTool();
  }

  async createAndAddTool(useCaseId: string) {
    const toolName = this.toolSearchFilter().trim();
    if (!toolName) return;

    try {
      const newTool = await this.toolService.addTool({
        name: toolName,
        description: '',
        useCaseToolMappings: []
      });
      
      this.addToolToUseCase(useCaseId, newTool.id);
    } catch (error) {
      console.error('Error creating tool:', error);
    }
  }

  removeTool(useCaseId: string, toolId: string) {
    const useCase = this.useCases().find(uc => uc.id === useCaseId);
    if (!useCase) return;

    const mappings = (useCase.useCaseToolMappings || []).filter(m => m.toolId !== toolId);
    this.useCaseService.updateUseCase(useCaseId, { useCaseToolMappings: mappings });
  }

  handleToolInputBlur(useCaseId: string, toolId: string) {
    setTimeout(() => {
      if (this.isEditingTool(useCaseId, toolId)) {
        this.cancelEditingTool();
      }
    }, 200);
  }

  handleAddToolInputBlur(useCaseId: string) {
    setTimeout(() => {
      if (this.isAddingTool(useCaseId)) {
        this.cancelAddingTool();
      }
    }, 200);
  }

  // Modal for adding new use case
  openAddModal() {
    this.newUseCase.set({ name: '', persona: '', action: '', goal: '', useCaseToolMappings: [] });
    this.editingPersonaInModal.set(false);
    this.personaSearchFilterModal.set('');
    this.addingToolInModal.set(false);
    this.toolSearchFilterModal.set('');
    this.addModalErrors.set({});
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  startAddingToolInModal() {
    this.addingToolInModal.set(true);
    this.toolSearchFilterModal.set('');
  }

  cancelAddingToolInModal() {
    this.addingToolInModal.set(false);
    this.toolSearchFilterModal.set('');
  }

  getFilteredToolsForModal() {
    const filter = this.toolSearchFilterModal().toLowerCase().trim();
    if (!filter) return this.tools();
    return this.tools().filter(tool => 
      tool.name.toLowerCase().includes(filter)
    );
  }

  canCreateToolInModal(): boolean {
    const filter = this.toolSearchFilterModal().trim();
    if (!filter) return false;
    const exists = this.tools().some(tool => 
      tool.name.toLowerCase() === filter.toLowerCase()
    );
    return !exists && filter.length > 0;
  }

  addToolToUseCaseInModal(toolId: string) {
    const mappings = this.newUseCase().useCaseToolMappings;
    const existing = mappings.find(m => m.toolId === toolId);
    if (existing) {
      this.cancelAddingToolInModal();
      return;
    }

    this.newUseCase.update(uc => ({
      ...uc,
      useCaseToolMappings: [...mappings, { useCaseId: '', toolId }]
    }));
    this.cancelAddingToolInModal();
  }

  async createAndAddToolInModal() {
    const toolName = this.toolSearchFilterModal().trim();
    if (!toolName) return;

    try {
      const newTool = await this.toolService.addTool({
        name: toolName,
        description: '',
        useCaseToolMappings: []
      });
      
      this.addToolToUseCaseInModal(newTool.id);
    } catch (error) {
      console.error('Error creating tool:', error);
    }
  }

  removeToolFromModal(toolId: string) {
    const mappings = this.newUseCase().useCaseToolMappings.filter(m => m.toolId !== toolId);
    this.newUseCase.update(uc => ({
      ...uc,
      useCaseToolMappings: mappings
    }));
  }

  handleToolModalInputBlur() {
    setTimeout(() => {
      if (this.addingToolInModal()) {
        this.cancelAddingToolInModal();
      }
    }, 200);
  }

  addUseCase() {
    if (this.newUseCase().name.trim() && this.newUseCase().action.trim() && this.newUseCase().goal.trim()) {
      this.useCaseService.addUseCase(this.newUseCase());
      this.closeAddModal();
    }
  }

  deleteUseCase(id: string) {
    if (confirm('Are you sure you want to delete this use case?')) {
      this.useCaseService.deleteUseCase(id);
    }
  }

  getToolName(toolId: string): string {
    return this.tools().find(t => t.id === toolId)?.name || 'Unknown';
  }

  getPersonaName(personaId: string): string {
    return this.personas().find(p => p.id === personaId)?.name || 'Unknown';
  }
}

