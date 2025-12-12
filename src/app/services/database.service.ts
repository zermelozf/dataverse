import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { DataModel, DataModelImplementation } from '../models/data-model';
import { Tool } from '../models/tool';
import { UseCase } from '../models/use-case';
import { Persona } from '../models/persona';
import { Domain } from '../models/domain';
import { KPI } from '../models/kpi';
import { Project } from '../models/project';
import { MaturityAssessment } from '../models/maturity';
import { DashboardConfig } from '../models/dashboard-config';
import { ValueStream } from '../models/value-stream';

class DataverseDatabase extends Dexie {
  dataModels!: Table<DataModel, string>;
  implementations!: Table<DataModelImplementation, string>;
  tools!: Table<Tool, string>;
  useCases!: Table<UseCase, string>;
  personas!: Table<Persona, string>;
  domains!: Table<Domain, string>;
  kpis!: Table<KPI, string>;
  projects!: Table<Project, string>;
  maturityAssessments!: Table<MaturityAssessment, string>;
  dashboardConfig!: Table<DashboardConfig, string>;
  valueStreams!: Table<ValueStream, string>;

  constructor() {
    super('DataverseDB');
    this.version(1).stores({
      dataModels: 'id, name, version, createdAt, updatedAt',
      implementations: 'id, dataModelId, toolId, createdAt, updatedAt',
      tools: 'id, name, createdAt, updatedAt',
      useCases: 'id, name, createdAt, updatedAt',
      personas: 'id, name, createdAt, updatedAt'
    });
    this.version(2).stores({
      dataModels: 'id, name, domainId, version, createdAt, updatedAt',
      implementations: 'id, dataModelId, toolId, createdAt, updatedAt',
      tools: 'id, name, createdAt, updatedAt',
      useCases: 'id, name, createdAt, updatedAt',
      personas: 'id, name, createdAt, updatedAt',
      domains: 'id, name'
    });
    this.version(3).stores({
      dataModels: 'id, name, domainId, version, createdAt, updatedAt',
      implementations: 'id, dataModelId, toolId, createdAt, updatedAt',
      tools: 'id, name, createdAt, updatedAt',
      useCases: 'id, name, createdAt, updatedAt',
      personas: 'id, name, createdAt, updatedAt',
      domains: 'id, name',
      kpis: 'id, name, createdAt, updatedAt'
    });
    this.version(4).stores({
      dataModels: 'id, name, domainId, version, createdAt, updatedAt',
      implementations: 'id, dataModelId, toolId, createdAt, updatedAt',
      tools: 'id, name, createdAt, updatedAt',
      useCases: 'id, name, createdAt, updatedAt',
      personas: 'id, name, createdAt, updatedAt',
      domains: 'id, name',
      kpis: 'id, name, createdAt, updatedAt',
      projects: 'id, name, createdAt, updatedAt'
    });
    this.version(5).stores({
      dataModels: 'id, name, domainId, version, createdAt, updatedAt',
      implementations: 'id, dataModelId, toolId, createdAt, updatedAt',
      tools: 'id, name, createdAt, updatedAt',
      useCases: 'id, name, createdAt, updatedAt',
      personas: 'id, name, createdAt, updatedAt',
      domains: 'id, name',
      kpis: 'id, name, createdAt, updatedAt',
      projects: 'id, name, createdAt, updatedAt',
      maturityAssessments: 'id, type, updatedAt'
    });
    this.version(6).stores({
      dataModels: 'id, name, domainId, version, createdAt, updatedAt',
      implementations: 'id, dataModelId, toolId, createdAt, updatedAt',
      tools: 'id, name, createdAt, updatedAt',
      useCases: 'id, name, createdAt, updatedAt',
      personas: 'id, name, createdAt, updatedAt',
      domains: 'id, name',
      kpis: 'id, name, createdAt, updatedAt',
      projects: 'id, name, createdAt, updatedAt',
      maturityAssessments: 'id, type, updatedAt',
      dashboardConfig: 'id'
    });
    this.version(7).stores({
      dataModels: 'id, name, domainId, version, createdAt, updatedAt',
      implementations: 'id, dataModelId, toolId, createdAt, updatedAt',
      tools: 'id, name, createdAt, updatedAt',
      useCases: 'id, name, createdAt, updatedAt',
      personas: 'id, name, createdAt, updatedAt',
      domains: 'id, name',
      kpis: 'id, name, createdAt, updatedAt',
      projects: 'id, name, createdAt, updatedAt',
      maturityAssessments: 'id, type, updatedAt',
      dashboardConfig: 'id',
      valueStreams: 'id, name, type, createdAt, updatedAt'
    });
  }
}

export interface DataverseExport {
  version: string;
  exportDate: string;
  dataModels: DataModel[];
  implementations: DataModelImplementation[];
  tools: Tool[];
  useCases: UseCase[];
  personas: Persona[];
  domains?: Domain[];
  kpis?: KPI[];
  projects?: Project[];
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private db = new DataverseDatabase();

  get dataModels() {
    return this.db.dataModels;
  }

  get implementations() {
    return this.db.implementations;
  }

  get tools() {
    return this.db.tools;
  }

  get useCases() {
    return this.db.useCases;
  }

  get personas() {
    return this.db.personas;
  }

  get domains() {
    return this.db.domains;
  }

  get kpis() {
    return this.db.kpis;
  }

  get projects() {
    return this.db.projects;
  }

  get maturityAssessments() {
    return this.db.maturityAssessments;
  }

  get dashboardConfig() {
    return this.db.dashboardConfig;
  }

  get valueStreams() {
    return this.db.valueStreams;
  }

  async exportData(): Promise<DataverseExport> {
    const [dataModels, implementations, tools, useCases, personas, domains, kpis, projects] = await Promise.all([
      this.db.dataModels.toArray(),
      this.db.implementations.toArray(),
      this.db.tools.toArray(),
      this.db.useCases.toArray(),
      this.db.personas.toArray(),
      this.db.domains.toArray(),
      this.db.kpis.toArray(),
      this.db.projects.toArray()
    ]);

    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      dataModels,
      implementations,
      tools,
      useCases,
      personas,
      domains,
      kpis,
      projects
    };
  }

  async exportToFile(): Promise<void> {
    const data = await this.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dataverse-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async importData(data: DataverseExport): Promise<void> {
    // Validate the import data structure
    if (!data.version || !data.exportDate) {
      throw new Error('Invalid export file format');
    }

    // Validate required arrays exist
    if (!Array.isArray(data.dataModels) || !Array.isArray(data.implementations) || 
        !Array.isArray(data.tools) || !Array.isArray(data.useCases) || !Array.isArray(data.personas)) {
      throw new Error('Invalid export file structure: missing required data arrays');
    }

    // Clear existing data
    await Promise.all([
      this.db.dataModels.clear(),
      this.db.implementations.clear(),
      this.db.tools.clear(),
      this.db.useCases.clear(),
      this.db.personas.clear(),
      this.db.domains.clear(),
      this.db.kpis.clear(),
      this.db.projects.clear()
    ]);

    // Import new data using bulkPut (safer than bulkAdd, handles duplicates)
    if (data.dataModels.length > 0) {
      await this.db.dataModels.bulkPut(data.dataModels);
    }
    if (data.implementations.length > 0) {
      await this.db.implementations.bulkPut(data.implementations);
    }
    if (data.tools.length > 0) {
      await this.db.tools.bulkPut(data.tools);
    }
    if (data.useCases.length > 0) {
      await this.db.useCases.bulkPut(data.useCases);
    }
    if (data.personas.length > 0) {
      await this.db.personas.bulkPut(data.personas);
    }
    if (data.domains && data.domains.length > 0) {
      await this.db.domains.bulkPut(data.domains);
    }
    if (data.kpis && data.kpis.length > 0) {
      await this.db.kpis.bulkPut(data.kpis);
    }
    if (data.projects && data.projects.length > 0) {
      await this.db.projects.bulkPut(data.projects);
    }
  }

  async importFromFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const data: DataverseExport = JSON.parse(text);
          await this.importData(data);
          resolve();
        } catch (error) {
          reject(new Error('Failed to parse import file: ' + (error instanceof Error ? error.message : String(error))));
        }
      };
      reader.onerror = () => {
        reject(new Error('Failed to read import file'));
      };
      reader.readAsText(file);
    });
  }
}

