import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataModelService } from '../../services/data-model.service';
import { ToolService } from '../../services/tool.service';
import { DomainService } from '../../services/domain.service';
import { 
  DataModel, 
  DataModelImplementation, 
  DataModelAttribute,
  RelationshipType 
} from '../../models/data-model';
import { Tool } from '../../models/tool';
import { DataModelCardComponent } from '../cards/data-model-card/data-model-card.component';
import { SearchInputComponent } from '../shared/search-input/search-input.component';

@Component({
  selector: 'app-data-models',
  imports: [CommonModule, FormsModule, DataModelCardComponent, SearchInputComponent],
  templateUrl: './data-models.component.html',
  styleUrl: './data-models.component.scss'
})
export class DataModelsComponent {
  searchQuery = signal('');
  
  allDataModels = computed(() => this.dataModelService.getDataModels()());
  domains = computed(() => this.domainService.getDomains()());
  
  dataModels = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.allDataModels();
    if (!query) return all;
    
    return all.filter(dm => {
      // Search in name and description
      if (dm.name?.toLowerCase().includes(query)) return true;
      if (dm.description?.toLowerCase().includes(query)) return true;
      
      // Search in domain name
      if (dm.domainId) {
        const domain = this.domains().find(d => d.id === dm.domainId);
        if (domain?.name?.toLowerCase().includes(query)) return true;
      }
      
      // Search in attributes
      if (dm.attributes?.some(attr => 
        attr.name?.toLowerCase().includes(query) ||
        attr.description?.toLowerCase().includes(query)
      )) return true;
      
      return false;
    });
  });
  tools = computed(() => this.toolService.getTools()());
  implementations = computed(() => this.dataModelService.getImplementations()());
  
  showAddModal = signal(false);
  showImplementationModal = signal(false);
  showImplementationEditModal = signal(false);
  addModalErrors = signal<{ name?: string; description?: string }>({});
  
  editingField = signal<{ modelId: string; field: string } | null>(null);
  editingAttributeField = signal<{ modelId: string; attributeId: string; field: string } | null>(null);
  editingAttributeType = signal<{ modelId: string; attributeId: string } | null>(null);
  editingAttributeRelationship = signal<{ modelId: string; attributeId: string } | null>(null);
  addingAttributeToModelId = signal<string | null>(null);
  
  selectedDataModel = signal<DataModel | null>(null);
  selectedImplementation = signal<DataModelImplementation | null>(null);
  
  // Inline editing state for individual fields
  editingFieldValue = signal<string>('');
  editingAttributeFieldValue = signal<string>('');
  newAttribute = signal<Partial<DataModelAttribute>>({
    name: '',
    type: 'string',
    description: '',
    required: false,
    targetDataModelId: '',
    relationshipType: 'one-to-many'
  });

  newModel = signal({
    name: '',
    description: '',
    attributes: [] as DataModelAttribute[]
  });
  
  newImplementation = signal({
    dataModelId: '',
    toolId: '',
    implementationDetails: '',
    schema: '{}'
  });

  dataModelSearchFilter = signal('');

  attributeTypes = ['string', 'number', 'boolean', 'Date', 'object', 'array', 'CustomType', 'relationship'];
  relationshipTypes: RelationshipType[] = [
    'one-to-one',
    'one-to-many',
    'many-to-one',
    'many-to-many',
    'composition',
    'aggregation',
    'inheritance'
  ];

  constructor(
    private dataModelService: DataModelService,
    private toolService: ToolService,
    private domainService: DomainService
  ) {}

  // Individual field editing with auto-save
  startEditingField(model: DataModel, field: 'name' | 'description') {
    this.editingField.set({ modelId: model.id, field });
    this.editingFieldValue.set(model[field] || '');
  }

  cancelEditingField() {
    this.editingField.set(null);
    this.editingFieldValue.set('');
  }

  saveField(modelId: string, field: 'name' | 'description') {
    const value = this.editingFieldValue().trim();
    if (field === 'name' && !value) {
      // Name is required, don't save if empty
      this.cancelEditingField();
      return;
    }
    
    this.dataModelService.updateDataModel(modelId, { [field]: value });
    this.cancelEditingField();
  }

  isEditingField(modelId: string, field: string): boolean {
    const editing = this.editingField();
    return editing?.modelId === modelId && editing?.field === field;
  }

  // Attribute editing
  startAddingAttribute(model: DataModel) {
    this.addingAttributeToModelId.set(model.id);
    this.newAttribute.set({
      name: '',
      type: 'string',
      description: '',
      required: false,
      targetDataModelId: '',
      relationshipType: 'one-to-many'
    });
    this.dataModelSearchFilter.set('');
  }

  cancelAddingAttribute() {
    this.addingAttributeToModelId.set(null);
    this.newAttribute.set({
      name: '',
      type: 'string',
      description: '',
      required: false,
      targetDataModelId: '',
      relationshipType: 'one-to-many'
    });
  }

  saveNewAttribute() {
    const modelId = this.addingAttributeToModelId();
    if (!modelId) return;

    const attr = this.newAttribute();
    if (!attr.name?.trim()) return;

    if (attr.type === 'relationship' && !attr.targetDataModelId) {
      alert('Please select a target data model for the relationship');
      return;
    }

    const attributeData: DataModelAttribute = {
      id: this.generateId(),
      name: attr.name,
      type: attr.type || 'string',
      description: attr.description,
      required: attr.required || false
    };

    if (attr.type === 'relationship') {
      attributeData.targetDataModelId = attr.targetDataModelId;
      attributeData.relationshipType = attr.relationshipType;
    }

    // Get current model and add the new attribute
    const model = this.dataModels().find(m => m.id === modelId);
    if (model) {
      const attributes = [...(model.attributes || []), attributeData];
      this.dataModelService.updateDataModel(modelId, { attributes });
      this.cancelAddingAttribute();
    }
  }

  // Individual attribute field editing with auto-save
  startEditingAttributeField(model: DataModel, attribute: DataModelAttribute, field: 'name' | 'description') {
    this.editingAttributeField.set({ modelId: model.id, attributeId: attribute.id, field });
    this.editingAttributeFieldValue.set(attribute[field] || '');
  }

  cancelEditingAttributeField() {
    this.editingAttributeField.set(null);
    this.editingAttributeFieldValue.set('');
  }

  saveAttributeField(modelId: string, attributeId: string, field: 'name' | 'description') {
    const value = this.editingAttributeFieldValue().trim();
    if (field === 'name' && !value) {
      this.cancelEditingAttributeField();
      return;
    }

    const model = this.dataModels().find(m => m.id === modelId);
    if (!model) return;

    const attributes = (model.attributes || []).map(attr => {
      if (attr.id === attributeId) {
        return { ...attr, [field]: value };
      }
      return attr;
    });

    this.dataModelService.updateDataModel(modelId, { attributes });
    this.cancelEditingAttributeField();
  }

  updateAttributeType(modelId: string, attributeId: string, newType: string) {
    const model = this.dataModels().find(m => m.id === modelId);
    if (!model) return;

    const attributes = (model.attributes || []).map(attr => {
      if (attr.id === attributeId) {
        const updated: DataModelAttribute = {
          ...attr,
          type: newType
        };
        // Clear relationship fields if type is not relationship
        if (newType !== 'relationship') {
          updated.targetDataModelId = undefined;
          updated.relationshipType = undefined;
        }
        return updated;
      }
      return attr;
    });

    this.dataModelService.updateDataModel(modelId, { attributes });
    this.cancelEditingAttributeType();
  }

  updateAttributeRequired(modelId: string, attributeId: string, required: boolean) {
    const model = this.dataModels().find(m => m.id === modelId);
    if (!model) return;

    const attributes = (model.attributes || []).map(attr => 
      attr.id === attributeId ? { ...attr, required } : attr
    );

    this.dataModelService.updateDataModel(modelId, { attributes });
  }

  updateAttributeRelationship(modelId: string, attributeId: string, targetDataModelId?: string, relationshipType?: RelationshipType) {
    const model = this.dataModels().find(m => m.id === modelId);
    if (!model) return;

    const attributes = (model.attributes || []).map(attr => {
      if (attr.id === attributeId) {
        return {
          ...attr,
          ...(targetDataModelId !== undefined && { targetDataModelId }),
          ...(relationshipType !== undefined && { relationshipType })
        };
      }
      return attr;
    });

    this.dataModelService.updateDataModel(modelId, { attributes });
    // Don't cancel here - let user continue editing or click away
  }

  saveAttributeRelationship(modelId: string, attributeId: string) {
    // This is called when user finishes editing relationship
    this.cancelEditingAttributeRelationship();
  }

  isEditingAttributeField(modelId: string, attributeId: string, field: string): boolean {
    const editing = this.editingAttributeField();
    return editing?.modelId === modelId && editing?.attributeId === attributeId && editing?.field === field;
  }

  isEditingAttributeType(modelId: string, attributeId: string): boolean {
    const editing = this.editingAttributeType();
    return editing?.modelId === modelId && editing?.attributeId === attributeId;
  }

  isEditingAttributeRelationship(modelId: string, attributeId: string): boolean {
    const editing = this.editingAttributeRelationship();
    return editing?.modelId === modelId && editing?.attributeId === attributeId;
  }

  startEditingAttributeType(model: DataModel, attribute: DataModelAttribute) {
    this.editingAttributeType.set({ modelId: model.id, attributeId: attribute.id });
  }

  cancelEditingAttributeType() {
    this.editingAttributeType.set(null);
  }

  startEditingAttributeRelationship(model: DataModel, attribute: DataModelAttribute) {
    this.editingAttributeRelationship.set({ modelId: model.id, attributeId: attribute.id });
    this.dataModelSearchFilter.set('');
  }

  cancelEditingAttributeRelationship() {
    this.editingAttributeRelationship.set(null);
  }

  deleteAttribute(model: DataModel, attributeId: string) {
    if (confirm('Are you sure you want to delete this data element?')) {
      const attributes = (model.attributes || []).filter(a => a.id !== attributeId);
      this.dataModelService.updateDataModel(model.id, { attributes });
    }
  }

  isAddingAttribute(modelId: string): boolean {
    return this.addingAttributeToModelId() === modelId;
  }

  isRelationshipType(type?: string): boolean {
    return type === 'relationship';
  }

  // Implementation modals (keeping these as modals for now)
  openImplementationModal(dataModel: DataModel) {
    this.selectedDataModel.set(dataModel);
    this.newImplementation.set({
      dataModelId: dataModel.id,
      toolId: '',
      implementationDetails: '',
      schema: '{}'
    });
    this.showImplementationModal.set(true);
  }

  closeImplementationModal() {
    this.showImplementationModal.set(false);
    this.selectedDataModel.set(null);
  }

  openImplementationEditModal(impl: DataModelImplementation) {
    this.selectedImplementation.set(impl);
    this.newImplementation.set({
      dataModelId: impl.dataModelId,
      toolId: impl.toolId,
      implementationDetails: impl.implementationDetails,
      schema: JSON.stringify(impl.schema, null, 2)
    });
    this.showImplementationEditModal.set(true);
  }

  closeImplementationEditModal() {
    this.showImplementationEditModal.set(false);
    this.selectedImplementation.set(null);
  }

  openAddModal() {
    this.newModel.set({ 
      name: '', 
      description: '',
      attributes: []
    });
    this.addModalErrors.set({});
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  addDataModel() {
    const errors: { name?: string; description?: string } = {};
    
    if (!this.newModel().name.trim()) {
      errors.name = 'Name is required';
    }
    
    this.addModalErrors.set(errors);
    
    if (Object.keys(errors).length === 0) {
      this.dataModelService.addDataModel({
        ...this.newModel(),
        attributes: this.newModel().attributes || []
      });
      this.closeAddModal();
    }
  }

  deleteDataModel(id: string) {
    if (confirm('Are you sure you want to delete this data model?')) {
      this.dataModelService.deleteDataModel(id);
    }
  }

  addImplementation() {
    const impl = this.newImplementation();
    if (impl.dataModelId && impl.toolId && impl.implementationDetails.trim()) {
      try {
        const schema = JSON.parse(impl.schema);
        this.dataModelService.addImplementation({
          ...impl,
          schema
        });
        this.closeImplementationModal();
      } catch (e) {
        alert('Invalid JSON schema');
      }
    }
  }

  updateImplementation() {
    const impl = this.selectedImplementation();
    if (impl) {
      try {
        const schema = JSON.parse(this.newImplementation().schema);
        this.dataModelService.updateImplementation(impl.id, {
          ...this.newImplementation(),
          schema
        });
        this.closeImplementationEditModal();
      } catch (e) {
        alert('Invalid JSON schema');
      }
    }
  }

  deleteImplementation(id: string) {
    if (confirm('Are you sure you want to delete this implementation?')) {
      this.dataModelService.deleteImplementation(id);
    }
  }

  getImplementationsForModel(modelId: string): DataModelImplementation[] {
    return this.implementations().filter(impl => impl.dataModelId === modelId);
  }

  getToolName(toolId: string): string {
    return this.tools().find(t => t.id === toolId)?.name || 'Unknown';
  }

  getDataModelName(dataModelId: string): string {
    return this.dataModels().find(dm => dm.id === dataModelId)?.name || 'Unknown';
  }

  getAvailableDataModels(excludeId?: string): DataModel[] {
    const allModels = this.dataModels().filter(dm => dm.id !== excludeId);
    const filter = this.dataModelSearchFilter().toLowerCase().trim();
    if (!filter) {
      return allModels;
    }
    return allModels.filter(model => 
      model.name.toLowerCase().includes(filter) ||
      model.description.toLowerCase().includes(filter)
    );
  }

  clearDataModelSearch() {
    this.dataModelSearchFilter.set('');
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

