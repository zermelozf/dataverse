import { Injectable, signal, effect } from '@angular/core';
import { DashboardConfig } from '../models/dashboard-config';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardConfigService {
  private config = signal<DashboardConfig | null>(null);
  private initialized = false;

  constructor(private db: DatabaseService) {
    this.loadConfig();
    
    effect(() => {
      if (this.initialized && this.config()) {
        this.saveConfig();
      }
    });
  }

  private async loadConfig() {
    try {
      const configs = await this.db.dashboardConfig.toArray();
      if (configs.length > 0) {
        this.config.set({
          ...configs[0],
          updatedAt: new Date(configs[0].updatedAt)
        });
      } else {
        // Create default config
        const defaultConfig: DashboardConfig = {
          id: 'default',
          performanceKPIOrder: [],
          updatedAt: new Date()
        };
        this.config.set(defaultConfig);
      }
      this.initialized = true;
    } catch (error) {
      console.error('Error loading dashboard config from IndexedDB:', error);
      this.initialized = true;
    }
  }

  private async saveConfig() {
    try {
      const currentConfig = this.config();
      if (currentConfig) {
        await this.db.dashboardConfig.put(currentConfig);
      }
    } catch (error) {
      console.error('Error saving dashboard config to IndexedDB:', error);
    }
  }

  getConfig() {
    return this.config.asReadonly();
  }

  getPerformanceKPIOrder(): string[] {
    return this.config()?.performanceKPIOrder ?? [];
  }

  async setPerformanceKPIOrder(order: string[]) {
    const currentConfig = this.config();
    if (currentConfig) {
      this.config.set({
        ...currentConfig,
        performanceKPIOrder: order,
        updatedAt: new Date()
      });
      await this.saveConfig();
    }
  }

  async addKPIToOrder(kpiId: string) {
    const currentOrder = this.getPerformanceKPIOrder();
    if (!currentOrder.includes(kpiId)) {
      await this.setPerformanceKPIOrder([...currentOrder, kpiId]);
    }
  }

  async removeKPIFromOrder(kpiId: string) {
    const currentOrder = this.getPerformanceKPIOrder();
    await this.setPerformanceKPIOrder(currentOrder.filter(id => id !== kpiId));
  }
}
