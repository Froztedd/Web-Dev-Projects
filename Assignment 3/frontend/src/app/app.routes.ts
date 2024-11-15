// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { WeatherFormComponent } from './components/weather-form/weather-form.component';

export const routes: Routes = [
  {
    path: '',
    component: WeatherFormComponent,
  },
  // Add other routes as needed
];
