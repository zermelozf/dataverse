import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DataModelsComponent } from './components/data-models/data-models.component';
import { UseCasesComponent } from './components/use-cases/use-cases.component';
import { ToolsComponent } from './components/tools/tools.component';
import { PersonasComponent } from './components/personas/personas.component';
import { SearchComponent } from './components/search/search.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard/data-models',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    children: [
      {
        path: 'search',
        component: SearchComponent
      },
      {
        path: 'data-models',
        component: DataModelsComponent
      },
      {
        path: 'use-cases',
        component: UseCasesComponent
      },
      {
        path: 'tools',
        component: ToolsComponent
      },
      {
        path: 'personas',
        component: PersonasComponent
      }
    ]
  }
];
