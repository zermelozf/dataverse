import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KPIService } from '../../services/kpi.service';
import { KPI } from '../../models/kpi';
import { KPICardComponent } from '../cards/kpi-card/kpi-card.component';
import { SearchInputComponent } from '../shared/search-input/search-input.component';

@Component({
  selector: 'app-kpis',
  imports: [CommonModule, FormsModule, KPICardComponent, SearchInputComponent],
  templateUrl: './kpis.component.html',
  styleUrl: './kpis.component.scss'
})
export class KPIsComponent {
  searchQuery = signal('');
  
  allKPIs = computed(() => this.kpiService.getKPIs()());
  kpis = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.allKPIs();
    if (!query) return all;
    return all.filter(k => 
      k.name?.toLowerCase().includes(query) ||
      k.description?.toLowerCase().includes(query) ||
      k.unit?.toLowerCase().includes(query) ||
      k.targetValue?.toLowerCase().includes(query)
    );
  });
  
  showAddModal = signal(false);
  addModalErrors = signal<{ name?: string }>({});
  
  newKPI = signal<Partial<KPI>>({
    name: '',
    description: '',
    unit: '',
    targetValue: ''
  });

  constructor(
    private kpiService: KPIService
  ) {}

  openAddModal() {
    this.newKPI.set({
      name: '',
      description: '',
      unit: '',
      targetValue: ''
    });
    this.addModalErrors.set({});
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  async addKPI() {
    const errors: { name?: string } = {};
    
    if (!this.newKPI().name?.trim()) {
      errors.name = 'Name is required';
    }
    
    this.addModalErrors.set(errors);
    
    if (Object.keys(errors).length === 0) {
      await this.kpiService.addKPI({
        name: this.newKPI().name!.trim(),
        description: this.newKPI().description?.trim(),
        unit: this.newKPI().unit?.trim(),
        targetValue: this.newKPI().targetValue?.trim()
      });
      this.closeAddModal();
    }
  }
}

