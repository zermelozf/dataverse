import { Injectable, signal, effect } from '@angular/core';
import { Persona } from '../models/persona';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class PersonaService {
  private personas = signal<Persona[]>([]);
  private initialized = false;

  constructor(private db: DatabaseService) {
    this.loadData();
    
    effect(() => {
      if (this.initialized) {
        this.savePersonas();
      }
    });
  }

  private async loadData() {
    try {
      const personas = await this.db.personas.toArray();
      const personasWithDates = personas.map((p: any) => {
        // Migrate old useCaseToolMappings to personaUseCaseMappings
        let mappings = p.personaUseCaseMappings || p.useCaseToolMappings || [];
        
        // If old format has useCaseIds but no mappings, create mappings from useCaseIds
        if (p.useCaseIds && p.useCaseIds.length > 0 && mappings.length === 0) {
          mappings = p.useCaseIds.map((useCaseId: string) => ({
            useCaseId,
            toolIds: []
          }));
        }
        
        return {
          ...p,
          personaUseCaseMappings: mappings,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt)
        };
      });
      this.personas.set(personasWithDates);
      this.initialized = true;
    } catch (error) {
      console.error('Error loading personas from IndexedDB:', error);
      this.initialized = true;
    }
  }

  private async savePersonas() {
    try {
      await this.db.personas.bulkPut(this.personas());
    } catch (error) {
      console.error('Error saving personas to IndexedDB:', error);
    }
  }

  getPersonas() {
    return this.personas.asReadonly();
  }

  getPersona(id: string): Persona | undefined {
    return this.personas().find(p => p.id === id);
  }

  async addPersona(persona: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>) {
    const newPersona: Persona = {
      ...persona,
      personaUseCaseMappings: persona.personaUseCaseMappings || [],
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.personas.update(personas => [...personas, newPersona]);
    // Explicitly save to ensure persistence
    await this.savePersonas();
    return newPersona;
  }

  async updatePersona(id: string, updates: Partial<Persona>) {
    console.log(`Updating persona ${id} with:`, updates);
    this.personas.update(personas => {
      const updated = personas.map(p =>
        p.id === id
          ? { ...p, ...updates, updatedAt: new Date() }
          : p
      );
      console.log(`Persona ${id} after update:`, updated.find(p => p.id === id));
      return updated;
    });
    // Explicitly save to ensure persistence
    await this.savePersonas();
  }

  async deletePersona(id: string) {
    this.personas.update(personas => personas.filter(p => p.id !== id));
    try {
      await this.db.personas.delete(id);
    } catch (error) {
      console.error('Error deleting persona from IndexedDB:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

