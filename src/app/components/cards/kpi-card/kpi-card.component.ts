import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KPIService } from '../../../services/kpi.service';
import { PersonaService } from '../../../services/persona.service';
import { UseCaseService } from '../../../services/use-case.service';
import { KPI } from '../../../models/kpi';
import { UseCase } from '../../../models/use-case';

@Component({
  selector: 'app-kpi-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss'
})
export class KPICardComponent {
  kpi = input.required<KPI>();

  personas = computed(() => this.personaService.getPersonas()());
  useCases = computed(() => this.useCaseService.getUseCases()());
  
  // Get personas that have this KPI
  kpiPersonas = computed(() => {
    return this.personas().filter(p => p.kpiIds?.includes(this.kpi().id));
  });

  // Get use cases that cover this KPI
  kpiUseCases = computed(() => {
    const useCaseIds = this.kpi().useCaseIds || [];
    return this.useCases().filter(uc => useCaseIds.includes(uc.id));
  });

  // Inline editing
  editingField = signal<{ field: 'name' | 'description' | 'unit' | 'targetValue' } | null>(null);
  editingFieldValue = signal<string>('');

  // Use case management
  addingUseCase = signal<boolean>(false);
  useCaseSearchFilter = signal<string>('');

  constructor(
    private kpiService: KPIService,
    private personaService: PersonaService,
    private useCaseService: UseCaseService
  ) {}

  // Field editing methods
  startEditingField(field: 'name' | 'description' | 'unit' | 'targetValue') {
    this.editingField.set({ field });
    this.editingFieldValue.set(this.kpi()[field] || '');
  }

  cancelEditingField() {
    this.editingField.set(null);
    this.editingFieldValue.set('');
  }

  saveField(field: 'name' | 'description' | 'unit' | 'targetValue') {
    const value = this.editingFieldValue().trim();
    if (field === 'name' && !value) {
      this.cancelEditingField();
      return;
    }
    this.kpiService.updateKPI(this.kpi().id, { [field]: value });
    this.cancelEditingField();
  }

  isEditingField(field: 'name' | 'description' | 'unit' | 'targetValue'): boolean {
    const editing = this.editingField();
    return editing?.field === field;
  }

  deleteKPI() {
    const personaCount = this.kpiPersonas().length;
    const message = personaCount > 0 
      ? `This KPI is associated with ${personaCount} persona(s). Are you sure you want to delete it?`
      : 'Are you sure you want to delete this KPI?';
    
    if (confirm(message)) {
      this.kpiService.deleteKPI(this.kpi().id);
    }
  }

  // Use case management methods
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

  getFilteredUseCases(): UseCase[] {
    const filter = this.useCaseSearchFilter().toLowerCase().trim();
    const currentUseCaseIds = this.kpi().useCaseIds || [];
    // Filter out already assigned use cases
    const availableUseCases = this.useCases().filter(uc => !currentUseCaseIds.includes(uc.id));
    
    if (!filter) return availableUseCases;
    
    return availableUseCases.filter(uc => 
      uc.name?.toLowerCase().includes(filter) ||
      uc.action?.toLowerCase().includes(filter) ||
      uc.goal?.toLowerCase().includes(filter)
    );
  }

  addUseCaseToKPI(useCaseId: string) {
    const kpi = this.kpi();
    const useCaseIds = [...(kpi.useCaseIds || [])];
    if (!useCaseIds.includes(useCaseId)) {
      useCaseIds.push(useCaseId);
      this.kpiService.updateKPI(kpi.id, { useCaseIds });
    }
    this.cancelAddingUseCase();
  }

  removeUseCase(useCaseId: string) {
    const kpi = this.kpi();
    const useCaseIds = (kpi.useCaseIds || []).filter(id => id !== useCaseId);
    this.kpiService.updateKPI(kpi.id, { useCaseIds });
  }

  handleUseCaseInputBlur() {
    setTimeout(() => {
      if (!document.activeElement?.closest('.use-case-selector-container')) {
        this.cancelAddingUseCase();
      }
    }, 200);
  }

  getUseCaseName(id: string): string {
    const useCase = this.useCases().find(uc => uc.id === id);
    if (!useCase) return 'Unknown';
    return useCase.action || 'Unnamed use case';
  }
}

