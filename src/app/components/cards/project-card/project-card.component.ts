import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../services/project.service';
import { UseCaseService } from '../../../services/use-case.service';
import { KPIService } from '../../../services/kpi.service';
import { Project, ProjectKPIMapping } from '../../../models/project';
import { KPI } from '../../../models/kpi';
import { UseCase } from '../../../models/use-case';

@Component({
  selector: 'app-project-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './project-card.component.html',
  styleUrl: './project-card.component.scss'
})
export class ProjectCardComponent {
  project = input.required<Project>();

  useCases = computed(() => this.useCaseService.getUseCases()());
  kpis = computed(() => this.kpiService.getKPIs()());

  // Get the linked use cases
  linkedUseCases = computed(() => {
    const useCaseIds = this.project().useCaseIds || [];
    return useCaseIds.map(id => this.useCases().find(uc => uc.id === id)).filter(uc => uc) as UseCase[];
  });

  // Get KPI mappings with their details
  projectKPIMappings = computed(() => {
    const mappings = this.project().kpiMappings || [];
    return mappings.map(m => ({
      ...m,
      kpi: this.kpis().find(k => k.id === m.kpiId)
    })).filter(m => m.kpi);
  });

  // Inline editing
  editingField = signal<{ field: 'name' | 'description' } | null>(null);
  editingFieldValue = signal<string>('');

  // KPI value editing
  editingKPIValue = signal<{ kpiId: string; field: 'currentValue' | 'targetValue' } | null>(null);
  editingKPIValueContent = signal<string>('');

  // KPI management
  addingKPI = signal<boolean>(false);
  kpiSearchFilter = signal<string>('');

  // Use case management
  addingUseCase = signal<boolean>(false);
  useCaseSearchFilter = signal<string>('');

  constructor(
    private projectService: ProjectService,
    private useCaseService: UseCaseService,
    private kpiService: KPIService
  ) {}

  // Field editing methods
  startEditingField(field: 'name' | 'description') {
    this.editingField.set({ field });
    this.editingFieldValue.set(this.project()[field] || '');
  }

  cancelEditingField() {
    this.editingField.set(null);
    this.editingFieldValue.set('');
  }

  saveField(field: 'name' | 'description') {
    const value = this.editingFieldValue().trim();
    if (field === 'name' && !value) {
      this.cancelEditingField();
      return;
    }
    this.projectService.updateProject(this.project().id, { [field]: value || undefined });
    this.cancelEditingField();
  }

  isEditingField(field: 'name' | 'description'): boolean {
    const editing = this.editingField();
    return editing?.field === field;
  }

  deleteProject() {
    if (confirm('Are you sure you want to delete this project?')) {
      this.projectService.deleteProject(this.project().id);
    }
  }

  // KPI value editing
  startEditingKPIValue(kpiId: string, field: 'currentValue' | 'targetValue') {
    const mapping = this.project().kpiMappings?.find(m => m.kpiId === kpiId);
    this.editingKPIValue.set({ kpiId, field });
    this.editingKPIValueContent.set(mapping?.[field] || '');
  }

  cancelEditingKPIValue() {
    this.editingKPIValue.set(null);
    this.editingKPIValueContent.set('');
  }

  saveKPIValue(kpiId: string, field: 'currentValue' | 'targetValue') {
    const value = this.editingKPIValueContent().trim();
    const project = this.project();
    const mappings = (project.kpiMappings || []).map(m => 
      m.kpiId === kpiId ? { ...m, [field]: value } : m
    );
    this.projectService.updateProject(project.id, { kpiMappings: mappings });
    this.cancelEditingKPIValue();
  }

  isEditingKPIValue(kpiId: string, field: 'currentValue' | 'targetValue'): boolean {
    const editing = this.editingKPIValue();
    return editing?.kpiId === kpiId && editing?.field === field;
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
    const currentKPIIds = (this.project().kpiMappings || []).map(m => m.kpiId);
    // Filter out already assigned KPIs
    const availableKPIs = this.kpis().filter(k => !currentKPIIds.includes(k.id));
    
    if (!filter) return availableKPIs;
    
    return availableKPIs.filter(k => 
      k.name?.toLowerCase().includes(filter) ||
      k.description?.toLowerCase().includes(filter)
    );
  }

  addKPIToProject(kpiId: string) {
    const project = this.project();
    const mappings = [...(project.kpiMappings || [])];
    if (!mappings.find(m => m.kpiId === kpiId)) {
      mappings.push({ kpiId, currentValue: '', targetValue: '' });
      this.projectService.updateProject(project.id, { kpiMappings: mappings });
    }
    this.cancelAddingKPI();
  }

  removeKPI(kpiId: string) {
    const project = this.project();
    const mappings = (project.kpiMappings || []).filter(m => m.kpiId !== kpiId);
    this.projectService.updateProject(project.id, { kpiMappings: mappings });
  }

  handleKPIInputBlur() {
    setTimeout(() => {
      if (!document.activeElement?.closest('.kpi-selector-container')) {
        this.cancelAddingKPI();
      }
    }, 200);
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
    const currentUseCaseIds = this.project().useCaseIds || [];
    // Filter out already assigned use cases
    const availableUseCases = this.useCases().filter(uc => !currentUseCaseIds.includes(uc.id));
    
    if (!filter) return availableUseCases;
    
    return availableUseCases.filter(uc => 
      uc.action?.toLowerCase().includes(filter)
    );
  }

  addUseCaseToProject(useCaseId: string) {
    const project = this.project();
    const useCaseIds = [...(project.useCaseIds || [])];
    if (!useCaseIds.includes(useCaseId)) {
      useCaseIds.push(useCaseId);
      this.projectService.updateProject(project.id, { useCaseIds });
    }
    this.cancelAddingUseCase();
  }

  removeUseCase(useCaseId: string) {
    const project = this.project();
    const useCaseIds = (project.useCaseIds || []).filter(id => id !== useCaseId);
    this.projectService.updateProject(project.id, { useCaseIds });
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

  getKPIUnit(kpiId: string): string {
    const kpi = this.kpis().find(k => k.id === kpiId);
    return kpi?.unit || '';
  }
}
