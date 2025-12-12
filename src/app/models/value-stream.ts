/**
 * Value Stream model following BizBOK (Business Architecture Body of Knowledge) principles
 * 
 * A value stream represents end-to-end activities that deliver value to stakeholders.
 * It consists of stages (steps) that transform inputs into valuable outputs.
 */

export interface ValueStreamStage {
  id: string;
  name: string;
  description?: string;
  
  // Position in the graph (for visualization)
  position: { x: number; y: number };
  
  // BizBOK mappings
  stakeholderIds: string[];      // Personas involved in this stage
  capabilityIds: string[];       // Use Cases that represent capabilities
  enablingResourceIds: string[]; // Tools that enable this stage
  
  // Value flow
  inputs?: string;               // Description of inputs
  outputs?: string;              // Description of outputs
  valueAdd?: string;             // Value added at this stage
  
  // Metrics
  cycleTime?: string;            // Time to complete this stage
  status?: 'current' | 'target' | 'gap'; // For as-is vs to-be mapping
}

export interface ValueStreamConnection {
  id: string;
  sourceStageId: string;
  targetStageId: string;
  label?: string;                // Optional label for the connection
}

export interface ValueStream {
  id: string;
  name: string;
  description?: string;
  
  // Value stream categorization
  type: 'core' | 'supporting' | 'management'; // BizBOK value stream types
  triggerEvent?: string;         // What triggers this value stream
  endState?: string;             // The end state/value delivered
  
  // Stakeholder focus
  primaryStakeholderIds: string[]; // Primary personas this stream serves
  
  // Graph structure
  stages: ValueStreamStage[];
  connections: ValueStreamConnection[];
  
  // Visual properties
  position?: { x: number; y: number }; // Position on canvas
  size?: { width: number; height: number }; // Frame size
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Helper type for stage types in visualization
export type StageNodeType = 'trigger' | 'stage' | 'end';

// Value stream type definitions for UI
export const VALUE_STREAM_TYPES = [
  { value: 'core', label: 'Core', description: 'Delivers direct value to external stakeholders' },
  { value: 'supporting', label: 'Supporting', description: 'Enables core value streams' },
  { value: 'management', label: 'Management', description: 'Manages and governs the organization' }
];
