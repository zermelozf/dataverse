import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolService } from '../../services/tool.service';
import { UseCaseService } from '../../services/use-case.service';
import { DataModelService } from '../../services/data-model.service';
import { Tool } from '../../models/tool';
import { ToolCardComponent } from '../cards/tool-card/tool-card.component';
import { SearchInputComponent } from '../shared/search-input/search-input.component';

@Component({
  selector: 'app-tools',
  imports: [CommonModule, FormsModule, ToolCardComponent, SearchInputComponent],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss'
})
export class ToolsComponent {
  searchQuery = signal('');
  
  allTools = computed(() => this.toolService.getTools()());
  tools = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.allTools();
    if (!query) return all;
    return all.filter(t => 
      t.name?.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    );
  });
  useCases = computed(() => this.useCaseService.getUseCases()());
  dataModels = computed(() => this.dataModelService.getDataModels()());
  implementations = computed(() => this.dataModelService.getImplementations()());
  
  showAddModal = signal(false);
  addModalErrors = signal<{ name?: string; description?: string }>({});
  
  editingField = signal<{ toolId: string; field: string } | null>(null);
  editingFieldValue = signal<string>('');
  
  editingUseCase = signal<{ toolId: string; useCaseId: string } | null>(null);
  addingUseCase = signal<string | null>(null); // toolId
  useCaseSearchFilter = signal<string>('');
  
  editingDataModel = signal<{ toolId: string; dataModelId: string } | null>(null);
  addingDataModel = signal<string | null>(null); // toolId
  dataModelSearchFilter = signal<string>('');
  
  newTool = signal({
    name: '',
    description: '',
    useCaseToolMappings: [] as { useCaseId: string; toolId: string }[]
  });

  constructor(
    private toolService: ToolService,
    private useCaseService: UseCaseService,
    private dataModelService: DataModelService
  ) {}


  // Inline field editing
  startEditingField(tool: Tool, field: 'name' | 'description') {
    this.editingField.set({ toolId: tool.id, field });
    this.editingFieldValue.set(tool[field] || '');
  }

  cancelEditingField() {
    this.editingField.set(null);
    this.editingFieldValue.set('');
  }

  saveField(toolId: string, field: 'name' | 'description') {
    const value = this.editingFieldValue().trim();
    if (field === 'name' && !value) {
      this.cancelEditingField();
      return;
    }
    
    this.toolService.updateTool(toolId, { [field]: value });
    this.cancelEditingField();
  }

  isEditingField(toolId: string, field: string): boolean {
    const editing = this.editingField();
    return editing?.toolId === toolId && editing?.field === field;
  }

  getUseCaseName(useCaseId: string): string {
    const useCase = this.useCases().find(uc => uc.id === useCaseId);
    if (!useCase) return 'Unknown';
    return useCase.action || 'Unnamed use case';
  }

  // Use cases inline editing
  startEditingUseCase(toolId: string, useCaseId: string) {
    this.editingUseCase.set({ toolId, useCaseId });
    const useCase = this.useCases().find(uc => uc.id === useCaseId);
    this.useCaseSearchFilter.set(useCase?.name || useCase?.action || '');
  }

  cancelEditingUseCase() {
    this.editingUseCase.set(null);
    this.useCaseSearchFilter.set('');
  }

  startAddingUseCase(toolId: string) {
    this.addingUseCase.set(toolId);
    this.useCaseSearchFilter.set('');
  }

  cancelAddingUseCase() {
    this.addingUseCase.set(null);
    this.useCaseSearchFilter.set('');
  }

  isEditingUseCase(toolId: string, useCaseId: string): boolean {
    const editing = this.editingUseCase();
    return editing?.toolId === toolId && editing?.useCaseId === useCaseId;
  }

  isAddingUseCase(toolId: string): boolean {
    return this.addingUseCase() === toolId;
  }

  getFilteredUseCases() {
    const filter = this.useCaseSearchFilter().toLowerCase().trim();
    if (!filter) return this.useCases();
    return this.useCases().filter(useCase => {
      const name = useCase.name?.toLowerCase() || '';
      const action = useCase.action?.toLowerCase() || '';
      return name.includes(filter) || action.includes(filter);
    });
  }

  updateUseCaseMapping(toolId: string, oldUseCaseId: string, newUseCaseId: string) {
    const tool = this.tools().find(t => t.id === toolId);
    if (!tool) return;

    const mappings = (tool.useCaseToolMappings || []).map(m => 
      m.useCaseId === oldUseCaseId ? { ...m, useCaseId: newUseCaseId } : m
    );
    
    this.toolService.updateTool(toolId, { useCaseToolMappings: mappings });
    this.cancelEditingUseCase();
  }

  addUseCaseToTool(toolId: string, useCaseId: string) {
    const tool = this.tools().find(t => t.id === toolId);
    if (!tool) return;

    // Check if use case is already linked
    const existing = (tool.useCaseToolMappings || []).find(m => m.useCaseId === useCaseId);
    if (existing) {
      this.cancelAddingUseCase();
      return;
    }

    const mappings = [...(tool.useCaseToolMappings || []), { useCaseId, toolId }];
    this.toolService.updateTool(toolId, { useCaseToolMappings: mappings });
    this.cancelAddingUseCase();
  }

  removeUseCase(toolId: string, useCaseId: string) {
    const tool = this.tools().find(t => t.id === toolId);
    if (!tool) return;

    const mappings = (tool.useCaseToolMappings || []).filter(m => m.useCaseId !== useCaseId);
    this.toolService.updateTool(toolId, { useCaseToolMappings: mappings });
  }

  handleUseCaseInputBlur(toolId: string, useCaseId: string) {
    setTimeout(() => {
      if (this.isEditingUseCase(toolId, useCaseId)) {
        this.cancelEditingUseCase();
      }
    }, 200);
  }

  handleAddUseCaseInputBlur(toolId: string) {
    setTimeout(() => {
      if (this.isAddingUseCase(toolId)) {
        this.cancelAddingUseCase();
      }
    }, 200);
  }

  // Data models inline editing
  getLinkedDataModels(toolId: string) {
    return this.implementations().filter(impl => impl.toolId === toolId);
  }

  getDataModelName(dataModelId: string): string {
    const dataModel = this.dataModels().find(dm => dm.id === dataModelId);
    return dataModel?.name || 'Unknown';
  }

  startEditingDataModel(toolId: string, dataModelId: string) {
    this.editingDataModel.set({ toolId, dataModelId });
    const dataModel = this.dataModels().find(dm => dm.id === dataModelId);
    this.dataModelSearchFilter.set(dataModel?.name || '');
  }

  cancelEditingDataModel() {
    this.editingDataModel.set(null);
    this.dataModelSearchFilter.set('');
  }

  startAddingDataModel(toolId: string) {
    this.addingDataModel.set(toolId);
    this.dataModelSearchFilter.set('');
  }

  cancelAddingDataModel() {
    this.addingDataModel.set(null);
    this.dataModelSearchFilter.set('');
  }

  isEditingDataModel(toolId: string, dataModelId: string): boolean {
    const editing = this.editingDataModel();
    return editing?.toolId === toolId && editing?.dataModelId === dataModelId;
  }

  isAddingDataModel(toolId: string): boolean {
    return this.addingDataModel() === toolId;
  }

  getFilteredDataModels() {
    const filter = this.dataModelSearchFilter().toLowerCase().trim();
    if (!filter) return this.dataModels();
    return this.dataModels().filter(dataModel => 
      dataModel.name.toLowerCase().includes(filter) ||
      (dataModel.description && dataModel.description.toLowerCase().includes(filter))
    );
  }

  updateDataModelImplementation(toolId: string, oldDataModelId: string, newDataModelId: string) {
    const implementation = this.implementations().find(
      impl => impl.toolId === toolId && impl.dataModelId === oldDataModelId
    );
    if (!implementation) return;

    // Update the implementation
    this.dataModelService.updateImplementation(implementation.id, {
      dataModelId: newDataModelId
    });
    this.cancelEditingDataModel();
  }

  async addDataModelToTool(toolId: string, dataModelId: string) {
    // Check if already linked
    const existing = this.implementations().find(
      impl => impl.toolId === toolId && impl.dataModelId === dataModelId
    );
    if (existing) {
      this.cancelAddingDataModel();
      return;
    }

    // Create new implementation
    await this.dataModelService.addImplementation({
      toolId,
      dataModelId,
      implementationDetails: '',
      schema: {}
    });
    this.cancelAddingDataModel();
  }

  async removeDataModel(toolId: string, dataModelId: string) {
    const implementation = this.implementations().find(
      impl => impl.toolId === toolId && impl.dataModelId === dataModelId
    );
    if (implementation) {
      await this.dataModelService.deleteImplementation(implementation.id);
    }
  }

  handleDataModelInputBlur(toolId: string, dataModelId: string) {
    setTimeout(() => {
      if (this.isEditingDataModel(toolId, dataModelId)) {
        this.cancelEditingDataModel();
      }
    }, 200);
  }

  handleAddDataModelInputBlur(toolId: string) {
    setTimeout(() => {
      if (this.isAddingDataModel(toolId)) {
        this.cancelAddingDataModel();
      }
    }, 200);
  }

  // Modal for adding new tool
  openAddModal() {
    this.newTool.set({ name: '', description: '', useCaseToolMappings: [] });
    this.addModalErrors.set({});
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  addTool() {
    const errors: { name?: string; description?: string } = {};
    
    if (!this.newTool().name.trim()) {
      errors.name = 'Name is required';
    }
    
    this.addModalErrors.set(errors);
    
    if (Object.keys(errors).length === 0) {
      this.toolService.addTool(this.newTool());
      this.closeAddModal();
    }
  }

  deleteTool(id: string) {
    if (confirm('Are you sure you want to delete this tool?')) {
      this.toolService.deleteTool(id);
    }
  }
}

