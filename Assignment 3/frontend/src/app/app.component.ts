// src/app/app.component.ts
import { Component } from '@angular/core';
import { WeatherFormComponent } from './components/weather-form/weather-form.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [WeatherFormComponent],
  template: `
    <app-weather-form></app-weather-form>
  `
})
export class AppComponent {
  title = 'weather-app';
}