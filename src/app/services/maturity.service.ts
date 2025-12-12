import { Injectable, signal, effect } from '@angular/core';
import { 
  MaturityAssessment, 
  MaturityAnswer, 
  DOMAIN_MATURITY_QUESTIONS, 
  DATA_QUALITY_MATURITY_QUESTIONS 
} from '../models/maturity';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class MaturityService {
  private assessments = signal<MaturityAssessment[]>([]);
  private initialized = false;

  constructor(private db: DatabaseService) {
    this.loadData();
    
    effect(() => {
      if (this.initialized) {
        this.saveAssessments();
      }
    });
  }

  private async loadData() {
    try {
      const assessments = await this.db.maturityAssessments.toArray();
      const assessmentsWithDates = assessments.map(a => ({
        ...a,
        updatedAt: new Date(a.updatedAt)
      }));
      this.assessments.set(assessmentsWithDates);
      this.initialized = true;
    } catch (error) {
      console.error('Error loading maturity assessments from IndexedDB:', error);
      this.initialized = true;
    }
  }

  private async saveAssessments() {
    try {
      await this.db.maturityAssessments.bulkPut(this.assessments());
    } catch (error) {
      console.error('Error saving maturity assessments to IndexedDB:', error);
    }
  }

  getAssessments() {
    return this.assessments.asReadonly();
  }

  getAssessment(type: 'domain' | 'dataQuality'): MaturityAssessment | undefined {
    return this.assessments().find(a => a.type === type);
  }

  getDomainMaturityCurrentScore(): number {
    const assessment = this.getAssessment('domain');
    return assessment?.overallCurrentScore ?? 0;
  }

  getDomainMaturityTargetScore(): number {
    const assessment = this.getAssessment('domain');
    return assessment?.overallTargetScore ?? 0;
  }

  getDataQualityMaturityCurrentScore(): number {
    const assessment = this.getAssessment('dataQuality');
    return assessment?.overallCurrentScore ?? 0;
  }

  getDataQualityMaturityTargetScore(): number {
    const assessment = this.getAssessment('dataQuality');
    return assessment?.overallTargetScore ?? 0;
  }

  private calculateOverallScores(answers: MaturityAnswer[], type: 'domain' | 'dataQuality'): { current: number; target: number } {
    const questions = type === 'domain' ? DOMAIN_MATURITY_QUESTIONS : DATA_QUALITY_MATURITY_QUESTIONS;
    if (answers.length === 0) return { current: 0, target: 0 };
    
    const totalPossible = questions.length * 4; // Max score is 4 per question
    const totalCurrentScore = answers.reduce((sum, a) => sum + (a.currentScore ?? 0), 0);
    const totalTargetScore = answers.reduce((sum, a) => sum + (a.targetScore ?? 4), 0);
    
    return {
      current: Math.round((totalCurrentScore / totalPossible) * 100),
      target: Math.round((totalTargetScore / totalPossible) * 100)
    };
  }

  async updateAssessment(type: 'domain' | 'dataQuality', answers: MaturityAnswer[]) {
    const existingIndex = this.assessments().findIndex(a => a.type === type);
    const scores = this.calculateOverallScores(answers, type);
    
    const assessment: MaturityAssessment = {
      id: type,
      type,
      answers,
      overallCurrentScore: scores.current,
      overallTargetScore: scores.target,
      updatedAt: new Date()
    };

    if (existingIndex >= 0) {
      this.assessments.update(assessments => 
        assessments.map((a, i) => i === existingIndex ? assessment : a)
      );
    } else {
      this.assessments.update(assessments => [...assessments, assessment]);
    }
    
    await this.saveAssessments();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
