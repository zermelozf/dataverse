import { Component, computed, signal, inject, Output, EventEmitter, input, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  VflowComponent, 
  Node, 
  Edge, 
  Connection,
  HandleComponent,
  NodeHtmlTemplateDirective,
  ConnectionControllerDirective
} from 'ngx-vflow';
import { DataModelService } from '../../services/data-model.service';
import { UseCaseService } from '../../services/use-case.service';
import { ToolService } from '../../services/tool.service';
import { PersonaService } from '../../services/persona.service';
import { Persona } from '../../models/persona';
import { UseCase } from '../../models/use-case';
import { Tool } from '../../models/tool';
import { DataModel } from '../../models/data-model';

// Node data interfaces
export interface PersonaNodeData {
  type: 'persona';
  entity: Persona;
}

export interface UseCaseNodeData {
  type: 'useCase';
  entity: UseCase;
}

export interface ToolNodeData {
  type: 'tool';
  entity: Tool;
}

export interface DataModelNodeData {
  type: 'dataModel';
  entity: DataModel;
}

export interface AddButtonNodeData {
  type: 'addButton';
  entityType: 'persona' | 'useCase' | 'tool' | 'dataModel';
}

export type FlowNodeData = PersonaNodeData | UseCaseNodeData | ToolNodeData | DataModelNodeData | AddButtonNodeData;

@Component({
  selector: 'app-flow-graph',
  standalone: true,
  imports: [
    CommonModule, 
    VflowComponent, 
    HandleComponent,
    NodeHtmlTemplateDirective,
    ConnectionControllerDirective
  ],
  templateUrl: './flow-graph.component.html',
  styleUrl: './flow-graph.component.scss'
})
export class FlowGraphComponent implements AfterViewInit {
  @ViewChild(VflowComponent) vflow!: VflowComponent;
  
  // Use signal input for reactive search
  searchQuery = input<string>('');
  highlightedNodeId = input<string | null>(null);
  // Search filters - controls which entity types are included in search matching (not visibility)
  searchFilters = input<{ personas: boolean; useCases: boolean; tools: boolean; dataModels: boolean }>({
    personas: true,
    useCases: true,
    tools: true,
    dataModels: true
  });
  
  @Output() nodeClicked = new EventEmitter<{ type: string; id: string }>();
  @Output() nodeDoubleClicked = new EventEmitter<{ type: string; id: string }>();
  @Output() nodeRightClicked = new EventEmitter<{ type: string; id: string; x: number; y: number }>();
  @Output() viewNode = new EventEmitter<{ type: string; id: string }>();
  @Output() deleteNode = new EventEmitter<{ type: string; id: string }>();
  @Output() connectionCreated = new EventEmitter<{ source: string; target: string; sourceType: string; targetType: string }>();
  @Output() connectionDeleted = new EventEmitter<{ source: string; target: string; sourceType: string; targetType: string }>();
  @Output() canvasClicked = new EventEmitter<void>();
  @Output() createPersona = new EventEmitter<void>();
  @Output() createUseCase = new EventEmitter<void>();
  @Output() createTool = new EventEmitter<void>();
  @Output() createDataModel = new EventEmitter<void>();

  // Context menu state
  contextMenuVisible = signal(false);
  contextMenuPosition = signal({ x: 0, y: 0 });
  contextMenuNodeId = signal<string | null>(null);
  contextMenuNodeType = signal<string | null>(null);
  contextMenuEdgeId = signal<string | null>(null);
  contextMenuMode = signal<'node' | 'edge'>('node');

  private personaService = inject(PersonaService);
  private useCaseService = inject(UseCaseService);
  private toolService = inject(ToolService);
  private dataModelService = inject(DataModelService);

  ngAfterViewInit() {
    // Wait for vflow to be initialized, then fit view
    if (this.vflow) {
      // Subscribe to initialized$ observable to know when vflow is ready
      this.vflow.initialized$.subscribe(initialized => {
        if (initialized) {
          // Multiple fitView calls to ensure it works reliably
          // First call after a short delay
          setTimeout(() => {
            this.fitView();
          }, 100);
          
          // Second call after nodes are fully rendered
          setTimeout(() => {
            this.fitView();
          }, 300);
          
          // Final call as a fallback
          setTimeout(() => {
            this.fitView();
          }, 500);
        }
      });
    }
  }

  // Handle right-click at document level for edges
  @HostListener('document:contextmenu', ['$event'])
  handleContextMenu(event: MouseEvent) {
    const target = event.target as Element;
    
    // Check if clicked on an SVG path (edges are paths)
    if (target.tagName.toLowerCase() === 'path') {
      const selectedEdge = this.selectedEdgeId();
      
      console.log('Context menu on path, selected edge:', selectedEdge);
      
      if (selectedEdge) {
        event.preventDefault();
        event.stopPropagation();
        
        this.contextMenuPosition.set({ x: event.clientX, y: event.clientY });
        this.contextMenuEdgeId.set(selectedEdge);
        this.contextMenuMode.set('edge');
        this.contextMenuVisible.set(true);
      }
    }
  }

  // Handle keyboard events for edge deletion
  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    // Delete selected edge when Delete or Backspace is pressed
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selectedId = this.selectedEdgeId();
      if (selectedId) {
        // Prevent default browser behavior (like navigating back on Backspace)
        event.preventDefault();
        this.deleteEdge(selectedId);
        this.selectedEdgeId.set(null);
      }
    }
    // Escape to deselect
    if (event.key === 'Escape') {
      this.selectedEdgeId.set(null);
    }
  }

  // Handle edge click to select it
  onEdgeClick(edgeId: string) {
    // Toggle selection
    if (this.selectedEdgeId() === edgeId) {
      this.selectedEdgeId.set(null);
    } else {
      this.selectedEdgeId.set(edgeId);
    }
  }

  // Track last selection time to debounce rapid events
  private lastEdgeSelectTime = 0;
  private lastSelectedEdgeId: string | null = null;

  // Handle edge selection from vflow
  onEdgeSelect(event: any) {
    const now = Date.now();
    
    // Debounce rapid events (within 100ms)
    if (now - this.lastEdgeSelectTime < 100) {
      return;
    }
    
    let newSelectedId: string | null = null;
    
    if (Array.isArray(event)) {
      // Handle array of edge changes - find selected edge
      for (const change of event) {
        if (change.selected && change.id) {
          newSelectedId = change.id;
          break;
        }
      }
    } else if (event && typeof event === 'object' && event.id) {
      if (event.selected) {
        newSelectedId = event.id;
      }
    } else if (typeof event === 'string') {
      newSelectedId = event;
    }
    
    // Only update if we have a new selection
    if (newSelectedId) {
      this.lastEdgeSelectTime = now;
      this.lastSelectedEdgeId = newSelectedId;
      this.selectedEdgeId.set(newSelectedId);
    }
  }

  // Raw data from services
  personas = computed(() => this.personaService.getPersonas()());
  useCases = computed(() => this.useCaseService.getUseCases()());
  tools = computed(() => this.toolService.getTools()());
  dataModels = computed(() => this.dataModelService.getDataModels()());
  implementations = computed(() => this.dataModelService.getImplementations()());

  // Selected edge for deletion
  selectedEdgeId = signal<string | null>(null);
  hoveredEdgeId = signal<string | null>(null);

  // Build base graph data - only depends on entity data, NOT search query or filters
  // This prevents nodes from being recreated on every keystroke
  // All nodes are always shown; filters only affect search matching
  private baseGraphData = computed(() => {
    
    // Column positions - left to right layout (350px spacing between columns)
    const columnX = {
      persona: 50,
      useCase: 400,
      tool: 750,
      dataModel: 1100
    };
    const nodeSpacing = 100;

    // First, build connection maps for ordering optimization
    const personaToUseCases = new Map<string, string[]>();
    const useCaseToPersonas = new Map<string, string[]>();
    const useCaseToTools = new Map<string, string[]>();
    const toolToUseCases = new Map<string, string[]>();
    const toolToDataModels = new Map<string, string[]>();
    const dataModelToTools = new Map<string, string[]>();

    // Build persona -> useCase connections
    this.personas().forEach(persona => {
      const personaId = persona.id;
      const useCaseIds = (persona.personaUseCaseMappings || []).map(m => m.useCaseId);
      personaToUseCases.set(personaId, useCaseIds);
      useCaseIds.forEach(ucId => {
        if (!useCaseToPersonas.has(ucId)) {
          useCaseToPersonas.set(ucId, []);
        }
        useCaseToPersonas.get(ucId)!.push(personaId);
      });
    });

    // Build useCase -> tool connections
    this.tools().forEach(tool => {
      const toolId = tool.id;
      const useCaseIds = (tool.useCaseToolMappings || []).map(m => m.useCaseId);
      toolToUseCases.set(toolId, useCaseIds);
      useCaseIds.forEach(ucId => {
        if (!useCaseToTools.has(ucId)) {
          useCaseToTools.set(ucId, []);
        }
        useCaseToTools.get(ucId)!.push(toolId);
      });
    });

    // Build tool -> dataModel connections
    this.implementations().forEach(impl => {
      if (!toolToDataModels.has(impl.toolId)) {
        toolToDataModels.set(impl.toolId, []);
      }
      toolToDataModels.get(impl.toolId)!.push(impl.dataModelId);
      
      if (!dataModelToTools.has(impl.dataModelId)) {
        dataModelToTools.set(impl.dataModelId, []);
      }
      dataModelToTools.get(impl.dataModelId)!.push(impl.toolId);
    });

    // Order entities using barycenter heuristic to minimize edge crossings
    const orderedPersonas = this.orderByBarycenter(
      this.personas().map(p => p.id),
      personaToUseCases,
      [] // No previous layer
    );

    const orderedUseCases = this.orderByBarycenter(
      this.useCases().map(uc => uc.id),
      useCaseToTools,
      orderedPersonas.map((id, idx) => ({ id, position: idx })),
      useCaseToPersonas
    );

    const orderedTools = this.orderByBarycenter(
      this.tools().map(t => t.id),
      toolToDataModels,
      orderedUseCases.map((id, idx) => ({ id, position: idx })),
      toolToUseCases
    );

    const orderedDataModels = this.orderByBarycenter(
      this.dataModels().map(dm => dm.id),
      new Map(), // No next layer
      orderedTools.map((id, idx) => ({ id, position: idx })),
      dataModelToTools
    );

    // Create position maps
    const personaPositions = new Map(orderedPersonas.map((id, idx) => [id, idx]));
    const useCasePositions = new Map(orderedUseCases.map((id, idx) => [id, idx]));
    const toolPositions = new Map(orderedTools.map((id, idx) => [id, idx]));
    const dataModelPositions = new Map(orderedDataModels.map((id, idx) => [id, idx]));

    // Build all nodes with optimized positions (always include all nodes)
    const allNodes: Node<FlowNodeData>[] = [];
    const nodeMap = new Map<string, Node<FlowNodeData>>();

    // Personas - Column 1
    this.personas().forEach((persona) => {
      const nodeId = `persona_${persona.id}`;
      const position = personaPositions.get(persona.id) ?? 0;
      
      const node: Node<FlowNodeData> = {
        id: nodeId,
        point: { x: columnX.persona, y: position * nodeSpacing + 50 },
        type: 'html-template',
        data: { type: 'persona', entity: persona } as PersonaNodeData
      };
      allNodes.push(node);
      nodeMap.set(nodeId, node);
    });

    // Use Cases - Column 2
    this.useCases().forEach((useCase) => {
      const nodeId = `usecase_${useCase.id}`;
      const position = useCasePositions.get(useCase.id) ?? 0;
      
      const node: Node<FlowNodeData> = {
        id: nodeId,
        point: { x: columnX.useCase, y: position * nodeSpacing + 50 },
        type: 'html-template',
        data: { type: 'useCase', entity: useCase } as UseCaseNodeData
      };
      allNodes.push(node);
      nodeMap.set(nodeId, node);
    });

    // Tools - Column 3
    this.tools().forEach((tool) => {
      const nodeId = `tool_${tool.id}`;
      const position = toolPositions.get(tool.id) ?? 0;
      
      const node: Node<FlowNodeData> = {
        id: nodeId,
        point: { x: columnX.tool, y: position * nodeSpacing + 50 },
        type: 'html-template',
        data: { type: 'tool', entity: tool } as ToolNodeData
      };
      allNodes.push(node);
      nodeMap.set(nodeId, node);
    });

    // Data Models - Column 4
    this.dataModels().forEach((dataModel) => {
      const nodeId = `datamodel_${dataModel.id}`;
      const position = dataModelPositions.get(dataModel.id) ?? 0;
      
      const node: Node<FlowNodeData> = {
        id: nodeId,
        point: { x: columnX.dataModel, y: position * nodeSpacing + 50 },
        type: 'html-template',
        data: { type: 'dataModel', entity: dataModel } as DataModelNodeData
      };
      allNodes.push(node);
      nodeMap.set(nodeId, node);
    });

    // Add "+" button nodes at the end of each column
    const personaCount = this.personas().length;
    const useCaseCount = this.useCases().length;
    const toolCount = this.tools().length;
    const dataModelCount = this.dataModels().length;

    // Offset to center the 40px add button under the ~175px wide nodes
    const addButtonCenterOffset = 55;

    allNodes.push({
      id: 'add_persona',
      point: { x: columnX.persona + addButtonCenterOffset, y: personaCount * nodeSpacing + 50 },
      type: 'html-template',
      data: { type: 'addButton', entityType: 'persona' } as AddButtonNodeData
    });

    allNodes.push({
      id: 'add_usecase',
      point: { x: columnX.useCase + addButtonCenterOffset, y: useCaseCount * nodeSpacing + 50 },
      type: 'html-template',
      data: { type: 'addButton', entityType: 'useCase' } as AddButtonNodeData
    });

    allNodes.push({
      id: 'add_tool',
      point: { x: columnX.tool + addButtonCenterOffset, y: toolCount * nodeSpacing + 50 },
      type: 'html-template',
      data: { type: 'addButton', entityType: 'tool' } as AddButtonNodeData
    });

    allNodes.push({
      id: 'add_datamodel',
      point: { x: columnX.dataModel + addButtonCenterOffset, y: dataModelCount * nodeSpacing + 50 },
      type: 'html-template',
      data: { type: 'addButton', entityType: 'dataModel' } as AddButtonNodeData
    });

    // Build all edges
    const allEdges: { id: string; source: string; target: string }[] = [];

    // Persona -> UseCase edges
    this.personas().forEach(persona => {
      (persona.personaUseCaseMappings || []).forEach(mapping => {
        allEdges.push({
          id: `persona_${persona.id}_usecase_${mapping.useCaseId}`,
          source: `persona_${persona.id}`,
          target: `usecase_${mapping.useCaseId}`
        });
      });
    });

    // UseCase -> Tool edges
    this.tools().forEach(tool => {
      (tool.useCaseToolMappings || []).forEach(mapping => {
        allEdges.push({
          id: `usecase_${mapping.useCaseId}_tool_${tool.id}`,
          source: `usecase_${mapping.useCaseId}`,
          target: `tool_${tool.id}`
        });
      });
    });

    // Tool -> DataModel edges
    this.implementations().forEach(impl => {
      allEdges.push({
        id: `tool_${impl.toolId}_datamodel_${impl.dataModelId}`,
        source: `tool_${impl.toolId}`,
        target: `datamodel_${impl.dataModelId}`
      });
    });

    // Filter edges to only include those between visible nodes (based on entity type filters)
    const visibleNodeIds = new Set(allNodes.map(n => n.id));
    const visibleEdges = allEdges.filter(e => 
      visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    return {
      nodes: allNodes,
      rawEdges: visibleEdges
    };
  });

  // Separate computed for search filtering - determines which nodes are visible based on search
  // This doesn't recreate nodes, just computes visibility
  // searchFilters controls which entity types are included in search matching
  private searchVisibility = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const baseData = this.baseGraphData();
    const filters = this.searchFilters();
    
    // If no search query, all nodes are visible
    if (!query) {
      return {
        visibleNodeIds: new Set(baseData.nodes.map(n => n.id)),
        matchingNodeIds: new Set<string>()
      };
    }

    // Find nodes that directly match the search query (respecting search filters)
    const matchingNodeIds = new Set<string>();
    
    baseData.nodes.forEach(node => {
      // Check if node has data property (html-template nodes do)
      if (!('data' in node) || !node.data) return;
      
      const data = node.data as FlowNodeData;
      let matches = false;
      
      switch (data.type) {
        case 'persona':
          if (filters.personas) {
            matches = data.entity.name.toLowerCase().includes(query) ||
              (data.entity.description?.toLowerCase().includes(query) ?? false);
          }
          break;
        case 'useCase':
          if (filters.useCases) {
            matches = (data.entity.name?.toLowerCase().includes(query) ?? false) ||
              (data.entity.action?.toLowerCase().includes(query) ?? false) ||
              (data.entity.goal?.toLowerCase().includes(query) ?? false);
          }
          break;
        case 'tool':
          if (filters.tools) {
            matches = data.entity.name.toLowerCase().includes(query) ||
              (data.entity.description?.toLowerCase().includes(query) ?? false);
          }
          break;
        case 'dataModel':
          if (filters.dataModels) {
            const attributesMatch = (data.entity.attributes || []).some(attr => 
              attr.name.toLowerCase().includes(query) ||
              (attr.type?.toLowerCase().includes(query) ?? false)
            );
            matches = data.entity.name.toLowerCase().includes(query) ||
              (data.entity.description?.toLowerCase().includes(query) ?? false) ||
              attributesMatch;
          }
          break;
      }
      
      if (matches) {
        matchingNodeIds.add(node.id);
      }
    });

    // Find connected component of matching nodes
    const visibleNodeIds = this.findConnectedNodes(matchingNodeIds, baseData.rawEdges);

    return {
      visibleNodeIds,
      matchingNodeIds
    };
  });

  // Compute highlighted connected nodes separately (doesn't trigger node redraw)
  private highlightedConnectedNodes = computed(() => {
    const highlightedId = this.highlightedNodeId();
    if (!highlightedId) return new Set<string>();
    
    const rawEdges = this.baseGraphData().rawEdges;
    return this.computeConnectedNodes(highlightedId, rawEdges);
  });

  // Compute connected nodes (BFS) - reusable helper
  private computeConnectedNodes(startNodeId: string, edges: { source: string; target: string }[]): Set<string> {
    const connected = new Set<string>();
    const queue = [startNodeId];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      connected.add(current);
      
      edges.forEach(edge => {
        if (edge.source === current && !visited.has(edge.target)) {
          queue.push(edge.target);
        }
        if (edge.target === current && !visited.has(edge.source)) {
          queue.push(edge.source);
        }
      });
    }
    
    return connected;
  }

  // Helper to create an edge with proper styling
  private createEdge(
    id: string, 
    source: string, 
    target: string, 
    hoveredId: string | null, 
    selectedId: string | null,
    highlightedConnectedNodes: Set<string>
  ): Edge<{ dimmed?: boolean; highlighted?: boolean }> {
    const isSelected = selectedId === id;
    const isHovered = hoveredId === id;
    const hasHighlight = highlightedConnectedNodes.size > 0;
    const isHighlighted = hasHighlight && highlightedConnectedNodes.has(source) && highlightedConnectedNodes.has(target);
    const isDimmed = hasHighlight && !isHighlighted;
    
    return {
      id,
      source,
      sourceHandle: 'source',
      target,
      targetHandle: 'target',
      data: { dimmed: isDimmed, highlighted: isHighlighted },
      markers: { 
        end: { 
          type: 'arrow', 
          color: isSelected ? '#3b82f6' : (isDimmed ? 'rgba(148, 163, 184, 0.3)' : undefined)
        } 
      }
    };
  }

  // Find all nodes connected to the matching nodes (BFS)
  private findConnectedNodes(matchingNodeIds: Set<string>, edges: { source: string; target: string }[]): Set<string> {
    if (matchingNodeIds.size === 0) {
      return new Set();
    }

    // Build adjacency list (undirected graph)
    const adjacency = new Map<string, Set<string>>();
    edges.forEach(edge => {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, new Set());
      }
      if (!adjacency.has(edge.target)) {
        adjacency.set(edge.target, new Set());
      }
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
    });

    // BFS from all matching nodes
    const visited = new Set<string>();
    const queue = Array.from(matchingNodeIds);
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const neighbors = adjacency.get(nodeId);
      if (neighbors) {
        neighbors.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        });
      }
    }

    return visited;
  }

  // Exposed computed properties for template
  // Filter visible nodes and reposition them to optimize space
  nodes = computed(() => {
    const baseNodes = this.baseGraphData().nodes;
    const visibility = this.searchVisibility();
    const query = this.searchQuery().trim();
    
    // If no search query, return all nodes as-is
    if (!query) {
      return baseNodes;
    }
    
    // Column settings
    const nodeSpacing = 100;
    const columnX = { persona: 50, useCase: 400, tool: 750, dataModel: 1100 };
    const addButtonCenterOffset = 55;
    
    // Separate nodes by type and filter visible ones
    const visibleByType: Record<string, Node<FlowNodeData>[]> = {
      persona: [],
      useCase: [],
      tool: [],
      dataModel: []
    };
    const addButtons: Node<FlowNodeData>[] = [];
    
    baseNodes.forEach(node => {
      if (!('data' in node) || !node.data) return;
      const data = node.data as FlowNodeData;
      
      if (data.type === 'addButton') {
        addButtons.push(node);
      } else if (visibility.visibleNodeIds.has(node.id)) {
        visibleByType[data.type].push(node);
      }
    });
    
    // Reposition visible nodes and add buttons
    const result: Node<FlowNodeData>[] = [];
    
    // Add repositioned entity nodes
    for (const type of ['persona', 'useCase', 'tool', 'dataModel'] as const) {
      visibleByType[type].forEach((node, index) => {
        result.push({
          ...node,
          point: { x: columnX[type], y: index * nodeSpacing + 50 }
        });
      });
    }
    
    // Add repositioned add buttons at end of each column
    addButtons.forEach(node => {
      if (!('data' in node) || !node.data) return;
      const data = node.data as AddButtonNodeData;
      const entityType = data.entityType;
      const count = visibleByType[entityType].length;
      result.push({
        ...node,
        point: { x: columnX[entityType] + addButtonCenterOffset, y: count * nodeSpacing + 50 }
      });
    });
    
    return result;
  });
  
  // Edges filtered to visible nodes
  edges = computed(() => {
    const rawEdges = this.baseGraphData().rawEdges;
    const highlightedConnected = this.highlightedConnectedNodes();
    const visibility = this.searchVisibility();
    
    const visibleEdges = rawEdges.filter(e => 
      visibility.visibleNodeIds.has(e.source) && visibility.visibleNodeIds.has(e.target)
    );
    
    return visibleEdges.map(e => this.createEdge(e.id, e.source, e.target, null, null, highlightedConnected));
  });
  
  // Matching node IDs for highlighting search matches
  private matchingNodeIds = computed(() => this.searchVisibility().matchingNodeIds);

  // Connection settings
  connectionSettings = {
    curve: 'bezier' as const,
    mode: 'loose' as const,
    validator: (connection: Connection) => {
      // Validate connection based on node types
      const sourceType = this.getNodeType(connection.source);
      const targetType = this.getNodeType(connection.target);
      
      // Valid connections: persona -> useCase, useCase -> tool, tool -> dataModel
      if (sourceType === 'persona' && targetType === 'useCase') return true;
      if (sourceType === 'useCase' && targetType === 'tool') return true;
      if (sourceType === 'tool' && targetType === 'dataModel') return true;
      
      return false;
    }
  };

  private getNodeType(nodeId: string): string {
    if (nodeId.startsWith('persona_')) return 'persona';
    if (nodeId.startsWith('usecase_')) return 'useCase';
    if (nodeId.startsWith('tool_')) return 'tool';
    if (nodeId.startsWith('datamodel_')) return 'dataModel';
    return '';
  }

  private getEntityId(nodeId: string): string {
    const parts = nodeId.split('_');
    return parts.slice(1).join('_');
  }

  // Handle new connections
  async onConnect(connection: Connection) {
    const sourceType = this.getNodeType(connection.source);
    const targetType = this.getNodeType(connection.target);
    const sourceId = this.getEntityId(connection.source);
    const targetId = this.getEntityId(connection.target);

    try {
      if (sourceType === 'persona' && targetType === 'useCase') {
        // Add PersonaUseCaseMapping
        const persona = this.personas().find(p => p.id === sourceId);
        if (persona) {
          const mappings = [...(persona.personaUseCaseMappings || [])];
          if (!mappings.find(m => m.useCaseId === targetId)) {
            mappings.push({ useCaseId: targetId, toolIds: [] });
            await this.personaService.updatePersona(sourceId, { personaUseCaseMappings: mappings });
          }
        }
      } else if (sourceType === 'useCase' && targetType === 'tool') {
        // Add UseCaseToolMapping
        const useCase = this.useCases().find(u => u.id === sourceId);
        const tool = this.tools().find(t => t.id === targetId);
        if (useCase && tool) {
          // Update use case mappings
          const useCaseMappings = [...(useCase.useCaseToolMappings || [])];
          if (!useCaseMappings.find(m => m.toolId === targetId)) {
            useCaseMappings.push({ useCaseId: sourceId, toolId: targetId });
            await this.useCaseService.updateUseCase(sourceId, { useCaseToolMappings: useCaseMappings });
          }
          // Update tool mappings (bidirectional)
          const toolMappings = [...(tool.useCaseToolMappings || [])];
          if (!toolMappings.find(m => m.useCaseId === sourceId)) {
            toolMappings.push({ useCaseId: sourceId, toolId: targetId });
            await this.toolService.updateTool(targetId, { useCaseToolMappings: toolMappings });
          }
        }
      } else if (sourceType === 'tool' && targetType === 'dataModel') {
        // Add DataModelImplementation
        const existingImpl = this.implementations().find(
          impl => impl.toolId === sourceId && impl.dataModelId === targetId
        );
        if (!existingImpl) {
          await this.dataModelService.addImplementation({
            dataModelId: targetId,
            toolId: sourceId,
            implementationDetails: '',
            schema: {}
          });
        }
      }

      this.connectionCreated.emit({ 
        source: sourceId, 
        target: targetId, 
        sourceType, 
        targetType 
      });
    } catch (error) {
      console.error('Error creating connection:', error);
    }
  }

  onEdgeHover(edgeId: string | null) {
    this.hoveredEdgeId.set(edgeId);
  }

  async deleteEdge(edgeId: string) {
    console.log('deleteEdge called with:', edgeId);
    
    // Parse edge ID to get source and target
    // Edge ID format: "persona_id_usecase_id" or "usecase_id_tool_id" or "tool_id_datamodel_id"
    const parts = edgeId.split('_');
    
    let sourceType: string, sourceId: string, targetType: string, targetId: string;
    
    // Find the split point between source and target
    if (edgeId.includes('_usecase_') && edgeId.startsWith('persona_')) {
      const idx = edgeId.indexOf('_usecase_');
      sourceType = 'persona';
      sourceId = edgeId.substring('persona_'.length, idx);
      targetType = 'useCase';
      targetId = edgeId.substring(idx + '_usecase_'.length);
      console.log('Parsed as persona->useCase:', { sourceId, targetId });
    } else if (edgeId.includes('_tool_') && edgeId.startsWith('usecase_')) {
      const idx = edgeId.indexOf('_tool_');
      sourceType = 'useCase';
      sourceId = edgeId.substring('usecase_'.length, idx);
      targetType = 'tool';
      targetId = edgeId.substring(idx + '_tool_'.length);
      console.log('Parsed as useCase->tool:', { sourceId, targetId });
    } else if (edgeId.includes('_datamodel_') && edgeId.startsWith('tool_')) {
      const idx = edgeId.indexOf('_datamodel_');
      sourceType = 'tool';
      sourceId = edgeId.substring('tool_'.length, idx);
      targetType = 'dataModel';
      targetId = edgeId.substring(idx + '_datamodel_'.length);
      console.log('Parsed as tool->dataModel:', { sourceId, targetId });
    } else {
      console.error('Unknown edge format:', edgeId);
      return;
    }

    try {
      if (sourceType === 'persona' && targetType === 'useCase') {
        const persona = this.personas().find(p => p.id === sourceId);
        if (persona) {
          const mappings = (persona.personaUseCaseMappings || []).filter(m => m.useCaseId !== targetId);
          await this.personaService.updatePersona(sourceId, { personaUseCaseMappings: mappings });
        }
      } else if (sourceType === 'useCase' && targetType === 'tool') {
        const useCase = this.useCases().find(u => u.id === sourceId);
        const tool = this.tools().find(t => t.id === targetId);
        if (useCase) {
          const mappings = (useCase.useCaseToolMappings || []).filter(m => m.toolId !== targetId);
          await this.useCaseService.updateUseCase(sourceId, { useCaseToolMappings: mappings });
        }
        if (tool) {
          const mappings = (tool.useCaseToolMappings || []).filter(m => m.useCaseId !== sourceId);
          await this.toolService.updateTool(targetId, { useCaseToolMappings: mappings });
        }
      } else if (sourceType === 'tool' && targetType === 'dataModel') {
        const impl = this.implementations().find(
          i => i.toolId === sourceId && i.dataModelId === targetId
        );
        if (impl) {
          await this.dataModelService.deleteImplementation(impl.id);
        }
      }

      this.connectionDeleted.emit({ source: sourceId, target: targetId, sourceType, targetType });
      this.hoveredEdgeId.set(null);
    } catch (error) {
      console.error('Error deleting edge:', error);
    }
  }

  // Handle node click - emit for highlight
  onNodeClick(nodeId: string, data: FlowNodeData) {
    // Close context menu if open
    this.contextMenuVisible.set(false);
    
    // Ignore clicks on add button nodes
    if (data.type === 'addButton') return;
    
    this.nodeClicked.emit({ 
      type: data.type, 
      id: data.entity.id 
    });
  }

  // Handle node double-click - emit for showing details modal
  onNodeDoubleClick(nodeId: string, data: FlowNodeData) {
    // Ignore double-clicks on add button nodes
    if (data.type === 'addButton') return;
    
    this.nodeDoubleClicked.emit({ 
      type: data.type, 
      id: data.entity.id 
    });
  }

  // Handle node right-click - show context menu
  onNodeRightClick(event: MouseEvent, nodeId: string, data: FlowNodeData) {
    // Ignore right-clicks on add button nodes
    if (data.type === 'addButton') return;
    
    event.preventDefault();
    event.stopPropagation();
    
    this.contextMenuPosition.set({ x: event.clientX, y: event.clientY });
    this.contextMenuNodeId.set(nodeId);
    this.contextMenuNodeType.set(data.type);
    this.contextMenuMode.set('node');
    this.contextMenuVisible.set(true);
    
    this.nodeRightClicked.emit({
      type: data.type,
      id: data.entity.id,
      x: event.clientX,
      y: event.clientY
    });
  }

  // Context menu actions
  onContextMenuView() {
    const nodeId = this.contextMenuNodeId();
    const nodeType = this.contextMenuNodeType();
    if (nodeId && nodeType) {
      const entityId = this.getEntityId(nodeId);
      this.viewNode.emit({ type: nodeType, id: entityId });
    }
    this.contextMenuVisible.set(false);
  }

  onContextMenuDelete() {
    const nodeId = this.contextMenuNodeId();
    const nodeType = this.contextMenuNodeType();
    if (nodeId && nodeType) {
      const entityId = this.getEntityId(nodeId);
      this.deleteNode.emit({ type: nodeType, id: entityId });
    }
    this.contextMenuVisible.set(false);
  }

  closeContextMenu() {
    this.contextMenuVisible.set(false);
    this.contextMenuEdgeId.set(null);
  }

  // Add button click handler
  onAddButtonClick(entityType: 'persona' | 'useCase' | 'tool' | 'dataModel') {
    switch (entityType) {
      case 'persona':
        this.createPersona.emit();
        break;
      case 'useCase':
        this.createUseCase.emit();
        break;
      case 'tool':
        this.createTool.emit();
        break;
      case 'dataModel':
        this.createDataModel.emit();
        break;
    }
  }

  // Legacy create handlers (kept for compatibility)
  onCreatePersona() {
    this.createPersona.emit();
  }

  onCreateUseCase() {
    this.createUseCase.emit();
  }

  onCreateTool() {
    this.createTool.emit();
  }

  onCreateDataModel() {
    this.createDataModel.emit();
  }

  // Handle click on empty canvas area to deselect and clear highlights
  onCanvasClick(event: MouseEvent) {
    const target = event.target as Element;
    // Only trigger if clicking on the canvas background, not on nodes or edges
    const isCanvas = target.tagName.toLowerCase() === 'svg' || 
                     target.classList.contains('flow-container') ||
                     target.closest('.vflow-background');
    if (isCanvas) {
      this.selectedEdgeId.set(null);
      this.canvasClicked.emit(); // Tell parent to clear highlight
    }
  }

  // Handle edge right-click - show delete context menu
  onEdgeRightClick(event: MouseEvent, edgeId: string) {
    event.preventDefault();
    event.stopPropagation();
    
    this.contextMenuPosition.set({ x: event.clientX, y: event.clientY });
    this.contextMenuEdgeId.set(edgeId);
    this.contextMenuMode.set('edge');
    this.contextMenuVisible.set(true);
  }

  // Handle container right-click - detect if clicked on an edge
  onContainerRightClick(event: MouseEvent) {
    const target = event.target as Element;
    
    console.log('Right click on:', target.tagName, target.classList.toString(), target);
    
    // Check if clicked on an SVG path (likely an edge)
    const isPath = target.tagName.toLowerCase() === 'path';
    const isInsideEdgeGroup = target.closest('g[edge]') !== null;
    const hasEdgeClass = target.classList.contains('edge') || 
                         target.classList.contains('edge-path') ||
                         target.classList.contains('edge-hit-area');
    
    // Also check parent for edge indicators
    const parent = target.parentElement;
    const parentIsEdge = parent && (
      parent.hasAttribute('edge') || 
      parent.classList.contains('selectable')
    );
    
    console.log('isPath:', isPath, 'isInsideEdgeGroup:', isInsideEdgeGroup, 
                'hasEdgeClass:', hasEdgeClass, 'parentIsEdge:', parentIsEdge);
    
    // If it's a path, it's likely an edge - use the selected edge
    if (isPath) {
      const selectedEdge = this.selectedEdgeId();
      console.log('Selected edge:', selectedEdge);
      
      if (selectedEdge) {
        event.preventDefault();
        event.stopPropagation();
        this.onEdgeRightClick(event, selectedEdge);
        return;
      } else {
        console.log('No edge selected. Please click on an edge first to select it.');
      }
    }
  }

  // Delete edge from context menu
  async onContextMenuDeleteEdge() {
    const edgeId = this.contextMenuEdgeId();
    console.log('Deleting edge from context menu:', edgeId);
    if (edgeId) {
      await this.deleteEdge(edgeId);
      this.selectedEdgeId.set(null);
    }
    this.contextMenuVisible.set(false);
    this.contextMenuEdgeId.set(null);
  }

  // Check if node is highlighted or connected to highlighted node
  isNodeHighlighted(nodeId: string): boolean {
    const connected = this.highlightedConnectedNodes();
    if (connected.size === 0) return false;
    return connected.has(nodeId);
  }
  
  // Check if there's any highlight active
  hasActiveHighlight(): boolean {
    return this.highlightedConnectedNodes().size > 0;
  }

  // Get node label
  getNodeLabel(data: FlowNodeData): string {
    switch (data.type) {
      case 'persona':
        return data.entity.name;
      case 'useCase':
        // Use action as the title for use cases
        return data.entity.action || 'Unnamed';
      case 'tool':
        return data.entity.name;
      case 'dataModel':
        return data.entity.name;
      default:
        return 'Unknown';
    }
  }

  // Get node background color based on type
  getNodeBgColor(type: string): string {
    switch (type) {
      case 'persona': return '#e0e7ff';
      case 'useCase': return '#fef3c7';
      case 'tool': return '#d1fae5';
      case 'dataModel': return '#fce7f3';
      default: return '#f3f4f6';
    }
  }

  // Get node border color based on type
  getNodeBorderColor(type: string): string {
    switch (type) {
      case 'persona': return '#4338ca';
      case 'useCase': return '#d97706';
      case 'tool': return '#059669';
      case 'dataModel': return '#be185d';
      default: return '#9ca3af';
    }
  }

  // Get badge label for node type
  getTypeBadgeLabel(type: string): string {
    switch (type) {
      case 'persona': return 'Persona';
      case 'useCase': return 'Use Case';
      case 'tool': return 'Tool';
      case 'dataModel': return 'Data Model';
      default: return type;
    }
  }

  // Check if node matches search query (is one of the directly matched nodes)
  nodeMatchesSearch(data: FlowNodeData): boolean {
    if (!this.searchQuery()) return false;
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return false;

    // Build the node ID based on type
    let nodeId: string;
    switch (data.type) {
      case 'persona':
        nodeId = `persona_${data.entity.id}`;
        break;
      case 'useCase':
        nodeId = `usecase_${data.entity.id}`;
        break;
      case 'tool':
        nodeId = `tool_${data.entity.id}`;
        break;
      case 'dataModel':
        nodeId = `datamodel_${data.entity.id}`;
        break;
      default:
        return false;
    }

    return this.matchingNodeIds().has(nodeId);
  }

  /**
   * Order nodes using barycenter heuristic to minimize edge crossings.
   * The barycenter of a node is the average position of its connected nodes in the previous layer.
   */
  private orderByBarycenter(
    nodeIds: string[],
    nextLayerConnections: Map<string, string[]>,
    prevLayerPositions: { id: string; position: number }[],
    prevLayerConnections?: Map<string, string[]>
  ): string[] {
    if (nodeIds.length === 0) return [];
    
    // Create a map of previous layer positions for quick lookup
    const prevPositionMap = new Map(prevLayerPositions.map(p => [p.id, p.position]));
    
    // Calculate barycenter for each node
    const barycenters = nodeIds.map(nodeId => {
      let sum = 0;
      let count = 0;
      
      // Get connections to previous layer
      if (prevLayerConnections) {
        const connectedIds = prevLayerConnections.get(nodeId) || [];
        connectedIds.forEach(connId => {
          const pos = prevPositionMap.get(connId);
          if (pos !== undefined) {
            sum += pos;
            count++;
          }
        });
      }
      
      // If no connections to previous layer, use connections to next layer
      // weighted by their positions (if we had them) or just keep original order
      if (count === 0) {
        const nextConnections = nextLayerConnections.get(nodeId) || [];
        // Nodes with more connections should be centered
        count = nextConnections.length || 1;
        sum = nodeIds.indexOf(nodeId) * count; // Keep relative order for unconnected nodes
      }
      
      return {
        id: nodeId,
        barycenter: count > 0 ? sum / count : nodeIds.indexOf(nodeId)
      };
    });
    
    // Sort by barycenter
    barycenters.sort((a, b) => a.barycenter - b.barycenter);
    
    return barycenters.map(b => b.id);
  }

  // Fit view to show all nodes
  fitView() {
    if (this.vflow) {
      this.vflow.fitView({
        padding: 0.15, // 15% padding around the content
        duration: 0 // Instant fit (no animation) for reliability
      });
    }
  }
}

