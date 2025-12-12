export interface MaturityQuestion {
  id: string;
  text: string;
  description?: string;
}

export interface MaturityAnswer {
  questionId: string;
  currentScore: number; // 0-4 scale: 0=Not started, 1=Initial, 2=Developing, 3=Defined, 4=Optimized
  targetScore: number; // 0-4 scale: target level to achieve
}

export interface MaturityAssessment {
  id: string;
  type: 'domain' | 'dataQuality';
  answers: MaturityAnswer[];
  overallCurrentScore: number; // 0-100 percentage
  overallTargetScore: number; // 0-100 percentage
  updatedAt: Date;
}

export const MATURITY_LEVELS = [
  { value: 0, label: 'Not Started', color: '#ef4444' },
  { value: 1, label: 'Initial', color: '#f97316' },
  { value: 2, label: 'Developing', color: '#eab308' },
  { value: 3, label: 'Defined', color: '#22c55e' },
  { value: 4, label: 'Optimized', color: '#10b981' }
];

export const DOMAIN_MATURITY_QUESTIONS: MaturityQuestion[] = [
  {
    id: 'dm1',
    text: 'Domain boundaries are clearly defined',
    description: 'Each domain has a clear scope and boundaries are well understood across the organization'
  },
  {
    id: 'dm2',
    text: 'Domain ownership is established',
    description: 'Each domain has assigned owners and stewards with clear responsibilities'
  },
  {
    id: 'dm3',
    text: 'Domain documentation is complete',
    description: 'Comprehensive documentation exists for domain purpose, scope, and key concepts'
  },
  {
    id: 'dm4',
    text: 'Data models are well-defined',
    description: 'All critical data models within domains are documented with attributes and relationships'
  },
  {
    id: 'dm5',
    text: 'Cross-domain relationships are mapped',
    description: 'Dependencies and data flows between domains are identified and documented'
  }
];

export const DATA_QUALITY_MATURITY_QUESTIONS: MaturityQuestion[] = [
  {
    id: 'dq1',
    text: 'Data quality rules are defined',
    description: 'Business rules for data quality (validity, consistency, freshness) are documented'
  },
  {
    id: 'dq2',
    text: 'Data quality is being measured',
    description: 'Metrics are in place to track data quality across critical data elements'
  },
  {
    id: 'dq3',
    text: 'Data quality issues are tracked',
    description: 'A process exists to identify, log, and prioritize data quality issues'
  },
  {
    id: 'dq4',
    text: 'Root cause analysis is performed',
    description: 'Data quality issues are analyzed to identify and address root causes'
  },
  {
    id: 'dq5',
    text: 'Continuous improvement is in place',
    description: 'Regular reviews and improvements are made to data quality processes'
  }
];
