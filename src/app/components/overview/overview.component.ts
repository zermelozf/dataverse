import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersonaService } from '../../services/persona.service';
import { UseCaseService } from '../../services/use-case.service';
import { ToolService } from '../../services/tool.service';
import { DataModelService } from '../../services/data-model.service';
import { DomainService } from '../../services/domain.service';
import { KPIService } from '../../services/kpi.service';

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
  // Services data
  personas = computed(() => this.personaService.getPersonas()());
  useCases = computed(() => this.useCaseService.getUseCases()());
  tools = computed(() => this.toolService.getTools()());
  dataModels = computed(() => this.dataModelService.getDataModels()());
  domains = computed(() => this.domainService.getDomains()());
  kpis = computed(() => this.kpiService.getKPIs()());

  // Filter for domain breakdown
  selectedDomainFilter = signal<string>('all');

  constructor(
    private personaService: PersonaService,
    private useCaseService: UseCaseService,
    private toolService: ToolService,
    private dataModelService: DataModelService,
    private domainService: DomainService,
    private kpiService: KPIService
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

  // Percentage of personas with KPIs
  personasWithKPIsPercentage = computed(() => {
    const allPersonas = this.personas();
    if (allPersonas.length === 0) return 0;
    const withKPIs = allPersonas.filter(p => p.kpiIds && p.kpiIds.length > 0).length;
    return Math.round((withKPIs / allPersonas.length) * 100);
  });

  personasWithKPIsCount = computed(() => {
    const allPersonas = this.personas();
    return allPersonas.filter(p => p.kpiIds && p.kpiIds.length > 0).length;
  });

  // Personas with KPIs breakdown by domain
  personasWithKPIsByDomain = computed((): DomainBreakdown[] => {
    const domains = this.domains();
    const personas = this.personas();
    const dataModels = this.dataModels();

    // Map personas to domains via their use cases -> tools -> data models
    return domains.map(domain => {
      // Find data models in this domain
      const domainDataModelIds = dataModels
        .filter(dm => dm.domainId === domain.id)
        .map(dm => dm.id);
      
      // Find personas that use tools which implement data models in this domain
      // For now, we'll consider all personas and show their KPI status
      // A more sophisticated approach would trace through use cases -> tools -> data models
      const domainPersonas = personas; // Simplified - could be enhanced
      const withKPIs = domainPersonas.filter(p => p.kpiIds && p.kpiIds.length > 0).length;
      
      return {
        domainId: domain.id,
        domainName: domain.name,
        value: withKPIs,
        total: domainPersonas.length,
        percentage: domainPersonas.length > 0 ? Math.round((withKPIs / domainPersonas.length) * 100) : 0
      };
    });
  });

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
}

