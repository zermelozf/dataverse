import { Injectable, signal, effect } from '@angular/core';
import { DataModel, DataModelImplementation } from '../models/data-model';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class DataModelService {
  private dataModels = signal<DataModel[]>([]);
  private implementations = signal<DataModelImplementation[]>([]);
  private initialized = false;

  constructor(private db: DatabaseService) {
    this.loadData();
    
    // Auto-save to IndexedDB whenever signals change
    effect(() => {
      if (this.initialized) {
        this.saveDataModels();
      }
    });
    
    effect(() => {
      if (this.initialized) {
        this.saveImplementations();
      }
    });
  }

  private async loadData() {
    try {
      const [models, impls] = await Promise.all([
        this.db.dataModels.toArray(),
        this.db.implementations.toArray()
      ]);
      
      // Convert date strings back to Date objects and migrate old relationships to attributes
      const modelsWithDates = models.map((m: any) => {
        const attributes = m.attributes || [];
        // Migrate old relationships to attributes if they exist (for backward compatibility)
        if (m.relationships && Array.isArray(m.relationships) && m.relationships.length > 0) {
          const relationshipAttributes = m.relationships.map((rel: any) => ({
            id: rel.id,
            name: rel.name,
            type: 'relationship',
            description: rel.description,
            required: rel.required,
            targetDataModelId: rel.targetDataModelId,
            relationshipType: rel.relationshipType
          }));
          attributes.push(...relationshipAttributes);
        }
        // Remove version field if it exists (migration)
        const { version, ...modelWithoutVersion } = m;
        return {
          ...modelWithoutVersion,
          attributes,
          createdAt: new Date(m.createdAt),
          updatedAt: new Date(m.updatedAt)
        };
      });
      
      const implsWithDates = impls.map(i => ({
        ...i,
        createdAt: new Date(i.createdAt),
        updatedAt: new Date(i.updatedAt)
      }));
      
      this.dataModels.set(modelsWithDates);
      this.implementations.set(implsWithDates);
      this.initialized = true;
    } catch (error) {
      console.error('Error loading data from IndexedDB:', error);
      this.initialized = true;
    }
  }

  private async saveDataModels() {
    try {
      // Dexie automatically handles Date serialization
      const modelsToSave = this.dataModels().map(model => ({
        ...model,
        attributes: model.attributes || []
      }));
      await this.db.dataModels.bulkPut(modelsToSave as any);
    } catch (error) {
      console.error('Error saving data models to IndexedDB:', error);
      console.error('Current models:', this.dataModels());
    }
  }

  private async saveImplementations() {
    try {
      // Dexie automatically handles Date serialization
      await this.db.implementations.bulkPut(this.implementations() as any);
    } catch (error) {
      console.error('Error saving implementations to IndexedDB:', error);
    }
  }

  getDataModels() {
    return this.dataModels.asReadonly();
  }

  getDataModel(id: string): DataModel | undefined {
    return this.dataModels().find(dm => dm.id === id);
  }

  async addDataModel(dataModel: Omit<DataModel, 'id' | 'createdAt' | 'updatedAt'>) {
    const newModel: DataModel = {
      ...dataModel,
      attributes: dataModel.attributes || [],
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.dataModels.update(models => [...models, newModel]);
    // Explicitly save to ensure persistence
    await this.saveDataModels();
    return newModel;
  }

  async updateDataModel(id: string, updates: Partial<DataModel>) {
    this.dataModels.update(models =>
      models.map(model =>
        model.id === id
          ? { 
              ...model, 
              ...updates, 
              attributes: updates.attributes !== undefined ? updates.attributes : model.attributes,
              updatedAt: new Date() 
            }
          : model
      )
    );
    // Explicitly save to ensure persistence
    await this.saveDataModels();
  }

  async deleteDataModel(id: string) {
    this.dataModels.update(models => models.filter(model => model.id !== id));
    // Also delete related implementations
    this.implementations.update(impls => impls.filter(impl => impl.dataModelId !== id));
    try {
      await this.db.implementations.where('dataModelId').equals(id).delete();
    } catch (error) {
      console.error('Error deleting implementations from IndexedDB:', error);
    }
  }

  getImplementations() {
    return this.implementations.asReadonly();
  }

  getImplementationsByDataModel(dataModelId: string): DataModelImplementation[] {
    return this.implementations().filter(impl => impl.dataModelId === dataModelId);
  }

  getImplementationsByTool(toolId: string): DataModelImplementation[] {
    return this.implementations().filter(impl => impl.toolId === toolId);
  }

  async addImplementation(implementation: Omit<DataModelImplementation, 'id' | 'createdAt' | 'updatedAt'>) {
    const newImpl: DataModelImplementation = {
      ...implementation,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.implementations.update(impls => [...impls, newImpl]);
    // Explicitly save to ensure persistence
    await this.saveImplementations();
    return newImpl;
  }

  async updateImplementation(id: string, updates: Partial<DataModelImplementation>) {
    this.implementations.update(impls =>
      impls.map(impl =>
        impl.id === id
          ? { ...impl, ...updates, updatedAt: new Date() }
          : impl
      )
    );
    // Explicitly save to ensure persistence
    await this.saveImplementations();
  }

  async deleteImplementation(id: string) {
    this.implementations.update(impls => impls.filter(impl => impl.id !== id));
    try {
      await this.db.implementations.delete(id);
    } catch (error) {
      console.error('Error deleting implementation from IndexedDB:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

