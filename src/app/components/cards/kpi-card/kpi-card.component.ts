import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KPIService } from '../../../services/kpi.service';
import { PersonaService } from '../../../services/persona.service';
import { KPI } from '../../../models/kpi';

@Component({
  selector: 'app-kpi-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss'
})
export class KPICardComponent {
  kpi = input.required<KPI>();

  personas = computed(() => this.personaService.getPersonas()());
  
  // Get personas that have this KPI
  kpiPersonas = computed(() => {
    return this.personas().filter(p => p.kpiIds?.includes(this.kpi().id));
  });

  // Inline editing
  editingField = signal<{ field: 'name' | 'description' | 'unit' | 'targetValue' } | null>(null);
  editingFieldValue = signal<string>('');

  constructor(
    private kpiService: KPIService,
    private personaService: PersonaService
  ) {}

  // Field editing methods
  startEditingField(field: 'name' | 'description' | 'unit' | 'targetValue') {
    this.editingField.set({ field });
    this.editingFieldValue.set(this.kpi()[field] || '');
  }

  cancelEditingField() {
    this.editingField.set(null);
    this.editingFieldValue.set('');
  }

  saveField(field: 'name' | 'description' | 'unit' | 'targetValue') {
    const value = this.editingFieldValue().trim();
    if (field === 'name' && !value) {
      this.cancelEditingField();
      return;
    }
    this.kpiService.updateKPI(this.kpi().id, { [field]: value });
    this.cancelEditingField();
  }

  isEditingField(field: 'name' | 'description' | 'unit' | 'targetValue'): boolean {
    const editing = this.editingField();
    return editing?.field === field;
  }

  deleteKPI() {
    const personaCount = this.kpiPersonas().length;
    const message = personaCount > 0 
      ? `This KPI is associated with ${personaCount} persona(s). Are you sure you want to delete it?`
      : 'Are you sure you want to delete this KPI?';
    
    if (confirm(message)) {
      this.kpiService.deleteKPI(this.kpi().id);
    }
  }
}

