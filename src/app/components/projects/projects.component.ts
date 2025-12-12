import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { UseCaseService } from '../../services/use-case.service';
import { KPIService } from '../../services/kpi.service';
import { Project, ProjectKPIMapping } from '../../models/project';
import { ProjectCardComponent } from '../cards/project-card/project-card.component';
import { SearchInputComponent } from '../shared/search-input/search-input.component';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, FormsModule, ProjectCardComponent, SearchInputComponent],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  searchQuery = signal('');
  
  allProjects = computed(() => this.projectService.getProjects()());
  projects = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.allProjects();
    if (!query) return all;
    return all.filter(p => 
      p.name?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  });
  
  useCases = computed(() => this.useCaseService.getUseCases()());
  kpis = computed(() => this.kpiService.getKPIs()());
  
  showAddModal = signal(false);
  addModalErrors = signal<{ name?: string; kpi?: string }>({});
  
  newProject = signal<{
    name: string;
    description: string;
    useCaseIds: string[];
    kpiMappings: ProjectKPIMapping[];
  }>({
    name: '',
    description: '',
    useCaseIds: [],
    kpiMappings: []
  });

  // Use Case selection
  addingUseCaseInModal = signal(false);
  useCaseSearchFilterModal = signal('');

  // KPI selection
  addingKPIInModal = signal(false);
  kpiSearchFilterModal = signal('');

  constructor(
    private projectService: ProjectService,
    private useCaseService: UseCaseService,
    private kpiService: KPIService
  ) {}

  openAddModal() {
    this.newProject.set({
      name: '',
      description: '',
      useCaseIds: [],
      kpiMappings: []
    });
    this.addModalErrors.set({});
    this.resetInlineEditing();
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
    this.resetInlineEditing();
  }

  resetInlineEditing() {
    this.addingUseCaseInModal.set(false);
    this.useCaseSearchFilterModal.set('');
    this.addingKPIInModal.set(false);
    this.kpiSearchFilterModal.set('');
  }

  async addProject() {
    const errors: { name?: string; kpi?: string } = {};
    
    if (!this.newProject().name?.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!this.newProject().kpiMappings || this.newProject().kpiMappings.length === 0) {
      errors.kpi = 'At least one KPI is required';
    }
    
    this.addModalErrors.set(errors);
    
    if (Object.keys(errors).length === 0) {
      await this.projectService.addProject({
        name: this.newProject().name.trim(),
        description: this.newProject().description?.trim(),
        useCaseIds: this.newProject().useCaseIds,
        kpiMappings: this.newProject().kpiMappings
      });
      this.closeAddModal();
    }
  }

  // ===== Use Case methods =====
  startAddingUseCaseInModal() {
    this.addingUseCaseInModal.set(true);
    this.useCaseSearchFilterModal.set('');
  }

  cancelAddingUseCaseInModal() {
    this.addingUseCaseInModal.set(false);
    this.useCaseSearchFilterModal.set('');
  }

  getFilteredUseCasesForModal() {
    const filter = this.useCaseSearchFilterModal().toLowerCase().trim();
    const selectedIds = this.newProject().useCaseIds;
    const available = this.useCases().filter(uc => !selectedIds.includes(uc.id));
    
    if (!filter) return available;
    return available.filter(uc => 
      uc.action?.toLowerCase().includes(filter)
    );
  }

  canCreateUseCaseInModal(): boolean {
    const filter = this.useCaseSearchFilterModal().trim();
    if (!filter) return false;
    return !this.useCases().some(uc => 
      uc.action?.toLowerCase() === filter.toLowerCase()
    );
  }

  addUseCaseToProjectInModal(useCaseId: string) {
    const currentIds = this.newProject().useCaseIds;
    if (!currentIds.includes(useCaseId)) {
      this.newProject.update(p => ({ 
        ...p, 
        useCaseIds: [...currentIds, useCaseId] 
      }));
    }
    this.cancelAddingUseCaseInModal();
  }

  async createAndAddUseCaseInModal() {
    const action = this.useCaseSearchFilterModal().trim();
    if (!action) return;

    const created = await this.useCaseService.addUseCase({
      action,
      persona: '',
      goal: '',
      useCaseToolMappings: []
    });

    this.addUseCaseToProjectInModal(created.id);
  }

  removeUseCaseFromProject(useCaseId: string) {
    this.newProject.update(p => ({ 
      ...p, 
      useCaseIds: p.useCaseIds.filter(id => id !== useCaseId) 
    }));
  }

  handleUseCaseModalInputBlur() {
    setTimeout(() => {
      if (this.addingUseCaseInModal()) {
        this.cancelAddingUseCaseInModal();
      }
    }, 200);
  }

  getSelectedUseCases() {
    return this.newProject().useCaseIds;
  }

  // ===== KPI methods =====
  startAddingKPIInModal() {
    this.addingKPIInModal.set(true);
    this.kpiSearchFilterModal.set('');
  }

  cancelAddingKPIInModal() {
    this.addingKPIInModal.set(false);
    this.kpiSearchFilterModal.set('');
  }

  getFilteredKPIsForModal() {
    const filter = this.kpiSearchFilterModal().toLowerCase().trim();
    const selectedIds = this.newProject().kpiMappings.map(m => m.kpiId);
    const available = this.kpis().filter(k => !selectedIds.includes(k.id));
    
    if (!filter) return available;
    return available.filter(k => 
      k.name?.toLowerCase().includes(filter)
    );
  }

  canCreateKPIInModal(): boolean {
    const filter = this.kpiSearchFilterModal().trim();
    if (!filter) return false;
    return !this.kpis().some(k => 
      k.name?.toLowerCase() === filter.toLowerCase()
    );
  }

  addKPIToProjectInModal(kpiId: string) {
    const currentMappings = this.newProject().kpiMappings;
    if (!currentMappings.some(m => m.kpiId === kpiId)) {
      this.newProject.update(p => ({ 
        ...p, 
        kpiMappings: [...currentMappings, { kpiId, currentValue: '', targetValue: '' }] 
      }));
    }
    this.cancelAddingKPIInModal();
  }

  async createAndAddKPIInModal() {
    const name = this.kpiSearchFilterModal().trim();
    if (!name) return;

    const created = await this.kpiService.addKPI({
      name,
      unit: '',
      targetValue: ''
    });

    this.addKPIToProjectInModal(created.id);
  }

  removeKPIFromProject(kpiId: string) {
    this.newProject.update(p => ({ 
      ...p, 
      kpiMappings: p.kpiMappings.filter(m => m.kpiId !== kpiId) 
    }));
  }

  updateKPIValue(kpiId: string, field: 'currentValue' | 'targetValue', value: string) {
    this.newProject.update(p => ({
      ...p,
      kpiMappings: p.kpiMappings.map(m => 
        m.kpiId === kpiId ? { ...m, [field]: value } : m
      )
    }));
  }

  getKPIMapping(kpiId: string): ProjectKPIMapping | undefined {
    return this.newProject().kpiMappings.find(m => m.kpiId === kpiId);
  }

  handleKPIModalInputBlur() {
    setTimeout(() => {
      if (this.addingKPIInModal()) {
        this.cancelAddingKPIInModal();
      }
    }, 200);
  }

  getSelectedKPIMappings() {
    return this.newProject().kpiMappings;
  }

  // ===== Helper methods =====
  getUseCaseName(id: string): string {
    const useCase = this.useCases().find(uc => uc.id === id);
    return useCase?.action || 'Unknown';
  }

  getKPIName(id: string): string {
    const kpi = this.kpis().find(k => k.id === id);
    return kpi?.name || 'Unknown';
  }

  getKPIUnit(id: string): string {
    const kpi = this.kpis().find(k => k.id === id);
    return kpi?.unit || '';
  }
}
