import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomainService } from '../../services/domain.service';
import { Domain } from '../../models/domain';
import { DomainCardComponent } from '../cards/domain-card/domain-card.component';
import { SearchInputComponent } from '../shared/search-input/search-input.component';

@Component({
  selector: 'app-domains',
  imports: [CommonModule, FormsModule, DomainCardComponent, SearchInputComponent],
  templateUrl: './domains.component.html',
  styleUrl: './domains.component.scss'
})
export class DomainsComponent {
  searchQuery = signal('');
  
  allDomains = computed(() => this.domainService.getDomains()());
  domains = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.allDomains();
    if (!query) return all;
    return all.filter(d => 
      d.name?.toLowerCase().includes(query) ||
      d.domainOwner?.toLowerCase().includes(query) ||
      d.domainSteward?.toLowerCase().includes(query) ||
      d.description?.toLowerCase().includes(query)
    );
  });
  
  showAddModal = signal(false);
  addModalErrors = signal<{ name?: string }>({});
  
  newDomain = signal<Partial<Domain>>({
    name: '',
    domainOwner: '',
    domainSteward: '',
    description: ''
  });

  constructor(
    private domainService: DomainService
  ) {}

  openAddModal() {
    this.newDomain.set({
      name: '',
      domainOwner: '',
      domainSteward: '',
      description: ''
    });
    this.addModalErrors.set({});
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  async addDomain() {
    const errors: { name?: string } = {};
    
    if (!this.newDomain().name?.trim()) {
      errors.name = 'Name is required';
    }
    
    this.addModalErrors.set(errors);
    
    if (Object.keys(errors).length === 0) {
      await this.domainService.addDomain({
        name: this.newDomain().name!.trim(),
        domainOwner: this.newDomain().domainOwner?.trim() || '',
        domainSteward: this.newDomain().domainSteward?.trim() || '',
        description: this.newDomain().description?.trim()
      });
      this.closeAddModal();
    }
  }
}

