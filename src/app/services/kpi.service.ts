import { Injectable, signal } from '@angular/core';
import { DatabaseService } from './database.service';
import { KPI } from '../models/kpi';

@Injectable({
  providedIn: 'root'
})
export class KPIService {
  private kpisSignal = signal<KPI[]>([]);

  constructor(private db: DatabaseService) {
    this.loadKPIs();
  }

  private async loadKPIs() {
    const kpis = await this.db.kpis.toArray();
    this.kpisSignal.set(kpis);
  }

  getKPIs() {
    return this.kpisSignal;
  }

  async addKPI(kpi: Omit<KPI, 'id' | 'createdAt' | 'updatedAt'>): Promise<KPI> {
    const now = new Date();
    const newKPI: KPI = {
      ...kpi,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    await this.db.kpis.add(newKPI);
    this.kpisSignal.update(kpis => [...kpis, newKPI]);
    return newKPI;
  }

  async updateKPI(id: string, updates: Partial<KPI>) {
    const updatedData = { ...updates, updatedAt: new Date() };
    await this.db.kpis.update(id, updatedData);
    this.kpisSignal.update(kpis =>
      kpis.map(k => k.id === id ? { ...k, ...updatedData } : k)
    );
  }

  async deleteKPI(id: string) {
    await this.db.kpis.delete(id);
    this.kpisSignal.update(kpis => kpis.filter(k => k.id !== id));
  }

  getKPIById(id: string): KPI | undefined {
    return this.kpisSignal().find(k => k.id === id);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

