import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataModelService } from '../../../services/data-model.service';
import { 
  DataModel, 
  DataModelAttribute,
  RelationshipType 
} from '../../../models/data-model';

@Component({
  selector: 'app-data-model-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './data-model-card.component.html',
  styleUrl: './data-model-card.component.scss'
})
export class DataModelCardComponent {
  dataModel = input.required<DataModel>();

  dataModels = computed(() => this.dataModelService.getDataModels()());

  // Inline editing for name and description
  editingField = signal<{ field: 'name' | 'description' } | null>(null);
  editingFieldValue = signal<string>('');

  // Attribute editing
  editingAttributeField = signal<{ attributeId: string; field: 'name' | 'description' } | null>(null);
  editingAttributeType = signal<string | null>(null); // attributeId
  editingAttributeRelationship = signal<string | null>(null); // attributeId
  addingAttribute = signal<boolean>(false);
  
  editingAttributeFieldValue = signal<string>('');
  newAttribute = signal<Partial<DataModelAttribute>>({
    name: '',
    type: 'string',
    description: '',
    required: false,
    targetDataModelId: '',
    relationshipType: 'one-to-many'
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
    private dataModelService: DataModelService
  ) {}

  // Field editing methods
  startEditingField(field: 'name' | 'description') {
    this.editingField.set({ field });
    this.editingFieldValue.set(this.dataModel()[field] || '');
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
    this.dataModelService.updateDataModel(this.dataModel().id, { [field]: value });
    this.cancelEditingField();
  }

  isEditingField(field: 'name' | 'description'): boolean {
    const editing = this.editingField();
    return editing?.field === field;
  }

  // Attribute editing methods
  startAddingAttribute() {
    this.addingAttribute.set(true);
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
    this.addingAttribute.set(false);
    this.newAttribute.set({
      name: '',
      type: 'string',
      description: '',
      required: false,
      targetDataModelId: '',
      relationshipType: 'one-to-many'
    });
  }

  isAddingAttribute(): boolean {
    return this.addingAttribute();
  }

  saveNewAttribute() {
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

    const model = this.dataModel();
    const attributes = [...(model.attributes || []), attributeData];
    this.dataModelService.updateDataModel(model.id, { attributes });
    this.cancelAddingAttribute();
  }

  startEditingAttributeField(attribute: DataModelAttribute, field: 'name' | 'description') {
    this.editingAttributeField.set({ attributeId: attribute.id, field });
    this.editingAttributeFieldValue.set(attribute[field] || '');
  }

  cancelEditingAttributeField() {
    this.editingAttributeField.set(null);
    this.editingAttributeFieldValue.set('');
  }

  saveAttributeField(attributeId: string, field: 'name' | 'description') {
    const value = this.editingAttributeFieldValue().trim();
    if (field === 'name' && !value) {
      this.cancelEditingAttributeField();
      return;
    }

    const model = this.dataModel();
    const attributes = (model.attributes || []).map(attr => {
      if (attr.id === attributeId) {
        return { ...attr, [field]: value };
      }
      return attr;
    });

    this.dataModelService.updateDataModel(model.id, { attributes });
    this.cancelEditingAttributeField();
  }

  isEditingAttributeField(attributeId: string, field: 'name' | 'description'): boolean {
    const editing = this.editingAttributeField();
    return editing?.attributeId === attributeId && editing?.field === field;
  }

  startEditingAttributeType(attribute: DataModelAttribute) {
    this.editingAttributeType.set(attribute.id);
  }

  cancelEditingAttributeType() {
    this.editingAttributeType.set(null);
  }

  isEditingAttributeType(attributeId: string): boolean {
    return this.editingAttributeType() === attributeId;
  }

  updateAttributeType(attributeId: string, newType: string) {
    const model = this.dataModel();
    const attributes = (model.attributes || []).map(attr => {
      if (attr.id === attributeId) {
        const updated: DataModelAttribute = {
          ...attr,
          type: newType
        };
        if (newType !== 'relationship') {
          updated.targetDataModelId = undefined;
          updated.relationshipType = undefined;
        }
        return updated;
      }
      return attr;
    });

    this.dataModelService.updateDataModel(model.id, { attributes });
    this.cancelEditingAttributeType();
  }

  startEditingAttributeRelationship(attribute: DataModelAttribute) {
    this.editingAttributeRelationship.set(attribute.id);
    this.dataModelSearchFilter.set('');
  }

  cancelEditingAttributeRelationship() {
    this.editingAttributeRelationship.set(null);
  }

  isEditingAttributeRelationship(attributeId: string): boolean {
    return this.editingAttributeRelationship() === attributeId;
  }

  updateAttributeRelationship(attributeId: string, targetDataModelId?: string, relationshipType?: RelationshipType) {
    const model = this.dataModel();
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

    this.dataModelService.updateDataModel(model.id, { attributes });
  }

  saveAttributeRelationship(attributeId: string) {
    this.cancelEditingAttributeRelationship();
  }

  updateAttributeRequired(attributeId: string, required: boolean) {
    const model = this.dataModel();
    const attributes = (model.attributes || []).map(attr => 
      attr.id === attributeId ? { ...attr, required } : attr
    );

    this.dataModelService.updateDataModel(model.id, { attributes });
  }

  deleteAttribute(attributeId: string) {
    if (confirm('Are you sure you want to delete this data element?')) {
      const model = this.dataModel();
      const attributes = (model.attributes || []).filter(a => a.id !== attributeId);
      this.dataModelService.updateDataModel(model.id, { attributes });
    }
  }

  isRelationshipType(type?: string): boolean {
    return type === 'relationship';
  }

  getDataModelName(dataModelId: string): string {
    return this.dataModels().find((dm: DataModel) => dm.id === dataModelId)?.name || 'Unknown';
  }

  getAvailableDataModels(): DataModel[] {
    const allModels = this.dataModels().filter(dm => dm.id !== this.dataModel().id);
    const filter = this.dataModelSearchFilter().toLowerCase().trim();
    if (!filter) {
      return allModels;
    }
    return allModels.filter(model => 
      model.name.toLowerCase().includes(filter) ||
      (model.description && model.description.toLowerCase().includes(filter))
    );
  }

  clearDataModelSearch() {
    this.dataModelSearchFilter.set('');
  }

  deleteDataModel() {
    if (confirm('Are you sure you want to delete this data model?')) {
      this.dataModelService.deleteDataModel(this.dataModel().id);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

