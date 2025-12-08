export type RelationshipType = 
  | 'one-to-one' 
  | 'one-to-many' 
  | 'many-to-one' 
  | 'many-to-many' 
  | 'composition' 
  | 'aggregation' 
  | 'inheritance';

export interface DataModelAttribute {
  id: string;
  name: string;
  type: string; // e.g., 'string', 'number', 'boolean', 'Date', 'object', 'array', 'CustomType', 'relationship'
  description?: string;
  required: boolean;
  defaultValue?: any;
  // Relationship-specific fields (only used when type === 'relationship')
  targetDataModelId?: string; // Reference to another DataModel
  relationshipType?: RelationshipType;
}

export interface DataModel {
  id: string;
  name: string;
  description: string;
  domainId?: string;
  attributes: DataModelAttribute[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DataModelImplementation {
  id: string;
  dataModelId: string;
  toolId: string;
  implementationDetails: string;
  schema: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

