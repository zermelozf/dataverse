import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersonaService } from '../../services/persona.service';
import { UseCaseService } from '../../services/use-case.service';
import { ToolService } from '../../services/tool.service';
import { Persona, PersonaUseCaseMapping } from '../../models/persona';
import { UseCase } from '../../models/use-case';
import { Tool } from '../../models/tool';
import { PersonaCardComponent } from '../cards/persona-card/persona-card.component';
import { SearchInputComponent } from '../shared/search-input/search-input.component';

type PersonaFormData = {
  name: string;
  description: string;
  personaUseCaseMappings: PersonaUseCaseMapping[];
};

@Component({
  selector: 'app-personas',
  imports: [CommonModule, FormsModule, PersonaCardComponent, SearchInputComponent],
  templateUrl: './personas.component.html',
  styleUrl: './personas.component.scss'
})
export class PersonasComponent {
  searchQuery = signal('');
  
  allPersonas = computed(() => this.personaService.getPersonas()());
  personas = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.allPersonas();
    if (!query) return all;
    return all.filter(p => 
      p.name?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  });
  useCases = computed(() => this.useCaseService.getUseCases()());
  tools = computed(() => this.toolService.getTools()());
  
  showAddModal = signal(false);
  addModalErrors = signal<{ name?: string }>({});
  
  newPersona = signal<PersonaFormData>({
    name: '',
    description: '',
    personaUseCaseMappings: []
  });

  // Inline editing for name and description
  editingField = signal<{ personaId: string; field: 'name' | 'description' } | null>(null);
  editingFieldValue = signal<string>('');

  // Inline editing for use case mappings
  editingUseCase = signal<{ personaId: string; useCaseId: string } | null>(null);
  addingUseCase = signal<string | null>(null);
  useCaseSearchFilter = signal<string>('');

  constructor(
    private personaService: PersonaService,
    private useCaseService: UseCaseService,
    private toolService: ToolService
  ) {}


  // Inline editing methods
  startEditingField(persona: Persona, field: 'name' | 'description') {
    this.editingField.set({ personaId: persona.id, field });
    this.editingFieldValue.set(persona[field] || '');
  }

  cancelEditingField() {
    this.editingField.set(null);
    this.editingFieldValue.set('');
  }

  saveField(personaId: string, field: 'name' | 'description') {
    const value = this.editingFieldValue().trim();
    if (field === 'name' && !value) {
      return; // Don't save empty name
    }
    this.personaService.updatePersona(personaId, { [field]: value });
    this.cancelEditingField();
  }

  isEditingField(personaId: string, field: 'name' | 'description'): boolean {
    const editing = this.editingField();
    return editing?.personaId === personaId && editing?.field === field;
  }

  // Use case mapping inline editing
  startEditingUseCase(personaId: string, useCaseId: string) {
    this.editingUseCase.set({ personaId, useCaseId });
    this.useCaseSearchFilter.set('');
  }

  cancelEditingUseCase() {
    this.editingUseCase.set(null);
    this.useCaseSearchFilter.set('');
  }

  updateUseCaseMapping(personaId: string, oldUseCaseId: string, newUseCaseId: string) {
    if (oldUseCaseId === newUseCaseId) {
      this.cancelEditingUseCase();
      return;
    }

    const persona = this.personas().find(p => p.id === personaId);
    if (!persona) return;

    const mappings = [...(persona.personaUseCaseMappings || [])];
    const oldMapping = mappings.find(m => m.useCaseId === oldUseCaseId);
    const toolIds = oldMapping ? [...oldMapping.toolIds] : [];

    // Remove old mapping
    const filteredMappings = mappings.filter(m => m.useCaseId !== oldUseCaseId);
    
    // Add new mapping if it doesn't exist
    if (!filteredMappings.find(m => m.useCaseId === newUseCaseId)) {
      filteredMappings.push({ useCaseId: newUseCaseId, toolIds });
    }

    this.personaService.updatePersona(personaId, { personaUseCaseMappings: filteredMappings });
    this.cancelEditingUseCase();
  }

  isEditingUseCase(personaId: string, useCaseId: string): boolean {
    const editing = this.editingUseCase();
    return editing?.personaId === personaId && editing?.useCaseId === useCaseId;
  }

  getFilteredUseCases(): UseCase[] {
    const filter = this.useCaseSearchFilter().toLowerCase().trim();
    if (!filter) return this.useCases();
    
    return this.useCases().filter(uc => {
      const action = uc.action?.toLowerCase() || '';
      const goal = uc.goal?.toLowerCase() || '';
      return action.includes(filter) || goal.includes(filter);
    });
  }

  handleUseCaseInputBlur(personaId: string, useCaseId: string) {
    setTimeout(() => {
      if (!document.activeElement?.closest('.use-case-selector-container')) {
        this.cancelEditingUseCase();
      }
    }, 200);
  }

  // Adding new use case
  startAddingUseCase(personaId: string) {
    this.addingUseCase.set(personaId);
    this.useCaseSearchFilter.set('');
  }

  cancelAddingUseCase() {
    this.addingUseCase.set(null);
    this.useCaseSearchFilter.set('');
  }

  isAddingUseCase(personaId: string): boolean {
    return this.addingUseCase() === personaId;
  }

  addUseCaseToPersona(personaId: string, useCaseId: string) {
    const persona = this.personas().find(p => p.id === personaId);
    if (!persona) return;

    const mappings = [...(persona.personaUseCaseMappings || [])];
    if (!mappings.find(m => m.useCaseId === useCaseId)) {
      mappings.push({ useCaseId, toolIds: [] });
      this.personaService.updatePersona(personaId, { personaUseCaseMappings: mappings });
    }
    this.cancelAddingUseCase();
  }

  handleAddUseCaseInputBlur(personaId: string) {
    setTimeout(() => {
      if (!document.activeElement?.closest('.use-case-selector-container')) {
        this.cancelAddingUseCase();
      }
    }, 200);
  }

  removeUseCase(personaId: string, useCaseId: string) {
    const persona = this.personas().find(p => p.id === personaId);
    if (!persona) return;

    const mappings = (persona.personaUseCaseMappings || []).filter(m => m.useCaseId !== useCaseId);
    this.personaService.updatePersona(personaId, { personaUseCaseMappings: mappings });
  }

  // Tool management for use case mappings
  startEditingTools(personaId: string, useCaseId: string) {
    // This can be implemented if needed for inline tool editing
  }

  toggleToolForPersonaUseCase(personaId: string, useCaseId: string, toolId: string) {
    const persona = this.personas().find(p => p.id === personaId);
    if (!persona) return;

    const mappings = [...(persona.personaUseCaseMappings || [])];
    const mapping = mappings.find(m => m.useCaseId === useCaseId);
    
    if (mapping) {
      const toolIds = [...(mapping.toolIds || [])];
      if (toolIds.includes(toolId)) {
        mapping.toolIds = toolIds.filter(id => id !== toolId);
      } else {
        mapping.toolIds = [...toolIds, toolId];
      }
      this.personaService.updatePersona(personaId, { personaUseCaseMappings: mappings });
    }
  }

  isToolSelectedForPersonaUseCase(persona: Persona, useCaseId: string, toolId: string): boolean {
    const mapping = persona.personaUseCaseMappings?.find(m => m.useCaseId === useCaseId);
    return mapping ? mapping.toolIds.includes(toolId) : false;
  }

  // Modal methods
  openAddModal() {
    this.newPersona.set({ 
      name: '', 
      description: '', 
      personaUseCaseMappings: [] 
    });
    this.addModalErrors.set({});
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  // Modal methods for adding new persona
  toggleUseCase(useCaseId: string) {
    const mappings = this.newPersona().personaUseCaseMappings;
    const existingMapping = mappings.find(m => m.useCaseId === useCaseId);
    
    if (existingMapping) {
      // Remove use case and its mapping
      this.newPersona.update((p: PersonaFormData) => ({
        ...p,
        personaUseCaseMappings: mappings.filter(m => m.useCaseId !== useCaseId)
      }));
    } else {
      // Add use case with empty tool mapping
      this.newPersona.update((p: PersonaFormData) => ({
        ...p,
        personaUseCaseMappings: [...mappings, { useCaseId, toolIds: [] }]
      }));
    }
  }

  toggleToolForUseCase(useCaseId: string, toolId: string) {
    const mappings = this.newPersona().personaUseCaseMappings;
    const mapping = mappings.find(m => m.useCaseId === useCaseId);
    
    if (mapping) {
      const toolIds = mapping.toolIds;
      if (toolIds.includes(toolId)) {
        mapping.toolIds = toolIds.filter((id: string) => id !== toolId);
      } else {
        mapping.toolIds = [...toolIds, toolId];
      }
      this.newPersona.update((p: PersonaFormData) => ({
        ...p,
        personaUseCaseMappings: [...mappings]
      }));
    }
  }

  isUseCaseSelected(useCaseId: string): boolean {
    return this.newPersona().personaUseCaseMappings.some(m => m.useCaseId === useCaseId);
  }

  isToolSelectedForUseCase(useCaseId: string, toolId: string): boolean {
    const mapping = this.newPersona().personaUseCaseMappings.find(m => m.useCaseId === useCaseId);
    return mapping ? mapping.toolIds.includes(toolId) : false;
  }

  addPersona() {
    const errors: { name?: string } = {};
    
    if (!this.newPersona().name.trim()) {
      errors.name = 'Name is required';
    }
    
    this.addModalErrors.set(errors);
    
    if (Object.keys(errors).length === 0) {
      this.personaService.addPersona(this.newPersona());
      this.closeAddModal();
    }
  }

  deletePersona(id: string) {
    if (confirm('Are you sure you want to delete this persona?')) {
      this.personaService.deletePersona(id);
    }
  }

  getUseCaseName(id: string): string {
    const useCase = this.useCases().find(uc => uc.id === id);
    if (!useCase) return 'Unknown';
    return useCase.action || 'Unnamed use case';
  }

  getPersonaName(id: string): string {
    return this.personas().find(p => p.id === id)?.name || 'Unknown';
  }

  getToolName(id: string): string {
    return this.tools().find(t => t.id === id)?.name || 'Unknown';
  }

  isUseCaseMappedToPersona(persona: Persona, useCaseId: string): boolean {
    return (persona.personaUseCaseMappings || []).some(m => m.useCaseId === useCaseId);
  }
}

