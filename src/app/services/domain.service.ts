import { Injectable, signal } from '@angular/core';
import { DatabaseService } from './database.service';
import { Domain } from '../models/domain';

@Injectable({
  providedIn: 'root'
})
export class DomainService {
  private domainsSignal = signal<Domain[]>([]);

  constructor(private db: DatabaseService) {
    this.loadDomains();
  }

  private async loadDomains() {
    const domains = await this.db.domains.toArray();
    this.domainsSignal.set(domains);
  }

  getDomains() {
    return this.domainsSignal;
  }

  async addDomain(domain: Omit<Domain, 'id'>): Promise<Domain> {
    const newDomain: Domain = {
      ...domain,
      id: this.generateId()
    };
    await this.db.domains.add(newDomain);
    this.domainsSignal.update(domains => [...domains, newDomain]);
    return newDomain;
  }

  async updateDomain(id: string, updates: Partial<Domain>) {
    await this.db.domains.update(id, updates);
    this.domainsSignal.update(domains =>
      domains.map(d => d.id === id ? { ...d, ...updates } : d)
    );
  }

  async deleteDomain(id: string) {
    await this.db.domains.delete(id);
    this.domainsSignal.update(domains => domains.filter(d => d.id !== id));
  }

  getDomainById(id: string): Domain | undefined {
    return this.domainsSignal().find(d => d.id === id);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

