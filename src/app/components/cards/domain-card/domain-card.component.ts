import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomainService } from '../../../services/domain.service';
import { DataModelService } from '../../../services/data-model.service';
import { Domain } from '../../../models/domain';

@Component({
  selector: 'app-domain-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './domain-card.component.html',
  styleUrl: './domain-card.component.scss'
})
export class DomainCardComponent {
  domain = input.required<Domain>();

  dataModels = computed(() => this.dataModelService.getDataModels()());
  
  // Get data models belonging to this domain
  domainDataModels = computed(() => {
    return this.dataModels().filter(dm => dm.domainId === this.domain().id);
  });

  // Inline editing
  editingField = signal<{ field: 'name' | 'domainOwner' | 'domainSteward' | 'description' } | null>(null);
  editingFieldValue = signal<string>('');

  constructor(
    private domainService: DomainService,
    private dataModelService: DataModelService
  ) {}

  // Field editing methods
  startEditingField(field: 'name' | 'domainOwner' | 'domainSteward' | 'description') {
    this.editingField.set({ field });
    this.editingFieldValue.set(this.domain()[field] || '');
  }

  cancelEditingField() {
    this.editingField.set(null);
    this.editingFieldValue.set('');
  }

  saveField(field: 'name' | 'domainOwner' | 'domainSteward' | 'description') {
    const value = this.editingFieldValue().trim();
    if (field === 'name' && !value) {
      this.cancelEditingField();
      return;
    }
    this.domainService.updateDomain(this.domain().id, { [field]: value });
    this.cancelEditingField();
  }

  isEditingField(field: 'name' | 'domainOwner' | 'domainSteward' | 'description'): boolean {
    const editing = this.editingField();
    return editing?.field === field;
  }

  deleteDomain() {
    const modelCount = this.domainDataModels().length;
    const message = modelCount > 0 
      ? `This domain has ${modelCount} data model(s) associated. Are you sure you want to delete it?`
      : 'Are you sure you want to delete this domain?';
    
    if (confirm(message)) {
      this.domainService.deleteDomain(this.domain().id);
    }
  }
}

