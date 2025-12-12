import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersonaService } from '../../services/persona.service';
import { UseCaseService } from '../../services/use-case.service';
import { ToolService } from '../../services/tool.service';
import { DataModelService } from '../../services/data-model.service';
import { DomainService } from '../../services/domain.service';
import { KPIService } from '../../services/kpi.service';
import { ProjectService } from '../../services/project.service';
import { MaturityService } from '../../services/maturity.service';
import { DashboardConfigService } from '../../services/dashboard-config.service';
import { KPI } from '../../models/kpi';
import { 
  MaturityQuestion, 
  MaturityAnswer, 
  MATURITY_LEVELS,
  DOMAIN_MATURITY_QUESTIONS, 
  DATA_QUALITY_MATURITY_QUESTIONS 
} from '../../models/maturity';

interface DomainBreakdown {
  domainId: string;
  domainName: string;
  value: number;
  total: number;
  percentage: number;
}

@Component({
  selector: 'app-overview',
  imports: [CommonModule, FormsModule],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss'
})
export class OverviewComponent {
  // Expose Math to template
  Math = Math;

  // Services data
  personas = computed(() => this.personaService.getPersonas()());
  useCases = computed(() => this.useCaseService.getUseCases()());
  tools = computed(() => this.toolService.getTools()());
  dataModels = computed(() => this.dataModelService.getDataModels()());
  domains = computed(() => this.domainService.getDomains()());
  kpis = computed(() => this.kpiService.getKPIs()());
  projects = computed(() => this.projectService.getProjects()());

  // Filter for domain breakdown
  selectedDomainFilter = signal<string>('all');

  // Maturity modal state
  showMaturityModal = signal(false);
  maturityModalType = signal<'domain' | 'dataQuality'>('domain');
  maturityCurrentAnswers = signal<Map<string, number>>(new Map());
  maturityTargetAnswers = signal<Map<string, number>>(new Map());

  // Performance KPIs state
  showAddKPIModal = signal(false);
  kpiSearchFilter = signal('');
  
  // Drag and drop state
  draggedKPIId = signal<string | null>(null);
  dragOverKPIId = signal<string | null>(null);

  // Maturity data
  maturityLevels = MATURITY_LEVELS;
  domainMaturityQuestions = DOMAIN_MATURITY_QUESTIONS;
  dataQualityMaturityQuestions = DATA_QUALITY_MATURITY_QUESTIONS;

  // Maturity scores - current and target
  domainMaturityCurrentScore = computed(() => {
    const assessment = this.maturityService.getAssessment('domain');
    return assessment?.overallCurrentScore ?? 0;
  });

  domainMaturityTargetScore = computed(() => {
    const assessment = this.maturityService.getAssessment('domain');
    return assessment?.overallTargetScore ?? 0;
  });

  dataQualityMaturityCurrentScore = computed(() => {
    const assessment = this.maturityService.getAssessment('dataQuality');
    return assessment?.overallCurrentScore ?? 0;
  });

  dataQualityMaturityTargetScore = computed(() => {
    const assessment = this.maturityService.getAssessment('dataQuality');
    return assessment?.overallTargetScore ?? 0;
  });

  // Performance KPIs - KPIs marked to show on dashboard
  dashboardKPIs = computed(() => this.kpis().filter(k => k.showOnDashboard));

  // Ordered dashboard KPIs based on config
  orderedDashboardKPIs = computed(() => {
    const dashboardKPIs = this.dashboardKPIs();
    const order = this.dashboardConfigService.getPerformanceKPIOrder();
    
    // Sort KPIs based on saved order, new ones go to the end
    return [...dashboardKPIs].sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      
      // If both are in the order, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only one is in the order, it comes first
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // If neither is in the order, maintain original order
      return 0;
    });
  });

  // Available KPIs to add (not yet on dashboard)
  availableKPIs = computed(() => {
    const filter = this.kpiSearchFilter().toLowerCase().trim();
    return this.kpis()
      .filter(k => !k.showOnDashboard)
      .filter(k => !filter || k.name.toLowerCase().includes(filter));
  });

  // Calculate aggregated KPI values from all projects
  performanceKPIValues = computed(() => {
    const projects = this.projects();
    const orderedKPIs = this.orderedDashboardKPIs();
    
    return orderedKPIs.map(kpi => {
      let totalCurrent = 0;
      let totalTarget = 0;
      let projectCount = 0;
      
      for (const project of projects) {
        const mapping = project.kpiMappings?.find(m => m.kpiId === kpi.id);
        if (mapping) {
          const current = parseFloat(mapping.currentValue || '0') || 0;
          const target = parseFloat(mapping.targetValue || '0') || 0;
          totalCurrent += current;
          totalTarget += target;
          projectCount++;
        }
      }
      
      const totalValue = totalTarget - totalCurrent;
      
      return {
        kpi,
        totalCurrent,
        totalTarget,
        totalValue,
        projectCount
      };
    });
  });

  constructor(
    private personaService: PersonaService,
    private useCaseService: UseCaseService,
    private toolService: ToolService,
    private dataModelService: DataModelService,
    private domainService: DomainService,
    private kpiService: KPIService,
    private projectService: ProjectService,
    private maturityService: MaturityService,
    private dashboardConfigService: DashboardConfigService
  ) {}

  // Entity counts
  entityCounts = computed(() => ({
    personas: this.personas().length,
    useCases: this.useCases().length,
    tools: this.tools().length,
    dataModels: this.dataModels().length,
    domains: this.domains().length,
    kpis: this.kpis().length
  }));

  // Percentage of KPIs covered by use cases
  kpisCoveredPercentage = computed(() => {
    const allKPIs = this.kpis();
    if (allKPIs.length === 0) return 0;
    const covered = allKPIs.filter(k => k.useCaseIds && k.useCaseIds.length > 0).length;
    return Math.round((covered / allKPIs.length) * 100);
  });

  kpisCoveredCount = computed(() => {
    const allKPIs = this.kpis();
    return allKPIs.filter(k => k.useCaseIds && k.useCaseIds.length > 0).length;
  });

  // KPIs covered breakdown by domain (via personas)
  kpisCoveredByDomain = computed((): DomainBreakdown[] => {
    const domains = this.domains();
    const kpis = this.kpis();
    const personas = this.personas();
    const dataModels = this.dataModels();

    return domains.map(domain => {
      // Find KPIs associated with personas that work in this domain
      // For simplicity, we'll show all KPIs coverage
      const covered = kpis.filter(k => k.useCaseIds && k.useCaseIds.length > 0).length;
      
      return {
        domainId: domain.id,
        domainName: domain.name,
        value: covered,
        total: kpis.length,
        percentage: kpis.length > 0 ? Math.round((covered / kpis.length) * 100) : 0
      };
    });
  });

  // Percentage of domains with owner
  domainsWithOwnerPercentage = computed(() => {
    const allDomains = this.domains();
    if (allDomains.length === 0) return 0;
    const withOwner = allDomains.filter(d => d.domainOwner && d.domainOwner.trim()).length;
    return Math.round((withOwner / allDomains.length) * 100);
  });

  domainsWithOwnerCount = computed(() => {
    const allDomains = this.domains();
    return allDomains.filter(d => d.domainOwner && d.domainOwner.trim()).length;
  });

  // Percentage of domains with steward
  domainsWithStewardPercentage = computed(() => {
    const allDomains = this.domains();
    if (allDomains.length === 0) return 0;
    const withSteward = allDomains.filter(d => d.domainSteward && d.domainSteward.trim()).length;
    return Math.round((withSteward / allDomains.length) * 100);
  });

  domainsWithStewardCount = computed(() => {
    const allDomains = this.domains();
    return allDomains.filter(d => d.domainSteward && d.domainSteward.trim()).length;
  });

  // Percentage of data models with at least one data quality rule
  dataModelsWithDQRulesPercentage = computed(() => {
    const allModels = this.dataModels();
    if (allModels.length === 0) return 0;
    const withRules = allModels.filter(dm => this.hasAnyDataQualityRule(dm)).length;
    return Math.round((withRules / allModels.length) * 100);
  });

  dataModelsWithDQRulesCount = computed(() => {
    const allModels = this.dataModels();
    return allModels.filter(dm => this.hasAnyDataQualityRule(dm)).length;
  });

  // Total number of DQ rules across all data models
  totalDQRulesCount = computed(() => {
    const allModels = this.dataModels();
    let count = 0;
    for (const dm of allModels) {
      const attributes = dm.attributes || [];
      for (const attr of attributes) {
        const dq = attr.dataQuality;
        if (dq?.consistency?.rule?.trim()) count++;
        if (dq?.validity?.rule?.trim()) count++;
        if (dq?.freshness?.rule?.trim()) count++;
      }
    }
    return count;
  });

  // Data models with DQ rules breakdown by domain
  dataModelsWithDQByDomain = computed((): DomainBreakdown[] => {
    const domains = this.domains();
    const dataModels = this.dataModels();

    return domains.map(domain => {
      const domainModels = dataModels.filter(dm => dm.domainId === domain.id);
      const withRules = domainModels.filter(dm => this.hasAnyDataQualityRule(dm)).length;
      
      return {
        domainId: domain.id,
        domainName: domain.name,
        value: withRules,
        total: domainModels.length,
        percentage: domainModels.length > 0 ? Math.round((withRules / domainModels.length) * 100) : 0
      };
    });
  });

  // Helper to check if a data model has any data quality rule
  private hasAnyDataQualityRule(dataModel: any): boolean {
    const attributes = dataModel.attributes || [];
    return attributes.some((attr: any) => {
      const dq = attr.dataQuality;
      if (!dq) return false;
      // A rule is considered present if it has non-empty rule text
      const hasConsistency = dq.consistency?.rule && dq.consistency.rule.trim().length > 0;
      const hasValidity = dq.validity?.rule && dq.validity.rule.trim().length > 0;
      const hasFreshness = dq.freshness?.rule && dq.freshness.rule.trim().length > 0;
      return hasConsistency || hasValidity || hasFreshness;
    });
  }

  // Helper for progress bar color
  getProgressColor(percentage: number): string {
    if (percentage >= 80) return '#22c55e'; // green
    if (percentage >= 50) return '#eab308'; // yellow
    return '#ef4444'; // red
  }

  // Helper for progress bar background
  getProgressBgColor(percentage: number): string {
    if (percentage >= 80) return '#dcfce7'; // light green
    if (percentage >= 50) return '#fef9c3'; // light yellow
    return '#fee2e2'; // light red
  }

  // Maturity modal methods
  openMaturityModal(type: 'domain' | 'dataQuality') {
    this.maturityModalType.set(type);
    
    // Load existing answers
    const assessment = this.maturityService.getAssessment(type);
    const currentMap = new Map<string, number>();
    const targetMap = new Map<string, number>();
    
    if (assessment?.answers) {
      for (const answer of assessment.answers) {
        currentMap.set(answer.questionId, answer.currentScore ?? 0);
        targetMap.set(answer.questionId, answer.targetScore ?? 4);
      }
    }
    
    // Initialize defaults for questions without answers
    const questions = type === 'domain' ? DOMAIN_MATURITY_QUESTIONS : DATA_QUALITY_MATURITY_QUESTIONS;
    for (const q of questions) {
      if (!currentMap.has(q.id)) {
        currentMap.set(q.id, 0);
      }
      if (!targetMap.has(q.id)) {
        targetMap.set(q.id, 4); // Default target is "Optimized"
      }
    }
    
    this.maturityCurrentAnswers.set(currentMap);
    this.maturityTargetAnswers.set(targetMap);
    this.showMaturityModal.set(true);
  }

  closeMaturityModal() {
    this.showMaturityModal.set(false);
  }

  getMaturityQuestions(): MaturityQuestion[] {
    return this.maturityModalType() === 'domain' 
      ? DOMAIN_MATURITY_QUESTIONS 
      : DATA_QUALITY_MATURITY_QUESTIONS;
  }

  getMaturityModalTitle(): string {
    return this.maturityModalType() === 'domain' 
      ? 'Domain Maturity Assessment' 
      : 'Data Quality Maturity Assessment';
  }

  getQuestionCurrentScore(questionId: string): number {
    return this.maturityCurrentAnswers().get(questionId) ?? 0;
  }

  getQuestionTargetScore(questionId: string): number {
    return this.maturityTargetAnswers().get(questionId) ?? 4;
  }

  setQuestionCurrentScore(questionId: string, score: number) {
    const newMap = new Map(this.maturityCurrentAnswers());
    newMap.set(questionId, score);
    this.maturityCurrentAnswers.set(newMap);
  }

  setQuestionTargetScore(questionId: string, score: number) {
    const newMap = new Map(this.maturityTargetAnswers());
    newMap.set(questionId, score);
    this.maturityTargetAnswers.set(newMap);
  }

  getLevelLabel(score: number): string {
    return MATURITY_LEVELS.find(l => l.value === score)?.label ?? 'Not Started';
  }

  getLevelColor(score: number): string {
    return MATURITY_LEVELS.find(l => l.value === score)?.color ?? '#ef4444';
  }

  async saveMaturityAssessment() {
    const type = this.maturityModalType();
    const currentMap = this.maturityCurrentAnswers();
    const targetMap = this.maturityTargetAnswers();
    const answers: MaturityAnswer[] = [];
    
    for (const [questionId, currentScore] of currentMap.entries()) {
      const targetScore = targetMap.get(questionId) ?? 4;
      answers.push({ questionId, currentScore, targetScore });
    }
    
    await this.maturityService.updateAssessment(type, answers);
    this.closeMaturityModal();
  }

  getGaugeColor(percentage: number): string {
    if (percentage >= 80) return '#22c55e';
    if (percentage >= 60) return '#84cc16';
    if (percentage >= 40) return '#eab308';
    if (percentage >= 20) return '#f97316';
    return '#ef4444';
  }

  getGaugeDashArray(percentage: number): string {
    // Circle circumference for r=45 is 2*PI*45 ≈ 283
    const circumference = 283;
    const filled = (percentage / 100) * circumference;
    return `${filled} ${circumference}`;
  }

  // Performance KPI methods
  openAddKPIModal() {
    this.kpiSearchFilter.set('');
    this.showAddKPIModal.set(true);
  }

  closeAddKPIModal() {
    this.showAddKPIModal.set(false);
  }

  async addKPIToDashboard(kpi: KPI) {
    await this.kpiService.toggleDashboardVisibility(kpi.id, true);
    await this.dashboardConfigService.addKPIToOrder(kpi.id);
  }

  async removeKPIFromDashboard(kpiId: string) {
    await this.kpiService.toggleDashboardVisibility(kpiId, false);
    await this.dashboardConfigService.removeKPIFromOrder(kpiId);
  }

  // Drag and drop methods
  onDragStart(event: DragEvent, kpiId: string) {
    this.draggedKPIId.set(kpiId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', kpiId);
    }
  }

  onDragOver(event: DragEvent, kpiId: string) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (this.draggedKPIId() !== kpiId) {
      this.dragOverKPIId.set(kpiId);
    }
  }

  onDragLeave(event: DragEvent) {
    this.dragOverKPIId.set(null);
  }

  async onDrop(event: DragEvent, targetKPIId: string) {
    event.preventDefault();
    const draggedId = this.draggedKPIId();
    
    if (draggedId && draggedId !== targetKPIId) {
      const currentKPIs = this.orderedDashboardKPIs();
      const currentOrder = currentKPIs.map(k => k.id);
      
      const draggedIndex = currentOrder.indexOf(draggedId);
      const targetIndex = currentOrder.indexOf(targetKPIId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        // Remove from old position and insert at new position
        currentOrder.splice(draggedIndex, 1);
        currentOrder.splice(targetIndex, 0, draggedId);
        
        await this.dashboardConfigService.setPerformanceKPIOrder(currentOrder);
      }
    }
    
    this.draggedKPIId.set(null);
    this.dragOverKPIId.set(null);
  }

  onDragEnd(event: DragEvent) {
    this.draggedKPIId.set(null);
    this.dragOverKPIId.set(null);
  }

  isDragging(kpiId: string): boolean {
    return this.draggedKPIId() === kpiId;
  }

  isDragOver(kpiId: string): boolean {
    return this.dragOverKPIId() === kpiId;
  }

  formatValue(value: number, unit?: string): string {
    if (unit === '%') {
      return `${value.toFixed(1)}%`;
    } else if (unit === '$' || unit === '€' || unit === '£') {
      return `${unit}${value.toLocaleString()}`;
    } else if (unit) {
      return `${value.toLocaleString()} ${unit}`;
    }
    return value.toLocaleString();
  }

  formatGapValue(value: number, unit?: string): string {
    const sign = value > 0 ? '+' : '';
    if (unit === '%') {
      return `${sign}${value.toFixed(1)}%`;
    } else if (unit === '$' || unit === '€' || unit === '£') {
      return `${sign}${unit}${Math.abs(value).toLocaleString()}${value < 0 ? '' : ''}`;
    } else if (unit) {
      return `${sign}${value.toLocaleString()} ${unit}`;
    }
    return `${sign}${value.toLocaleString()}`;
  }

  getGapColor(value: number): string {
    if (value > 0) return '#22c55e'; // green - positive gap (ahead or on track)
    if (value < 0) return '#ef4444'; // red - negative gap (behind target)
    return '#71717a'; // neutral - exactly on target
  }
}

