import { Injectable, signal, effect } from '@angular/core';
import { ValueStream, ValueStreamStage, ValueStreamConnection } from '../models/value-stream';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class ValueStreamService {
  private valueStreams = signal<ValueStream[]>([]);
  private initialized = false;

  constructor(private db: DatabaseService) {
    this.loadData();
    
    effect(() => {
      if (this.initialized) {
        this.saveValueStreams();
      }
    });
  }

  private async loadData() {
    try {
      const streams = await this.db.valueStreams.toArray();
      const streamsWithDates = streams.map(vs => ({
        ...vs,
        createdAt: new Date(vs.createdAt),
        updatedAt: new Date(vs.updatedAt)
      }));
      this.valueStreams.set(streamsWithDates);
      this.initialized = true;
    } catch (error) {
      console.error('Error loading value streams from IndexedDB:', error);
      this.initialized = true;
    }
  }

  private async saveValueStreams() {
    try {
      await this.db.valueStreams.bulkPut(this.valueStreams());
    } catch (error) {
      console.error('Error saving value streams to IndexedDB:', error);
    }
  }

  getValueStreams() {
    return this.valueStreams.asReadonly();
  }

  getValueStream(id: string): ValueStream | undefined {
    return this.valueStreams().find(vs => vs.id === id);
  }

  async addValueStream(valueStream: Omit<ValueStream, 'id' | 'createdAt' | 'updatedAt'>): Promise<ValueStream> {
    const now = new Date();
    const newStream: ValueStream = {
      ...valueStream,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    this.valueStreams.update(streams => [...streams, newStream]);
    await this.saveValueStreams();
    return newStream;
  }

  async updateValueStream(id: string, updates: Partial<ValueStream>) {
    this.valueStreams.update(streams =>
      streams.map(vs =>
        vs.id === id
          ? { ...vs, ...updates, updatedAt: new Date() }
          : vs
      )
    );
    await this.saveValueStreams();
  }

  async deleteValueStream(id: string) {
    this.valueStreams.update(streams => streams.filter(vs => vs.id !== id));
    try {
      await this.db.valueStreams.delete(id);
    } catch (error) {
      console.error('Error deleting value stream from IndexedDB:', error);
    }
  }

  // Stage management
  async addStage(valueStreamId: string, stage: Omit<ValueStreamStage, 'id'>): Promise<ValueStreamStage | null> {
    const newStage: ValueStreamStage = {
      ...stage,
      id: this.generateId()
    };
    
    const stream = this.getValueStream(valueStreamId);
    if (!stream) return null;
    
    await this.updateValueStream(valueStreamId, {
      stages: [...stream.stages, newStage]
    });
    
    return newStage;
  }

  async updateStage(valueStreamId: string, stageId: string, updates: Partial<ValueStreamStage>) {
    const stream = this.getValueStream(valueStreamId);
    if (!stream) return;
    
    await this.updateValueStream(valueStreamId, {
      stages: stream.stages.map(s =>
        s.id === stageId ? { ...s, ...updates } : s
      )
    });
  }

  async deleteStage(valueStreamId: string, stageId: string) {
    const stream = this.getValueStream(valueStreamId);
    if (!stream) return;
    
    await this.updateValueStream(valueStreamId, {
      stages: stream.stages.filter(s => s.id !== stageId),
      connections: stream.connections.filter(
        c => c.sourceStageId !== stageId && c.targetStageId !== stageId
      )
    });
  }

  // Connection management
  async addConnection(valueStreamId: string, sourceStageId: string, targetStageId: string, label?: string): Promise<ValueStreamConnection | null> {
    const stream = this.getValueStream(valueStreamId);
    if (!stream) return null;
    
    // Check if connection already exists
    const exists = stream.connections.some(
      c => c.sourceStageId === sourceStageId && c.targetStageId === targetStageId
    );
    if (exists) return null;
    
    const newConnection: ValueStreamConnection = {
      id: this.generateId(),
      sourceStageId,
      targetStageId,
      label
    };
    
    await this.updateValueStream(valueStreamId, {
      connections: [...stream.connections, newConnection]
    });
    
    return newConnection;
  }

  async deleteConnection(valueStreamId: string, connectionId: string) {
    const stream = this.getValueStream(valueStreamId);
    if (!stream) return;
    
    await this.updateValueStream(valueStreamId, {
      connections: stream.connections.filter(c => c.id !== connectionId)
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
