import { Injectable, signal } from '@angular/core';
import { DatabaseService } from './database.service';
import { Project } from '../models/project';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private projectsSignal = signal<Project[]>([]);

  constructor(private db: DatabaseService) {
    this.loadProjects();
  }

  private async loadProjects() {
    const projects = await this.db.projects.toArray();
    this.projectsSignal.set(projects);
  }

  getProjects() {
    return this.projectsSignal;
  }

  async addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = new Date();
    const newProject: Project = {
      ...project,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    await this.db.projects.add(newProject);
    this.projectsSignal.update(projects => [...projects, newProject]);
    return newProject;
  }

  async updateProject(id: string, updates: Partial<Project>) {
    const updatedData = { ...updates, updatedAt: new Date() };
    await this.db.projects.update(id, updatedData);
    this.projectsSignal.update(projects =>
      projects.map(p => p.id === id ? { ...p, ...updatedData } : p)
    );
  }

  async deleteProject(id: string) {
    await this.db.projects.delete(id);
    this.projectsSignal.update(projects => projects.filter(p => p.id !== id));
  }

  getProjectById(id: string): Project | undefined {
    return this.projectsSignal().find(p => p.id === id);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
