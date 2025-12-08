import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolService } from '../../../services/tool.service';
import { UseCaseService } from '../../../services/use-case.service';
import { DataModelService } from '../../../services/data-model.service';
import { Tool } from '../../../models/tool';
import { UseCase } from '../../../models/use-case';
import { DataModel } from '../../../models/data-model';

@Component({
  selector: 'app-tool-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './tool-card.component.html',
  styleUrl: './tool-card.component.scss'
})
export class ToolCardComponent {
  tool = input.required<Tool>();

  useCases = computed(() => this.useCaseService.getUseCases()());
  dataModels = computed(() => this.dataModelService.getDataModels()());
  implementations = computed(() => this.dataModelService.getImplementations()());

  // Inline editing for name and description
  editingField = signal<{ field: 'name' | 'description' } | null>(null);
  editingFieldValue = signal<string>('');

  // Use case editing
  editingUseCase = signal<string | null>(null); // useCaseId
  addingUseCase = signal<boolean>(false);
  useCaseSearchFilter = signal<string>('');

  // Data model editing
  editingDataModel = signal<string | null>(null); // dataModelId
  addingDataModel = signal<boolean>(false);
  dataModelSearchFilter = signal<string>('');

  constructor(
    private toolService: ToolService,
    private useCaseService: UseCaseService,
    private dataModelService: DataModelService
  ) {}

  // Field editing methods
  startEditingField(field: 'name' | 'description') {
    this.editingField.set({ field });
    this.editingFieldValue.set(this.tool()[field] || '');
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
    this.toolService.updateTool(this.tool().id, { [field]: value });
    this.cancelEditingField();
  }

  isEditingField(field: 'name' | 'description'): boolean {
    const editing = this.editingField();
    return editing?.field === field;
  }

  // Use case editing methods
  startEditingUseCase(useCaseId: string) {
    this.editingUseCase.set(useCaseId);
    const useCase = this.useCases().find(uc => uc.id === useCaseId);
    this.useCaseSearchFilter.set(useCase?.name || useCase?.action || '');
  }

  cancelEditingUseCase() {
    this.editingUseCase.set(null);
    this.useCaseSearchFilter.set('');
  }

  isEditingUseCase(useCaseId: string): boolean {
    return this.editingUseCase() === useCaseId;
  }

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
    if (!filter) return this.useCases();
    return this.useCases().filter(useCase => {
      const name = useCase.name?.toLowerCase() || '';
      const action = useCase.action?.toLowerCase() || '';
      return name.includes(filter) || action.includes(filter);
    });
  }

  updateUseCaseMapping(oldUseCaseId: string, newUseCaseId: string) {
    const tool = this.tool();
    const mappings = (tool.useCaseToolMappings || []).map(m => 
      m.useCaseId === oldUseCaseId ? { ...m, useCaseId: newUseCaseId } : m
    );
    
    this.toolService.updateTool(tool.id, { useCaseToolMappings: mappings });
    
    // Also update use case's useCaseToolMappings (bidirectional)
    const useCase = this.useCases().find(uc => uc.id === newUseCaseId);
    if (useCase) {
      const useCaseMappings = (useCase.useCaseToolMappings || []).map(m =>
        m.toolId === tool.id ? { ...m, useCaseId: newUseCaseId } : m
      );
      this.useCaseService.updateUseCase(newUseCaseId, { useCaseToolMappings: useCaseMappings });
    }
    
    this.cancelEditingUseCase();
  }

  addUseCaseToTool(useCaseId: string) {
    const tool = this.tool();
    const existing = (tool.useCaseToolMappings || []).find(m => m.useCaseId === useCaseId);
    if (existing) {
      this.cancelAddingUseCase();
      return;
    }

    const mappings = [...(tool.useCaseToolMappings || []), { useCaseId, toolId: tool.id }];
    this.toolService.updateTool(tool.id, { useCaseToolMappings: mappings });
    
    // Also update use case's useCaseToolMappings (bidirectional)
    const useCase = this.useCases().find(uc => uc.id === useCaseId);
    if (useCase) {
      const useCaseMappings = [...(useCase.useCaseToolMappings || []), { useCaseId, toolId: tool.id }];
      this.useCaseService.updateUseCase(useCaseId, { useCaseToolMappings: useCaseMappings });
    }
    
    this.cancelAddingUseCase();
  }

  removeUseCase(useCaseId: string) {
    const tool = this.tool();
    const mappings = (tool.useCaseToolMappings || []).filter(m => m.useCaseId !== useCaseId);
    this.toolService.updateTool(tool.id, { useCaseToolMappings: mappings });

    // Also update use case's useCaseToolMappings (bidirectional)
    const useCase = this.useCases().find(uc => uc.id === useCaseId);
    if (useCase) {
      const useCaseMappings = (useCase.useCaseToolMappings || []).filter(m => m.toolId !== tool.id);
      this.useCaseService.updateUseCase(useCaseId, { useCaseToolMappings: useCaseMappings });
    }
  }

  handleUseCaseInputBlur(useCaseId: string) {
    setTimeout(() => {
      if (this.isEditingUseCase(useCaseId)) {
        this.cancelEditingUseCase();
      }
    }, 200);
  }

  handleAddUseCaseInputBlur() {
    setTimeout(() => {
      if (this.isAddingUseCase()) {
        this.cancelAddingUseCase();
      }
    }, 200);
  }

  // Data model editing methods
  getLinkedDataModels() {
    return this.implementations().filter(impl => impl.toolId === this.tool().id);
  }

  getDataModelName(dataModelId: string): string {
    return this.dataModels().find((dm: DataModel) => dm.id === dataModelId)?.name || 'Unknown';
  }

  startEditingDataModel(dataModelId: string) {
    this.editingDataModel.set(dataModelId);
    const dataModel = this.dataModels().find(dm => dm.id === dataModelId);
    this.dataModelSearchFilter.set(dataModel?.name || '');
  }

  cancelEditingDataModel() {
    this.editingDataModel.set(null);
    this.dataModelSearchFilter.set('');
  }

  isEditingDataModel(dataModelId: string): boolean {
    return this.editingDataModel() === dataModelId;
  }

  startAddingDataModel() {
    this.addingDataModel.set(true);
    this.dataModelSearchFilter.set('');
  }

  cancelAddingDataModel() {
    this.addingDataModel.set(false);
    this.dataModelSearchFilter.set('');
  }

  isAddingDataModel(): boolean {
    return this.addingDataModel();
  }

  getFilteredDataModels(): DataModel[] {
    const filter = this.dataModelSearchFilter().toLowerCase().trim();
    if (!filter) return this.dataModels();
    return this.dataModels().filter(dataModel => 
      dataModel.name.toLowerCase().includes(filter) ||
      (dataModel.description && dataModel.description.toLowerCase().includes(filter))
    );
  }

  updateDataModelImplementation(oldDataModelId: string, newDataModelId: string) {
    const impl = this.implementations().find(
      i => i.toolId === this.tool().id && i.dataModelId === oldDataModelId
    );
    if (!impl) return;

    this.dataModelService.updateImplementation(impl.id, {
      dataModelId: newDataModelId
    });
    this.cancelEditingDataModel();
  }

  async addDataModelToTool(dataModelId: string) {
    const existing = this.implementations().find(
      impl => impl.toolId === this.tool().id && impl.dataModelId === dataModelId
    );
    if (existing) {
      this.cancelAddingDataModel();
      return;
    }

    await this.dataModelService.addImplementation({
      toolId: this.tool().id,
      dataModelId,
      implementationDetails: '',
      schema: {}
    });
    this.cancelAddingDataModel();
  }

  removeDataModel(dataModelId: string) {
    const impl = this.implementations().find(
      i => i.toolId === this.tool().id && i.dataModelId === dataModelId
    );
    if (impl) {
      this.dataModelService.deleteImplementation(impl.id);
    }
  }

  handleDataModelInputBlur(dataModelId: string) {
    setTimeout(() => {
      if (this.isEditingDataModel(dataModelId)) {
        this.cancelEditingDataModel();
      }
    }, 200);
  }

  handleAddDataModelInputBlur() {
    setTimeout(() => {
      if (this.isAddingDataModel()) {
        this.cancelAddingDataModel();
      }
    }, 200);
  }

  deleteTool() {
    if (confirm('Are you sure you want to delete this tool?')) {
      this.toolService.deleteTool(this.tool().id);
    }
  }

  getUseCaseName(useCaseId: string): string {
    const useCase = this.useCases().find(uc => uc.id === useCaseId);
    if (!useCase) return 'Unknown';
    return useCase.action || 'Unnamed use case';
  }
}

