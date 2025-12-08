import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DatabaseService } from '../../services/database.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

  constructor(
    private db: DatabaseService
  ) {}

  async exportData() {
    try {
      await this.db.exportToFile();
      alert('Data exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async importData(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!confirm('Importing data will replace all existing data. Are you sure you want to continue?')) {
      input.value = '';
      return;
    }

    try {
      await this.db.importFromFile(file);
      
      // Reload all services to refresh the data
      // The services will automatically reload from the database
      window.location.reload();
      
      alert('Data imported successfully!');
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import data: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      input.value = '';
    }
  }

  triggerImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => this.importData(e);
    input.click();
  }
}

