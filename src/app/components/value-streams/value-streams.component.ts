import { Component, computed, signal, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  VflowComponent, 
  Node, 
  Edge, 
  Connection,
  HandleComponent,
  NodeHtmlTemplateDirective,
  ConnectionControllerDirective
} from 'ngx-vflow';
import { ValueStreamService } from '../../services/value-stream.service';
import { PersonaService } from '../../services/persona.service';
import { UseCaseService } from '../../services/use-case.service';
import { ToolService } from '../../services/tool.service';
import { ValueStream, ValueStreamStage, VALUE_STREAM_TYPES } from '../../models/value-stream';

// Node data interfaces
export interface StreamNodeData {
  type: 'stream';
  stream: ValueStream;
}

export interface StageNodeData {
  type: 'stage';
  streamId: string;
  stage: ValueStreamStage;
}

export interface AddStreamNodeData {
  type: 'addStream';
}

export interface AddStageNodeData {
  type: 'addStage';
  streamId: string;
}

export type ValueStreamNodeData = StreamNodeData | StageNodeData | AddStreamNodeData | AddStageNodeData;

@Component({
  selector: 'app-value-streams',
  imports: [
    CommonModule, 
    FormsModule, 
    VflowComponent,
    HandleComponent,
    NodeHtmlTemplateDirective,
    ConnectionControllerDirective
  ],
  templateUrl: './value-streams.component.html',
  styleUrl: './value-streams.component.scss'
})
export class ValueStreamsComponent implements AfterViewInit {
  @ViewChild(VflowComponent) vflow!: VflowComponent;
  
  valueStreamTypes = VALUE_STREAM_TYPES;
  
  // Modal states
  showStreamModal = signal(false);
  showStageModal = signal(false);
  editingStreamId = signal<string | null>(null);
  editingStageId = signal<string | null>(null);
  currentStreamIdForStage = signal<string | null>(null);
  
  // Selected edge for deletion
  selectedEdgeId = signal<string | null>(null);
  
  // New value stream form
  newStream = signal({
    name: '',
    description: '',
    type: 'core' as 'core' | 'supporting' | 'management',
    triggerEvent: '',
    endState: '',
    primaryStakeholderIds: [] as string[]
  });
  
  // New stage form
  newStage = signal({
    name: '',
    description: '',
    inputs: '',
    outputs: '',
    valueAdd: '',
    cycleTime: '',
    stakeholderIds: [] as string[],
    capabilityIds: [] as string[],
    enablingResourceIds: [] as string[]
  });
  
  // Data
  allStreams = computed(() => this.valueStreamService.getValueStreams()());
  personas = computed(() => this.personaService.getPersonas()());
  useCases = computed(() => this.useCaseService.getUseCases()());
  tools = computed(() => this.toolService.getTools()());
  
  // Build nodes for ngx-vflow - streams as parent nodes, stages as children
  // Order stages using BFS from source nodes (nodes with no incoming edges)
  private getOrderedStagesBFS(stream: ValueStream): ValueStreamStage[] {
    if (stream.stages.length === 0) return [];
    
    // Build adjacency list and find incoming edge count
    const adjacency = new Map<string, string[]>();
    const incomingCount = new Map<string, number>();
    
    // Initialize
    stream.stages.forEach(stage => {
      adjacency.set(stage.id, []);
      incomingCount.set(stage.id, 0);
    });
    
    // Build graph from connections
    stream.connections.forEach(conn => {
      const targets = adjacency.get(conn.sourceStageId) || [];
      targets.push(conn.targetStageId);
      adjacency.set(conn.sourceStageId, targets);
      incomingCount.set(conn.targetStageId, (incomingCount.get(conn.targetStageId) || 0) + 1);
    });
    
    // Find source nodes (no incoming edges)
    const sourceNodes = stream.stages.filter(s => (incomingCount.get(s.id) || 0) === 0);
    
    // If no source nodes found, use position-based ordering as fallback
    if (sourceNodes.length === 0) {
      return [...stream.stages].sort((a, b) => a.position.x - b.position.x);
    }
    
    // BFS traversal
    const ordered: ValueStreamStage[] = [];
    const visited = new Set<string>();
    const queue = [...sourceNodes];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      
      visited.add(current.id);
      ordered.push(current);
      
      // Add connected nodes to queue
      const targets = adjacency.get(current.id) || [];
      targets.forEach(targetId => {
        if (!visited.has(targetId)) {
          const targetStage = stream.stages.find(s => s.id === targetId);
          if (targetStage) {
            queue.push(targetStage);
          }
        }
      });
    }
    
    // Add any unvisited stages at the end (disconnected nodes)
    stream.stages.forEach(stage => {
      if (!visited.has(stage.id)) {
        ordered.push(stage);
      }
    });
    
    return ordered;
  }

  nodes = computed<Node<ValueStreamNodeData>[]>(() => {
    const streams = this.allStreams();
    const result: Node<ValueStreamNodeData>[] = [];
    
    const defaultStreamSpacing = 220;
    const stageWidth = 160;
    const stageSpacing = 30;
    const streamPaddingX = 20;
    const streamPaddingTop = 60;
    
    let currentY = 50;
    
    streams.forEach((stream) => {
      // Use stored position or calculate default
      const streamX = stream.position?.x ?? 50;
      const streamY = stream.position?.y ?? currentY;
      
      // Calculate minimum size based on stages, or use stored size
      const stageCount = Math.max(stream.stages.length + 1, 2);
      const minWidth = stageCount * (stageWidth + stageSpacing) + streamPaddingX * 2;
      const minHeight = 140;
      
      const streamWidth = stream.size?.width ?? minWidth;
      const streamHeight = stream.size?.height ?? minHeight;
      
      const streamNodeId = `stream_${stream.id}`;
      
      // Add stream (background frame) node first - lower z-order
      result.push({
        id: streamNodeId,
        point: { x: streamX, y: streamY },
        type: 'html-template',
        data: { type: 'stream', stream } as StreamNodeData
      });
      
      // Order stages using BFS from source nodes (left to right)
      const orderedStages = this.getOrderedStagesBFS(stream);
      orderedStages.forEach((stage, stageIndex) => {
        result.push({
          id: `stage_${stage.id}`,
          point: { 
            x: streamPaddingX + stageIndex * (stageWidth + stageSpacing), 
            y: streamPaddingTop
          },
          type: 'html-template',
          parentId: streamNodeId, // Constrain stages inside stream frame
          data: { type: 'stage', streamId: stream.id, stage } as StageNodeData
        });
      });
      
      // Add "+" button for adding stages (also constrained)
      result.push({
        id: `addStage_${stream.id}`,
        point: { 
          x: streamPaddingX + orderedStages.length * (stageWidth + stageSpacing), 
          y: streamPaddingTop + 15
        },
        type: 'html-template',
        parentId: streamNodeId,
        data: { type: 'addStage', streamId: stream.id } as AddStageNodeData
      });
      
      // Update currentY for next stream
      currentY = streamY + streamHeight + 30;
    });
    
    // Add "Add Stream" button at the bottom
    result.push({
      id: 'addStream',
      point: { x: 50, y: currentY },
      type: 'html-template',
      data: { type: 'addStream' } as AddStreamNodeData
    });
    
    return result;
  });
  
  // Build edges - connections between stages within each stream
  edges = computed<Edge[]>(() => {
    const streams = this.allStreams();
    const result: Edge[] = [];
    
    streams.forEach(stream => {
      stream.connections.forEach(conn => {
        result.push({
          id: `conn_${conn.id}`,
          source: `stage_${conn.sourceStageId}`,
          sourceHandle: 'source',
          target: `stage_${conn.targetStageId}`,
          targetHandle: 'target',
          markers: { end: { type: 'arrow' as const } }
        });
      });
    });
    
    return result;
  });
  
  // Connection settings - only allow connections between stages of the same stream
  connectionSettings = {
    curve: 'bezier' as const,
    mode: 'loose' as const,
    validator: (connection: Connection) => {
      // Only allow connections between stage nodes
      if (!connection.source.startsWith('stage_') || !connection.target.startsWith('stage_')) {
        return false;
      }
      // Don't allow self-connections
      if (connection.source === connection.target) {
        return false;
      }
      // Check if both stages belong to the same stream
      const sourceNode = this.nodes().find(n => n.id === connection.source) as Node<ValueStreamNodeData> | undefined;
      const targetNode = this.nodes().find(n => n.id === connection.target) as Node<ValueStreamNodeData> | undefined;
      if (sourceNode && targetNode && 'data' in sourceNode && 'data' in targetNode) {
        const sourceData = sourceNode.data as ValueStreamNodeData;
        const targetData = targetNode.data as ValueStreamNodeData;
        if (sourceData?.type === 'stage' && targetData?.type === 'stage') {
          return sourceData.streamId === targetData.streamId;
        }
      }
      return false;
    }
  };
  
  constructor(
    private valueStreamService: ValueStreamService,
    private personaService: PersonaService,
    private useCaseService: UseCaseService,
    private toolService: ToolService
  ) {}
  
  ngAfterViewInit() {
    setTimeout(() => this.fitView(), 300);
  }
  
  fitView() {
    if (this.vflow) {
      this.vflow.fitView({ padding: 0.1, duration: 300 });
    }
  }
  
  // Stream CRUD
  openStreamModal(stream?: ValueStream) {
    if (stream) {
      this.editingStreamId.set(stream.id);
      this.newStream.set({
        name: stream.name,
        description: stream.description || '',
        type: stream.type,
        triggerEvent: stream.triggerEvent || '',
        endState: stream.endState || '',
        primaryStakeholderIds: [...stream.primaryStakeholderIds]
      });
    } else {
      this.editingStreamId.set(null);
      this.newStream.set({
        name: '',
        description: '',
        type: 'core',
        triggerEvent: '',
        endState: '',
        primaryStakeholderIds: []
      });
    }
    this.showStreamModal.set(true);
  }
  
  closeStreamModal() {
    this.showStreamModal.set(false);
    this.editingStreamId.set(null);
  }
  
  async saveStream() {
    const stream = this.newStream();
    if (!stream.name.trim()) return;
    
    const editingId = this.editingStreamId();
    
    if (editingId) {
      await this.valueStreamService.updateValueStream(editingId, {
        name: stream.name.trim(),
        description: stream.description.trim(),
        type: stream.type,
        triggerEvent: stream.triggerEvent.trim(),
        endState: stream.endState.trim(),
        primaryStakeholderIds: stream.primaryStakeholderIds
      });
    } else {
      await this.valueStreamService.addValueStream({
        name: stream.name.trim(),
        description: stream.description.trim(),
        type: stream.type,
        triggerEvent: stream.triggerEvent.trim(),
        endState: stream.endState.trim(),
        primaryStakeholderIds: stream.primaryStakeholderIds,
        stages: [],
        connections: []
      });
    }
    
    this.closeStreamModal();
    setTimeout(() => this.fitView(), 100);
  }
  
  async deleteStream(streamId: string) {
    if (confirm('Are you sure you want to delete this value stream and all its stages?')) {
      await this.valueStreamService.deleteValueStream(streamId);
    }
  }
  
  // Stage CRUD
  openStageModal(streamId: string, stage?: ValueStreamStage) {
    this.currentStreamIdForStage.set(streamId);
    if (stage) {
      this.editingStageId.set(stage.id);
      this.newStage.set({
        name: stage.name,
        description: stage.description || '',
        inputs: stage.inputs || '',
        outputs: stage.outputs || '',
        valueAdd: stage.valueAdd || '',
        cycleTime: stage.cycleTime || '',
        stakeholderIds: [...stage.stakeholderIds],
        capabilityIds: [...stage.capabilityIds],
        enablingResourceIds: [...stage.enablingResourceIds]
      });
    } else {
      this.editingStageId.set(null);
      this.newStage.set({
        name: '',
        description: '',
        inputs: '',
        outputs: '',
        valueAdd: '',
        cycleTime: '',
        stakeholderIds: [],
        capabilityIds: [],
        enablingResourceIds: []
      });
    }
    this.showStageModal.set(true);
  }
  
  closeStageModal() {
    this.showStageModal.set(false);
    this.editingStageId.set(null);
    this.currentStreamIdForStage.set(null);
  }
  
  async saveStage() {
    const streamId = this.currentStreamIdForStage();
    if (!streamId) return;
    
    const stage = this.newStage();
    if (!stage.name.trim()) return;
    
    const editingId = this.editingStageId();
    const stream = this.allStreams().find(s => s.id === streamId);
    
    if (editingId) {
      await this.valueStreamService.updateStage(streamId, editingId, {
        name: stage.name.trim(),
        description: stage.description.trim(),
        inputs: stage.inputs.trim(),
        outputs: stage.outputs.trim(),
        valueAdd: stage.valueAdd.trim(),
        cycleTime: stage.cycleTime.trim(),
        stakeholderIds: stage.stakeholderIds,
        capabilityIds: stage.capabilityIds,
        enablingResourceIds: stage.enablingResourceIds
      });
    } else {
      const stageCount = stream?.stages.length || 0;
      await this.valueStreamService.addStage(streamId, {
        name: stage.name.trim(),
        description: stage.description.trim(),
        position: { x: stageCount, y: 0 },
        inputs: stage.inputs.trim(),
        outputs: stage.outputs.trim(),
        valueAdd: stage.valueAdd.trim(),
        cycleTime: stage.cycleTime.trim(),
        stakeholderIds: stage.stakeholderIds,
        capabilityIds: stage.capabilityIds,
        enablingResourceIds: stage.enablingResourceIds
      });
    }
    
    this.closeStageModal();
  }
  
  async deleteStage(streamId: string, stageId: string) {
    if (confirm('Are you sure you want to delete this stage?')) {
      await this.valueStreamService.deleteStage(streamId, stageId);
    }
  }
  
  // Handle new connections between stages
  async onConnect(event: any) {
    const connection = event as Connection;
    
    // Extract stage IDs
    const sourceStageId = connection.source.replace('stage_', '');
    const targetStageId = connection.target.replace('stage_', '');
    
    // Find which stream these stages belong to
    const sourceNode = this.nodes().find(n => n.id === connection.source) as Node<ValueStreamNodeData> | undefined;
    if (sourceNode && 'data' in sourceNode) {
      const sourceData = sourceNode.data as ValueStreamNodeData;
      if (sourceData?.type === 'stage') {
        await this.valueStreamService.addConnection(sourceData.streamId, sourceStageId, targetStageId);
      }
    }
  }
  
  // Handle edge selection for deletion
  onEdgeSelect(event: any) {
    if (Array.isArray(event)) {
      for (const change of event) {
        if (change.selected && change.id) {
          this.selectedEdgeId.set(change.id);
          return;
        }
      }
    } else if (event?.selected && event?.id) {
      this.selectedEdgeId.set(event.id);
    }
  }
  
  // Delete selected connection
  async deleteSelectedEdge() {
    const edgeId = this.selectedEdgeId();
    if (!edgeId) return;
    
    // Find the connection and its stream
    const connectionId = edgeId.replace('conn_', '');
    for (const stream of this.allStreams()) {
      const conn = stream.connections.find(c => c.id === connectionId);
      if (conn) {
        await this.valueStreamService.deleteConnection(stream.id, connectionId);
        break;
      }
    }
    this.selectedEdgeId.set(null);
  }
  
  // Handle keyboard events for edge deletion
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Delete selected edge with Backspace or Delete key
    if ((event.key === 'Backspace' || event.key === 'Delete') && this.selectedEdgeId()) {
      // Don't delete if user is typing in an input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      event.preventDefault();
      this.deleteSelectedEdge();
    }
    
    // Escape to deselect
    if (event.key === 'Escape') {
      this.selectedEdgeId.set(null);
    }
  }
  
  // Node click handlers
  onNodeClick(nodeId: string, data: ValueStreamNodeData) {
    if (data.type === 'addStream') {
      this.openStreamModal();
    } else if (data.type === 'addStage') {
      this.openStageModal(data.streamId);
    }
  }
  
  onNodeDoubleClick(nodeId: string, data: ValueStreamNodeData) {
    if (data.type === 'stream') {
      this.openStreamModal(data.stream);
    } else if (data.type === 'stage') {
      this.openStageModal(data.streamId, data.stage);
    }
  }
  
  onNodeRightClick(event: MouseEvent, nodeId: string, data: ValueStreamNodeData) {
    event.preventDefault();
    if (data.type === 'stream') {
      if (confirm('Delete this value stream?')) {
        this.deleteStream(data.stream.id);
      }
    } else if (data.type === 'stage') {
      if (confirm('Delete this stage?')) {
        this.deleteStage(data.streamId, data.stage.id);
      }
    }
  }
  
  // Helper methods
  getTypeLabel(type: string): string {
    return VALUE_STREAM_TYPES.find(t => t.value === type)?.label || type;
  }
  
  getTypeBgColor(type: string): string {
    switch (type) {
      case 'core': return '#dbeafe';
      case 'supporting': return '#fef3c7';
      case 'management': return '#f3e8ff';
      default: return '#f4f4f5';
    }
  }
  
  getTypeBorderColor(type: string): string {
    switch (type) {
      case 'core': return '#3b82f6';
      case 'supporting': return '#f59e0b';
      case 'management': return '#8b5cf6';
      default: return '#a1a1aa';
    }
  }
  
  getStageBadges(stage: ValueStreamStage): string {
    const badges = [];
    if (stage.stakeholderIds.length) badges.push(`👤${stage.stakeholderIds.length}`);
    if (stage.capabilityIds.length) badges.push(`📋${stage.capabilityIds.length}`);
    if (stage.enablingResourceIds.length) badges.push(`🔧${stage.enablingResourceIds.length}`);
    return badges.join(' ');
  }
  
  toggleStakeholder(id: string) {
    const current = this.newStage().stakeholderIds;
    const updated = current.includes(id)
      ? current.filter(i => i !== id)
      : [...current, id];
    this.newStage.update(s => ({ ...s, stakeholderIds: updated }));
  }
  
  toggleCapability(id: string) {
    const current = this.newStage().capabilityIds;
    const updated = current.includes(id)
      ? current.filter(i => i !== id)
      : [...current, id];
    this.newStage.update(s => ({ ...s, capabilityIds: updated }));
  }
  
  toggleResource(id: string) {
    const current = this.newStage().enablingResourceIds;
    const updated = current.includes(id)
      ? current.filter(i => i !== id)
      : [...current, id];
    this.newStage.update(s => ({ ...s, enablingResourceIds: updated }));
  }

  // Form update helpers
  updateStreamName(value: string) { this.newStream.update(s => ({ ...s, name: value })); }
  updateStreamDescription(value: string) { this.newStream.update(s => ({ ...s, description: value })); }
  updateStreamType(value: 'core' | 'supporting' | 'management') { this.newStream.update(s => ({ ...s, type: value })); }
  updateStreamTrigger(value: string) { this.newStream.update(s => ({ ...s, triggerEvent: value })); }
  updateStreamEndState(value: string) { this.newStream.update(s => ({ ...s, endState: value })); }
  updateStageName(value: string) { this.newStage.update(s => ({ ...s, name: value })); }
  updateStageDescription(value: string) { this.newStage.update(s => ({ ...s, description: value })); }
  updateStageInputs(value: string) { this.newStage.update(s => ({ ...s, inputs: value })); }
  updateStageOutputs(value: string) { this.newStage.update(s => ({ ...s, outputs: value })); }
  updateStageValueAdd(value: string) { this.newStage.update(s => ({ ...s, valueAdd: value })); }
  updateStageCycleTime(value: string) { this.newStage.update(s => ({ ...s, cycleTime: value })); }
  
  // Get stream size for rendering
  getStreamSize(stream: ValueStream): { width: number; height: number } {
    const stageWidth = 160;
    const stageSpacing = 30;
    const streamPaddingX = 20;
    const stageCount = Math.max(stream.stages.length + 1, 2);
    const minWidth = stageCount * (stageWidth + stageSpacing) + streamPaddingX * 2;
    const minHeight = 140;
    
    return {
      width: stream.size?.width ?? minWidth,
      height: stream.size?.height ?? minHeight
    };
  }
  
  // Resize handling
  private resizingStream: { id: string; startX: number; startY: number; startWidth: number; startHeight: number } | null = null;
  
  onResizeStart(event: MouseEvent, stream: ValueStream) {
    event.preventDefault();
    event.stopPropagation();
    
    const size = this.getStreamSize(stream);
    this.resizingStream = {
      id: stream.id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: size.width,
      startHeight: size.height
    };
    
    // Add global listeners
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }
  
  private onResizeMove = (event: MouseEvent) => {
    if (!this.resizingStream) return;
    
    const deltaX = event.clientX - this.resizingStream.startX;
    const deltaY = event.clientY - this.resizingStream.startY;
    
    const newWidth = Math.max(300, this.resizingStream.startWidth + deltaX);
    const newHeight = Math.max(120, this.resizingStream.startHeight + deltaY);
    
    // Update stream size
    this.valueStreamService.updateValueStream(this.resizingStream.id, {
      size: { width: newWidth, height: newHeight }
    });
  };
  
  private onResizeEnd = () => {
    this.resizingStream = null;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  };
}
