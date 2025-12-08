import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersonaService } from '../../../services/persona.service';
import { UseCaseService } from '../../../services/use-case.service';
import { ToolService } from '../../../services/tool.service';
import { KPIService } from '../../../services/kpi.service';
import { Persona } from '../../../models/persona';
import { UseCase } from '../../../models/use-case';
import { KPI } from '../../../models/kpi';

@Component({
  selector: 'app-persona-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './persona-card.component.html',
  styleUrl: './persona-card.component.scss'
})
export class PersonaCardComponent {
  persona = input.required<Persona>();

  personas = computed(() => this.personaService.getPersonas()());
  useCases = computed(() => this.useCaseService.getUseCases()());
  tools = computed(() => this.toolService.getTools()());
  kpis = computed(() => this.kpiService.getKPIs()());
  
  // Get KPIs for this persona
  personaKPIs = computed(() => {
    const kpiIds = this.persona().kpiIds || [];
    return this.kpis().filter(k => kpiIds.includes(k.id));
  });

  // Inline editing for name and description
  editingField = signal<{ field: 'name' | 'description' } | null>(null);
  editingFieldValue = signal<string>('');

  // Inline editing for use case mappings
  editingUseCase = signal<string | null>(null); // useCaseId
  addingUseCase = signal<boolean>(false);
  useCaseSearchFilter = signal<string>('');

  // KPI management
  addingKPI = signal<boolean>(false);
  kpiSearchFilter = signal<string>('');

  constructor(
    private personaService: PersonaService,
    private useCaseService: UseCaseService,
    private toolService: ToolService,
    private kpiService: KPIService
  ) {}

  // Inline editing methods
  startEditingField(field: 'name' | 'description') {
    this.editingField.set({ field });
    this.editingFieldValue.set(this.persona()[field] || '');
  }

  cancelEditingField() {
    this.editingField.set(null);
    this.editingFieldValue.set('');
  }

  saveField(field: 'name' | 'description') {
    const value = this.editingFieldValue().trim();
    if (field === 'name' && !value) {
      return; // Don't save empty name
    }
    this.personaService.updatePersona(this.persona().id, { [field]: value });
    this.cancelEditingField();
  }

  isEditingField(field: 'name' | 'description'): boolean {
    const editing = this.editingField();
    return editing?.field === field;
  }

  // Use case mapping inline editing
  startEditingUseCase(useCaseId: string) {
    this.editingUseCase.set(useCaseId);
    this.useCaseSearchFilter.set('');
  }

  cancelEditingUseCase() {
    this.editingUseCase.set(null);
    this.useCaseSearchFilter.set('');
  }

  updateUseCaseMapping(oldUseCaseId: string, newUseCaseId: string) {
    if (oldUseCaseId === newUseCaseId) {
      this.cancelEditingUseCase();
      return;
    }

    const persona = this.persona();
    const mappings = [...(persona.personaUseCaseMappings || [])];
    const oldMapping = mappings.find(m => m.useCaseId === oldUseCaseId);
    const toolIds = oldMapping ? [...oldMapping.toolIds] : [];

    const filteredMappings = mappings.filter(m => m.useCaseId !== oldUseCaseId);
    if (!filteredMappings.find(m => m.useCaseId === newUseCaseId)) {
      filteredMappings.push({ useCaseId: newUseCaseId, toolIds });
    }

    this.personaService.updatePersona(persona.id, { personaUseCaseMappings: filteredMappings });
    this.cancelEditingUseCase();
  }

  isEditingUseCase(useCaseId: string): boolean {
    return this.editingUseCase() === useCaseId;
  }

  getFilteredUseCases(): UseCase[] {
    const filter = this.useCaseSearchFilter().toLowerCase().trim();
    if (!filter) return this.useCases();
    
    return this.useCases().filter(uc => {
      const name = uc.name?.toLowerCase() || '';
      const action = uc.action?.toLowerCase() || '';
      const goal = uc.goal?.toLowerCase() || '';
      return name.includes(filter) || action.includes(filter) || goal.includes(filter);
    });
  }

  handleUseCaseInputBlur(useCaseId: string) {
    setTimeout(() => {
      if (!document.activeElement?.closest('.use-case-selector-container')) {
        this.cancelEditingUseCase();
      }
    }, 200);
  }

  // Adding new use case
  startAddingUseCase() {
    this.addingUseCase.set(true);
    this.useCaseSearchFilter.set('');
  }

  cancelAddingUseCase() {
    this.addingUseCase.set(false);
    this.useCaseSearchFilter.set('');
  }

  isAddingUseCase(): boolean {
    return this.addingUseCase();
  }

  addUseCaseToPersona(useCaseId: string) {
    const persona = this.persona();
    const mappings = [...(persona.personaUseCaseMappings || [])];
    if (!mappings.find(m => m.useCaseId === useCaseId)) {
      mappings.push({ useCaseId, toolIds: [] });
      this.personaService.updatePersona(persona.id, { personaUseCaseMappings: mappings });
    }
    this.cancelAddingUseCase();
  }

  handleAddUseCaseInputBlur() {
    setTimeout(() => {
      if (!document.activeElement?.closest('.use-case-selector-container')) {
        this.cancelAddingUseCase();
      }
    }, 200);
  }

  removeUseCase(useCaseId: string) {
    const persona = this.persona();
    const mappings = (persona.personaUseCaseMappings || []).filter(m => m.useCaseId !== useCaseId);
    this.personaService.updatePersona(persona.id, { personaUseCaseMappings: mappings });
  }

  toggleToolForPersonaUseCase(useCaseId: string, toolId: string) {
    const persona = this.persona();
    const mappings = [...(persona.personaUseCaseMappings || [])];
    const mapping = mappings.find(m => m.useCaseId === useCaseId);
    
    if (mapping) {
      const toolIds = [...(mapping.toolIds || [])];
      if (toolIds.includes(toolId)) {
        mapping.toolIds = toolIds.filter(id => id !== toolId);
      } else {
        mapping.toolIds = [...toolIds, toolId];
      }
      this.personaService.updatePersona(persona.id, { personaUseCaseMappings: mappings });
    }
  }

  deletePersona() {
    if (confirm('Are you sure you want to delete this persona?')) {
      this.personaService.deletePersona(this.persona().id);
    }
  }

  getUseCaseName(id: string): string {
    const useCase = this.useCases().find(uc => uc.id === id);
    if (!useCase) return 'Unknown';
    return useCase.action || 'Unnamed use case';
  }

  getPersonaName(id: string): string {
    return this.personas().find((p: Persona) => p.id === id)?.name || 'Unknown';
  }

  getToolName(id: string): string {
    return this.tools().find(t => t.id === id)?.name || 'Unknown';
  }

  isUseCaseMappedToPersona(useCaseId: string): boolean {
    return (this.persona().personaUseCaseMappings || []).some(m => m.useCaseId === useCaseId);
  }

  // KPI management methods
  startAddingKPI() {
    this.addingKPI.set(true);
    this.kpiSearchFilter.set('');
  }

  cancelAddingKPI() {
    this.addingKPI.set(false);
    this.kpiSearchFilter.set('');
  }

  isAddingKPI(): boolean {
    return this.addingKPI();
  }

  getFilteredKPIs(): KPI[] {
    const filter = this.kpiSearchFilter().toLowerCase().trim();
    const currentKpiIds = this.persona().kpiIds || [];
    // Filter out already assigned KPIs
    const availableKPIs = this.kpis().filter(k => !currentKpiIds.includes(k.id));
    
    if (!filter) return availableKPIs;
    
    return availableKPIs.filter(k => 
      k.name?.toLowerCase().includes(filter) ||
      k.description?.toLowerCase().includes(filter)
    );
  }

  canCreateKPI(): boolean {
    const filter = this.kpiSearchFilter().trim();
    if (!filter) return false;
    return !this.kpis().some(k => k.name.toLowerCase() === filter.toLowerCase());
  }

  addKPIToPersona(kpiId: string) {
    const persona = this.persona();
    const kpiIds = [...(persona.kpiIds || [])];
    if (!kpiIds.includes(kpiId)) {
      kpiIds.push(kpiId);
      this.personaService.updatePersona(persona.id, { kpiIds });
    }
    this.cancelAddingKPI();
  }

  async createAndAddKPI() {
    const name = this.kpiSearchFilter().trim();
    if (!name) return;

    const newKPI = await this.kpiService.addKPI({
      name,
      description: '',
      unit: '',
      targetValue: ''
    });

    const persona = this.persona();
    const kpiIds = [...(persona.kpiIds || []), newKPI.id];
    this.personaService.updatePersona(persona.id, { kpiIds });
    this.cancelAddingKPI();
  }

  removeKPI(kpiId: string) {
    const persona = this.persona();
    const kpiIds = (persona.kpiIds || []).filter(id => id !== kpiId);
    this.personaService.updatePersona(persona.id, { kpiIds });
  }

  handleKPIInputBlur() {
    setTimeout(() => {
      if (!document.activeElement?.closest('.kpi-selector-container')) {
        this.cancelAddingKPI();
      }
    }, 200);
  }

  getKPIName(id: string): string {
    return this.kpis().find(k => k.id === id)?.name || 'Unknown';
  }
}

