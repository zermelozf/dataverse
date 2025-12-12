import { Component, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataModelService } from '../../services/data-model.service';
import { UseCaseService } from '../../services/use-case.service';
import { ToolService } from '../../services/tool.service';
import { PersonaService } from '../../services/persona.service';
import { PersonaCardComponent } from '../cards/persona-card/persona-card.component';
import { UseCaseCardComponent } from '../cards/use-case-card/use-case-card.component';
import { ToolCardComponent } from '../cards/tool-card/tool-card.component';
import { DataModelCardComponent } from '../cards/data-model-card/data-model-card.component';
import { FlowGraphComponent } from '../flow-graph/flow-graph.component';
import { SearchInputComponent } from '../shared/search-input/search-input.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    PersonaCardComponent, 
    UseCaseCardComponent, 
    ToolCardComponent, 
    DataModelCardComponent,
    FlowGraphComponent,
    SearchInputComponent
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})
export class SearchComponent {
  private personaService = inject(PersonaService);

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-dropdown-container')) {
      this.filterDropdownOpen.set(false);
    }
  }
  private useCaseService = inject(UseCaseService);
  private toolService = inject(ToolService);
  private dataModelService = inject(DataModelService);

  searchQuery = signal<string>('');
  
  // Search type filters (which entity types to search in)
  searchInPersonas = signal<boolean>(true);
  searchInUseCases = signal<boolean>(true);
  searchInTools = signal<boolean>(true);
  searchInDataModels = signal<boolean>(true);
  filterDropdownOpen = signal<boolean>(false);
  
  // Computed search filters object for flow-graph
  searchFilters = computed(() => ({
    personas: this.searchInPersonas(),
    useCases: this.searchInUseCases(),
    tools: this.searchInTools(),
    dataModels: this.searchInDataModels()
  }));
  
  // Highlighted node (for click-to-highlight connected component)
  highlightedNodeId = signal<string | null>(null);

  // Modal state
  showNodeModal = signal<boolean>(false);
  modalNodeId = signal<string | null>(null);

  // Data from services
  personas = computed(() => this.personaService.getPersonas()());
  useCases = computed(() => this.useCaseService.getUseCases()());
  tools = computed(() => this.toolService.getTools()());
  dataModels = computed(() => this.dataModelService.getDataModels()());

  toggleSearchFilter(type: 'personas' | 'useCases' | 'tools' | 'dataModels') {
    switch (type) {
      case 'personas':
        this.searchInPersonas.update(v => !v);
        break;
      case 'useCases':
        this.searchInUseCases.update(v => !v);
        break;
      case 'tools':
        this.searchInTools.update(v => !v);
        break;
      case 'dataModels':
        this.searchInDataModels.update(v => !v);
        break;
    }
  }

  toggleFilterDropdown() {
    this.filterDropdownOpen.update(v => !v);
  }

  closeFilterDropdown() {
    this.filterDropdownOpen.set(false);
  }

  getSelectedFiltersLabel(): string {
    const selected: string[] = [];
    if (this.searchInPersonas()) selected.push('Personas');
    if (this.searchInUseCases()) selected.push('Use Cases');
    if (this.searchInTools()) selected.push('Tools');
    if (this.searchInDataModels()) selected.push('Data Models');
    
    if (selected.length === 0) return 'None';
    if (selected.length === 4) return 'All';
    if (selected.length <= 2) return selected.join(', ');
    return `${selected.length} types`;
  }

  // Handle node click - highlight connected component
  onFlowNodeClicked(event: { type: string; id: string }) {
    // Build node ID matching the flow graph format (lowercase for usecase/datamodel)
    const nodeId = this.buildFlowNodeId(event.type, event.id);
    // Toggle highlight - if same node clicked, unhighlight
    if (this.highlightedNodeId() === nodeId) {
      this.highlightedNodeId.set(null);
    } else {
      this.highlightedNodeId.set(nodeId);
    }
  }

  // Build node ID matching flow graph format
  private buildFlowNodeId(type: string, id: string): string {
    // Flow graph uses lowercase prefixes: persona_, usecase_, tool_, datamodel_
    switch (type) {
      case 'persona': return `persona_${id}`;
      case 'useCase': return `usecase_${id}`;
      case 'tool': return `tool_${id}`;
      case 'dataModel': return `datamodel_${id}`;
      default: return `${type}_${id}`;
    }
  }

  // Handle double-click on node - show details modal
  onFlowNodeDoubleClicked(event: { type: string; id: string }) {
    this.modalNodeId.set(`${event.type}_${event.id}`);
    this.showNodeModal.set(true);
  }

  // Handle right-click on node (context menu handled by flow-graph)
  onFlowNodeRightClicked(event: { type: string; id: string; x: number; y: number }) {
    // Context menu is handled by flow-graph component
  }

  // Handle canvas click - clear highlight
  onCanvasClicked() {
    this.highlightedNodeId.set(null);
  }

  // View node details in modal
  onViewNode(event: { type: string; id: string }) {
    this.modalNodeId.set(`${event.type}_${event.id}`);
    this.showNodeModal.set(true);
  }

  // Delete node
  async onDeleteNode(event: { type: string; id: string }) {
    const confirmed = confirm(`Are you sure you want to delete this ${event.type}?`);
    if (!confirmed) return;

    try {
      switch (event.type) {
        case 'persona':
          await this.personaService.deletePersona(event.id);
          break;
        case 'useCase':
          await this.useCaseService.deleteUseCase(event.id);
          break;
        case 'tool':
          await this.toolService.deleteTool(event.id);
          break;
        case 'dataModel':
          await this.dataModelService.deleteDataModel(event.id);
          break;
      }
      // Clear highlight if the deleted node was highlighted
      if (this.highlightedNodeId()?.includes(event.id)) {
        this.highlightedNodeId.set(null);
      }
    } catch (error) {
      console.error('Error deleting node:', error);
    }
  }

  // Handle connection events (for potential notifications or logging)
  onConnectionCreated(event: { source: string; target: string; sourceType: string; targetType: string }) {
    console.log('Connection created:', event);
  }

  onConnectionDeleted(event: { source: string; target: string; sourceType: string; targetType: string }) {
    console.log('Connection deleted:', event);
  }

  // Modal helpers
  getModalNodeType(): string | null {
    const nodeId = this.modalNodeId();
    if (!nodeId) return null;
    
    if (nodeId.startsWith('persona_')) return 'persona';
    if (nodeId.startsWith('useCase_')) return 'useCase';
    if (nodeId.startsWith('tool_')) return 'tool';
    if (nodeId.startsWith('dataModel_')) return 'dataModel';
    return null;
  }

  getModalEntityId(): string | null {
    const nodeId = this.modalNodeId();
    if (!nodeId) return null;
    
    const parts = nodeId.split('_');
    return parts.slice(1).join('_');
  }

  getModalPersona() {
    const id = this.getModalEntityId();
    if (!id) return null;
    return this.personas().find(p => p.id === id) ?? null;
  }

  getModalUseCase() {
    const id = this.getModalEntityId();
    if (!id) return null;
    return this.useCases().find(u => u.id === id) ?? null;
  }

  getModalTool() {
    const id = this.getModalEntityId();
    if (!id) return null;
    return this.tools().find(t => t.id === id) ?? null;
  }

  getModalDataModel() {
    const id = this.getModalEntityId();
    if (!id) return null;
    return this.dataModels().find(m => m.id === id) ?? null;
  }

  closeNodeModal() {
    this.showNodeModal.set(false);
    this.modalNodeId.set(null);
  }

  // Create new entities
  async createNewPersona() {
    const newPersona = await this.personaService.addPersona({
      name: 'New Persona',
      description: '',
      personaUseCaseMappings: []
    });
    this.modalNodeId.set(`persona_${newPersona.id}`);
    this.showNodeModal.set(true);
  }

  async createNewUseCase() {
    const newUseCase = await this.useCaseService.addUseCase({
      persona: '',
      action: 'New Use Case',
      goal: '',
      useCaseToolMappings: []
    });
    this.modalNodeId.set(`useCase_${newUseCase.id}`);
    this.showNodeModal.set(true);
  }

  async createNewTool() {
    const newTool = await this.toolService.addTool({
      name: 'New Tool',
      description: '',
      useCaseToolMappings: []
    });
    this.modalNodeId.set(`tool_${newTool.id}`);
    this.showNodeModal.set(true);
  }

  async createNewDataModel() {
    const newDataModel = await this.dataModelService.addDataModel({
      name: 'New Data Model',
      description: '',
      attributes: []
    });
    this.modalNodeId.set(`dataModel_${newDataModel.id}`);
    this.showNodeModal.set(true);
  }
}
