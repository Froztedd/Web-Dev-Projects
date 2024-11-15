import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface Favorite {
  _id?: string;
  street: string;
  city: string;
  state: string;
  createdAt?: Date;
  weather_data?: WeatherData[];
}

export interface WeatherValues {
  temperatureMax: number;
  temperatureMin: number;
  windSpeed: number;
  weatherCode: number;
  icon?: string;
  apparentTemperature: number;
  humidity: number;
  visibility: number;
  cloudCover: number;
  sunriseTime: string;
  sunsetTime: string;
  pressureSeaLevel?: number;
  temperature?: number;
  latitude?: number;
  longitude?: number;
  windDirection?: number;
  precipitationProbability?: number;  // Added this property
}

export interface WeatherData {
  startTime: string;
  values: WeatherValues;
}

export interface WeatherResult {
  street: string;
  city: string;
  state: string;
  weather_data: WeatherData[];
  forecast_data?: any;
  latitude?: number;
  longitude?: number;
}

export interface HourlyWeatherData {
  timestamp: number;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  precipitationProbability: number;
}

export interface ProcessedHourlyData {
  timestamp: number;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  precipitationProbability: number;
}

export interface MeteogramResponse {
  success: boolean;
  hourlyData: HourlyWeatherData[];
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
    this.loadFavorites(); // Add this line
  }

  public favorites = signal<Favorite[]>([]);

  

  // Add favorites methods
  private loadFavorites(): void {
    console.log('Loading favorites...');
    this.http.get<Favorite[]>(`${this.baseUrl}/api/favorites`)
      .pipe(
        catchError(error => {
          console.error('Error loading favorites:', error);
          // Return empty array on error instead of propagating the error
          return [];
        })
      )
      .subscribe({
        next: (favorites) => {
          console.log('Favorites loaded successfully:', favorites);
          this.favorites.set(favorites || []);
        },
        error: (error) => {
          console.error('Error in favorites subscription:', error);
          this.favorites.set([]); // Set empty array on error
        }
      });
  }

  private handleError(error: any): void {
    console.error('An error occurred:', error);
    if (error.response) {
      // Server returned an error response
      console.error('Server error:', error.response.data);
    } else if (error.request) {
      // Request was made but no response received
      console.error('No response received:', error.request);
    } else {
      // Something else went wrong
      console.error('Error:', error.message);
    }
  }

  addFavorite(favorite: Omit<Favorite, '_id'>): Observable<Favorite> {
    console.log('Adding favorite:', favorite);
    return this.http.post<Favorite>(`${this.baseUrl}/api/favorites`, favorite).pipe(
      tap((newFavorite) => {
        console.log('Successfully added favorite:', newFavorite);
        this.favorites.update(current => [...current, newFavorite]);
      }),
      catchError((error) => {
        console.error('Error adding favorite:', error);
        if (error.status === 400 && error.error?.error === 'Location already in favorites') {
          return throwError(() => new Error('This location is already in your favorites'));
        }
        return throwError(() => new Error('Failed to add favorite. Please try again.'));
      })
    );
  }

  removeFavorite(id: string): Observable<any> {
    console.log('Removing favorite with ID:', id);
    return this.http.delete(`${this.baseUrl}/api/favorites/${id}`).pipe(
      tap(() => {
        console.log('Successfully removed favorite with ID:', id);
        this.favorites.update(current => current.filter(f => f._id !== id));
      }),
      catchError((error) => {
        console.error('Error removing favorite:', error);
        return throwError(() => new Error('Failed to remove favorite. Please try again.'));
      })
    );
  }

  isFavorite(city: string, state: string): boolean {
    return this.favorites().some(f => 
      f.city === city && f.state === state
    );
  }

  getFavoriteId(city: string, state: string): string | undefined {
    return this.favorites().find(f => 
      f.city === city && f.state === state
    )?._id;
  }


  getWeatherByAddress(street: string, city: string, state: string): Observable<any> {
    console.log('Making request with params:', { street, city, state });
    
    let params = new HttpParams()
      .set('street', street)
      .set('city', city)
      .set('state', state);

    return this.http.get<WeatherResult>(`${this.baseUrl}/api/get_weather`, { params })
      .pipe(
        catchError((error: Error) => {
          console.error('Error fetching weather by address:', error);
          return throwError(() => new Error('Failed to fetch weather data'));
        })
      );
  }

  getWeatherByLocation(lat: number, lon: number): Observable<WeatherResult> {
    let params = new HttpParams()
      .set('auto_detect', 'true')
      .set('lat', lat.toString())
      .set('lon', lon.toString())
      .set('include_hourly', 'true'); // Add parameter to request hourly data
  
    return this.http.get<WeatherResult>(`${this.baseUrl}/api/get_weather`, { params })
      .pipe(
        catchError((error: Error) => {
          console.error('Error fetching weather by location:', error);
          return throwError(() => new Error('Failed to fetch weather data'));
        })
      );
  }

  getCurrentLocation(): Observable<{ lat: number; lon: number }> {
    return this.http.get<{ lat: number; lon: number }>(`${this.baseUrl}/api/get_location`)
      .pipe(
        catchError((error: Error) => {
          console.error('Error getting current location:', error);
          return throwError(() => new Error('Failed to get current location'));
        })
      );
  }

  getMeteogramData(lat: number, lon: number): Observable<HourlyWeatherData[]> {
    const params = new HttpParams()
      .set('lat', lat.toString())
      .set('lon', lon.toString());

    return this.http.get<MeteogramResponse>(
      `${this.baseUrl}/api/get_meteogram_data`,
      { params }
    ).pipe(
      map(response => {
        if (!response.success || !response.hourlyData) {
          throw new Error('Invalid meteogram data received');
        }
        return response.hourlyData;
      }),
      catchError((error: Error) => {
        console.error('Error fetching meteogram data:', error);
        return throwError(() => new Error('Failed to fetch meteogram data'));
      })
    );
  }

  
}