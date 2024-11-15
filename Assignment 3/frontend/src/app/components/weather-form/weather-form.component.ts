import { 
  Component, 
  OnInit, 
  AfterViewInit, 
  ViewChild, 
  ElementRef, 
  Inject, 
  PLATFORM_ID,
  computed,
  signal,
  NgZone 
} from '@angular/core';
import { 
  CommonModule, 
  isPlatformBrowser 
} from '@angular/common';
import { 
  FormBuilder, 
  FormGroup, 
  Validators, 
  FormsModule, 
  ReactiveFormsModule 
} from '@angular/forms';
import { WeatherService, Favorite } from '../services/weather.service'; // Add Favorite
import { HttpClient } from '@angular/common/http';
import { HighchartsChartModule } from 'highcharts-angular';
import HighchartsWindbarb from 'highcharts/modules/windbarb.js';
// Highcharts imports with '.js' extensions
import Highcharts from 'highcharts';
import HighchartsMore from 'highcharts/highcharts-more.js';
import NoDataToDisplay from 'highcharts/modules/no-data-to-display.js';
import Accessibility from 'highcharts/modules/accessibility.js';
import { GoogleMapsModule } from '@angular/google-maps';
import { ChangeDetectorRef } from '@angular/core';
import { WritableSignal } from '@angular/core';





declare global {
  interface Window {
    google: {
      maps: {
        Map: any;
        Marker: any;
        Geocoder: any;
        places: {
          AutocompleteService: any;
          PlacesServiceStatus: {
            OK: string;
          };
        };
        MapTypeId: {
          ROADMAP: string;
        };
        ControlPosition: {
          TOP_LEFT: number;
          RIGHT_TOP: number;
          RIGHT_CENTER: number;
        };
        MapTypeControlStyle: {
          HORIZONTAL_BAR: number;
        };
      };
    };
  }
}

// Make sure TypeScript knows this is a module
export {};

interface MapPosition {
  lat: number;
  lng: number;
}



interface ChartPoint {
  x: number;
  y?: number;
  high?: number;
  low?: number;
}

interface WeatherResult {
  street: string;
  city: string;
  state: string;
  weather_data: WeatherData[];
  forecast_data?: any;
  latitude?: number;  // Add these
  longitude?: number; // two properties
}

interface WeatherData {
  startTime: string;
  values: WeatherValues;
}

interface WeatherShareData {
  temperature: number;
  location: string;
  conditions: string;
  date: Date;
}

interface WeatherValues {
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
  precipitationProbability?: number; // Added property
}

interface HourlyWeatherData {
  startTime: string;
  values: {
    temperature: number;
    humidity: number;
    pressureSeaLevel: number;
    windSpeed: number;
    windDirection: number;
  };
}

interface HourlyData {
  timestamp: number;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  precipitationProbability: number;
}

interface ForecastDataPoint {
  date: string;
  temperature?: number;
  temperatureMax?: number;
  humidity?: number;
  pressureSeaLevel?: number;
  windSpeed?: number;
  windDirection?: number;
  precipitationProbability?: number;
}

interface WeatherDataPoint {
  startTime: string;
  values: {
    temperature?: number;
    temperatureMax?: number;
    temperatureMin?: number;
    humidity?: number;
    pressureSeaLevel?: number;
    windSpeed?: number;
    windDirection?: number;
    precipitationProbability?: number; // Ensure this exists
  };
}

interface ProcessedWeatherPoint {
  timestamp: number;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  precipitationProbability: number; // Added property
}

interface ProcessedHourlyData {
  timestamp: number;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  precipitationProbability: number;
}

interface CitySuggestion {
  description: string;
  placeId: string;
  mainText: string;
}

interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}


@Component({
  selector: 'app-weather-form',
  templateUrl: './weather-form.component.html',
  styleUrls: ['./weather-form.component.css'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    HighchartsChartModule,
    GoogleMapsModule
  ],
  providers: [WeatherService]
})


export class WeatherFormComponent implements OnInit, AfterViewInit {
  @ViewChild('cityInput') cityInput!: ElementRef;
  @ViewChild('googlemap', { static: false }) mapElement!: ElementRef;

  favorites: WritableSignal<Favorite[]>;

  
  public map: any = null;
  private marker: any = null;
  private currentMapLocation: MapPosition | null = null;

  private isMapInitialized: boolean = false;
  private mapInitialized: boolean = false;

  private mapContainer: ElementRef | null = null;
  private pendingMapInitialization: boolean = false;


  showDetails: boolean = false;
  private placesService: any;
  private maxRetries = 5;
  private retryCount = 0;
  private retryDelay = 1000;

  weatherForm: FormGroup;
  states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
    'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
    'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
    'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
    'West Virginia', 'Wisconsin', 'Wyoming'
  ];

  activeTab: 'results' | 'favorites' = 'results';



  results: WeatherResult[] = [];
  loading = false;
  error: string | null = null;

  citySuggestions: CitySuggestion[] = [];
  showSuggestions: boolean = false;

  activeView: 'day' | 'temp' | 'meteogram' = 'day';
  Highcharts: typeof Highcharts = Highcharts;
  chartOptions: Highcharts.Options = {
    chart: {
      type: 'arearange',
      height: 400,
      style: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }
    },
    title: {
      text: 'Temperature Range Forecast',
      style: {
        fontSize: '16px',
        fontWeight: '500'
      }
    },
    xAxis: {
      type: 'datetime',
      labels: {
        format: '{value:%b %e}',
        style: {
          color: '#666'
        }
      },
      crosshair: true,
      tickWidth: 0,
      lineColor: '#ddd'
    },
    yAxis: {
      title: {
        text: 'Temperature (°F)',
        style: {
          color: '#666'
        }
      },
      labels: {
        format: '{value}°F',
        style: {
          color: '#666'
        }
      },
      gridLineColor: '#f0f0f0'
    },
    tooltip: {
      shared: true,
      useHTML: true,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      shadow: true,
      padding: 12,
      formatter: function() {
        const point = this.points?.[0]?.point as any;
        const date = new Date(point.x);
        const formattedDate = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
        return `<div style="font-size: 12px; font-weight: bold; margin-bottom: 5px">
                  ${formattedDate}
                </div>
                <div style="color: #ff8d14; margin: 2px 0">
                  High: ${point.high.toFixed(1)}°F
                </div>
                <div style="color: #1491ff; margin: 2px 0">
                  Low: ${point.low.toFixed(1)}°F
                </div>`;
      }
    },
    plotOptions: {
      arearange: {
        fillOpacity: 0.3,
        lineWidth: 1,
        marker: {
          enabled: false
        },
        states: {
          hover: {
            lineWidth: 2
          }
        }
      }
    },
    legend: {
      enabled: false
    },
    series: [{
      name: 'Temperature',
      data: [],
      type: 'arearange'
    }]
  };

  private weatherStatuses: { [key: number]: string } = {
    1000: 'Clear',
    1001: 'Cloudy',
    1100: 'Mostly Clear',
    1101: 'Partly Cloudy',
    1102: 'Mostly Cloudy',
    2000: 'Fog',
    2100: 'Light Fog',
    4000: 'Drizzle',
    4001: 'Rain',
    4200: 'Light Rain',
    4201: 'Heavy Rain',
    5000: 'Snow',
    5001: 'Flurries',
    5100: 'Light Snow',
    5101: 'Heavy Snow',
    6000: 'Freezing Drizzle',
    6001: 'Freezing Rain',
    6200: 'Light Freezing Rain',
    6201: 'Heavy Freezing Rain',
    7000: 'Ice Pellets',
    7101: 'Heavy Ice Pellets',
    7102: 'Light Ice Pellets',
    8000: 'Thunderstorm'
  };

  private weatherIcons: { [key: string]: string } = {
    "1000": "/assets/icons/clear_day.svg",
    "1001": "/assets/icons/cloudy.svg",
    "1100": "/assets/icons/mostly_clear_day.svg",
    "1101": "/assets/icons/partly_cloudy.svg",
    "1102": "/assets/icons/mostly_cloudy.svg",
    "2000": "/assets/icons/fog.svg",
    "2100": "/assets/icons/light_fog.svg",
    "4000": "/assets/icons/drizzle.svg",
    "4001": "/assets/icons/rain.svg",
    "4200": "/assets/icons/rain_light.svg",
    "4201": "/assets/icons/rain_heavy.svg",
    "5000": "/assets/icons/snow.svg",
    "5001": "/assets/icons/flurries.svg",
    "5100": "/assets/icons/snow_light.svg",
    "5101": "/assets/icons/snow_heavy.svg",
    "6000": "/assets/icons/freezing_drizzle.svg",
    "6001": "/assets/icons/freezing_rain.svg",
    "6200": "/assets/icons/freezing_rain_light.svg",
    "6201": "/assets/icons/freezing_rain_heavy.svg",
    "7000": "/assets/icons/ice_pellets.svg",
    "7101": "/assets/icons/ice_pellets_heavy.svg",
    "7102": "/assets/icons/ice_pellets_light.svg",
    "8000": "/assets/icons/tstorm.svg"
  };

  // New properties added
  private currentChart: Highcharts.Chart | null = null;
  private chartUpdateTimeout: any;
  private shouldInitMap: boolean = false;


  constructor(
    private fb: FormBuilder,
    private weatherService: WeatherService,
    private http: HttpClient,
    private ngZone: NgZone,
    private cdRef: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Move favorites initialization here
    this.favorites = this.weatherService.favorites;

    this.weatherForm = this.fb.group({
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      autodetectLocation: [false]
    });
  }

  
  ngOnInit(): void {
    this.setupAutodetectSubscription();
    if (isPlatformBrowser(this.platformId)) {
      this.initGooglePlaces();
  
      // Initialize Highcharts modules in browser environment
      HighchartsMore(Highcharts);
      HighchartsWindbarb(Highcharts);
      NoDataToDisplay(Highcharts);
      Accessibility(Highcharts);
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('Current timezone:', timeZone);
  }

  ngAfterViewInit(): void {
    // Not needed anymore as we're using the Places service directly
  }

  

  getFormattedDate(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
    console.log('Toggling Details:', this.showDetails);
  
    if (this.showDetails) {
      if (!this.selectedDate) {
        const currentDay = this.getCurrentDayWeather();
        if (currentDay) {
          this.selectedDate = currentDay.startTime;
        }
      }
      
      // Schedule map initialization
      this.ngZone.run(() => {
        this.scheduleMapInitialization();
      });
    } else {
      // Clean up map when hiding details
      this.destroyMap();
    }
  }

  private scheduleMapInitialization(): void {
    if (!this.currentMapLocation) {
      console.log('No map location available');
      return;
    }
  
    this.pendingMapInitialization = true;
    
    this.ngZone.run(() => {
      setTimeout(() => {
        if (this.mapElement && this.mapElement.nativeElement) {
          this.mapContainer = this.mapElement;
          this.initMap();
          this.pendingMapInitialization = false;
        } else {
          console.log('Map element not found, will retry');
          this.scheduleMapInitialization();
        }
      }, 100);
    });
  }
  
   

  getCurrentLocation(): void {
    this.loading = true;
    this.error = null;

    if (!navigator.geolocation) {
      this.error = 'Geolocation is not supported by your browser';
      this.loading = false;
      this.weatherForm.patchValue({ autodetectLocation: false });
      return;
    }

    const geolocationOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        const location = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };
        this.getWeatherForLocation(location);
      },
      (error: GeolocationPositionError) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Failed to detect location. ';
        
        switch (error.code) {
          case GeolocationPositionError.PERMISSION_DENIED:
            errorMessage += 'Please enable location services in your browser.';
            break;
          case GeolocationPositionError.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.';
            break;
          case GeolocationPositionError.TIMEOUT:
            errorMessage += 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage += 'Please try entering your address manually.';
        }
        
        this.ngZone.run(() => {
          this.error = errorMessage;
          this.loading = false;
          this.weatherForm.patchValue({ autodetectLocation: false });
        });
      },
      geolocationOptions
    );
  }

  private getWeatherForLocation(location: { lat: number, lon: number }): void {
    if (!window.google?.maps?.Geocoder) {
      console.error('Google Maps Geocoder not available');
      this.error = 'Location service is currently unavailable. Please try again later.';
      this.loading = false;
      return;
    }
  
    const geocoder = new window.google.maps.Geocoder();
    const latlng = { lat: location.lat, lng: location.lon };

    geocoder.geocode({ location: latlng }, (results: any, status: any) => {
      this.ngZone.run(() => {
        if (status === 'OK' && results?.[0]) {
          let city = '';
          let state = '';
          
          for (const component of results[0].address_components) {
            if (component.types.includes('locality')) {
              city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
              state = component.long_name;
            }
          }

          console.log('Geocoded location:', { city, state });

          this.weatherService.getWeatherByLocation(location.lat, location.lon).subscribe({
            next: (weatherData: any) => {
              this.handleWeatherData({
                street: 'Current Location',
                city: city,
                state: state,
                weather_data: this.processWeatherData(weatherData.weather_data),
                forecast_data: weatherData.forecast_data,
                latitude: location.lat,     // Add latitude
                longitude: location.lon     // Add longitude
              });
              
            },
            error: (error) => {
              console.error('Error fetching weather:', error);
              this.error = 'Failed to fetch weather data. Please try again later.';
              this.loading = false;
            }
          });
        } else {
          console.error('Geocoder failed:', status);
          this.error = 'Failed to determine your location. Please try entering your address manually.';
          this.loading = false;
        }
      });
    });
  }

  private initGooglePlaces(): void {
    if (typeof window.google === 'undefined' || !window.google.maps || !window.google.maps.places) {
      console.warn('Google Maps API not loaded yet, retrying...');
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => this.initGooglePlaces(), this.retryDelay);
      } else {
        console.error('Failed to load Google Maps API after max retries');
        this.error = 'Failed to load location services. Please try again later.';
      }
      return;
    }
  
    try {
      this.placesService = new window.google.maps.places.AutocompleteService();
    } catch (error) {
      console.error('Error initializing Places service:', error);
      this.error = 'Failed to initialize location services.';
    }
  }

  onCityInput(): void {
    const cityControl = this.weatherForm.get('city');
    if (cityControl && cityControl.value) {
      this.showSuggestions = true;
      this.getCitySuggestions(cityControl.value);
    } else {
      this.citySuggestions = [];
      this.showSuggestions = false;
    }
  }

  onCityBlur(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 100);
  }

  private getCitySuggestions(query: string): void {
    if (!this.placesService) {
      console.error('Places service not initialized');
      return;
    }
  
    this.placesService.getPlacePredictions(
      {
        input: query,
        types: ['(cities)'],
        componentRestrictions: { country: 'us' }
      },
      (predictions: any[], status: string) => {
        this.ngZone.run(() => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            this.citySuggestions = predictions.map(prediction => ({
              description: prediction.structured_formatting.main_text,
              placeId: prediction.place_id,
              mainText: prediction.structured_formatting.main_text
            }));
          } else {
            this.citySuggestions = [];
          }
        });
      }
    );
  }

  selectCitySuggestion(suggestion: CitySuggestion): void {
    this.weatherForm.patchValue({ city: suggestion.mainText });
    this.showSuggestions = false;
  }


  private setupAutodetectSubscription(): void {
    this.weatherForm.get('autodetectLocation')?.valueChanges.subscribe((value: boolean) => {
      if (value) {
        this.disableManualInputs();
      } else {
        this.enableManualInputs();
      }
    });
  }

  private disableManualInputs(): void {
    ['street', 'city', 'state'].forEach(field => {
      this.weatherForm.get(field)?.disable();
    });
  }

  private enableManualInputs(): void {
    ['street', 'city', 'state'].forEach(field => {
      this.weatherForm.get(field)?.enable();
    });
  }

  private processWeatherData(weatherData: WeatherData[]): WeatherData[] {
    return weatherData.map(day => {
      const formatTime = (timeString: string | undefined): string => {
        if (!timeString) {
          return 'N/A';
        }

        try {
          const date = new Date(timeString);
          if (isNaN(date.getTime())) {
            return 'N/A';
          }

          // Format time in local timezone, 12-hour format with AM/PM
          const formatted = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          });
          
          return formatted;
        } catch (e) {
          return 'N/A';
        }
      };

      // Process and validate the data
      const processed = {
        ...day,
        values: {
          ...day.values,
          icon: this.getWeatherIcon(day.values.weatherCode),
          apparentTemperature: day.values.apparentTemperature || day.values.temperatureMax,
          humidity: day.values.humidity || 0,
          visibility: day.values.visibility || 0,
          cloudCover: day.values.cloudCover || 0,
          // Format sunrise and sunset times
          sunriseTime: formatTime(day.values.sunriseTime),
          sunsetTime: formatTime(day.values.sunsetTime)
        }
      };

      return processed;
    });
  }

  private isValidTimeString(timeString: string | undefined): boolean {
    if (!timeString) return false;
    
    try {
      const date = new Date(timeString);
      return !isNaN(date.getTime());
    } catch {
      return false;
    }
  }

  onSubmit(): void {
    if (this.weatherForm.valid) {
      this.loading = true;
      this.error = null;
      
      const formData = this.weatherForm.value;
      
      if (formData.autodetectLocation) {
        this.getCurrentLocation();
      } else {
        this.getWeatherForAddress(formData);
      }
    } else {
      this.markFormAsTouched();
      this.error = 'Please fill out all required fields correctly.';
    }
  }

  private getWeatherForAddress(formData: any): void {
    // First validate if the address looks reasonable
    if (!this.isValidAddress(formData)) {
      this.error = 'An error occurred. Please try again later.';
      this.loading = false;
      this.results = [];
      return;
    }

    console.log('Valid address detected. Proceeding to fetch weather data.');

    this.weatherService.getWeatherByAddress(
      formData.street,
      formData.city,
      formData.state
    ).subscribe({
      next: (weatherData: any) => {
        console.log('Received weather data from API:', weatherData);
        // Check if the weather data is valid/exists
        if (!weatherData || !weatherData.weather_data || weatherData.weather_data.length === 0) {
          this.error = 'An error occurred. Please try again later.';
          this.loading = false;
          this.results = [];
          return;
        }

        // Check if the response includes an error indication
        if (weatherData.error || !this.isValidWeatherData(weatherData)) {
          this.error = 'An error occurred. Please try again later.';
          this.loading = false;
          this.results = [];
          return;
        }

        this.handleWeatherData({
          street: formData.street,
          city: formData.city,
          state: formData.state,
          weather_data: this.processWeatherData(weatherData.weather_data),
          forecast_data: weatherData.forecast_data,
          latitude: weatherData.latitude,    // Add latitude
          longitude: weatherData.longitude   // Add longitude
        });
        
      },
      error: (error) => {
        console.error('Error fetching weather:', error);
        this.error = 'An error occurred. Please try again later.';
        this.loading = false;
        this.results = [];
      }
    });
  }

  private isValidAddress(formData: any): boolean {
    // Check if the address components look reasonable
    const streetPattern = /^[a-zA-Z0-9\s.,-]+$/;
    const cityPattern = /^[a-zA-Z\s.-]+$/;
    
    const isValid = (
      formData.street &&
      formData.city &&
      formData.state &&
      formData.street.length >= 3 &&
      formData.city.length >= 2 &&
      streetPattern.test(formData.street) &&
      cityPattern.test(formData.city) &&
      this.states.includes(formData.state)
    );

    if (!isValid) {
      console.warn('Address validation failed:', formData);
    }

    return isValid;
  }

  private isValidWeatherData(weatherData: any): boolean {
    // Check if the weather data structure looks valid
    if (!weatherData.weather_data || !Array.isArray(weatherData.weather_data)) {
      console.warn('Weather data validation failed: weather_data is missing or not an array.');
      return false;
    }

    // Check if each weather data entry has the required properties
    const isValid = weatherData.weather_data.every((day: any) => 
      day.startTime &&
      day.values &&
      typeof day.values.temperatureMax === 'number' &&
      typeof day.values.temperatureMin === 'number' &&
      typeof day.values.windSpeed === 'number' &&
      typeof day.values.weatherCode === 'number'
    );

    if (!isValid) {
      console.warn('Weather data validation failed: One or more entries are invalid.', weatherData.weather_data);
    }

    return isValid;
  }

  // New method to handle chart initialization
  onChartInit(chart: Highcharts.Chart): void {
    this.currentChart = chart;
  }

  // Updated switchView method
  switchView(view: 'day' | 'temp' | 'meteogram'): void {
    // First, destroy existing chart if it exists
    if (this.currentChart) {
      this.currentChart.destroy();
      this.currentChart = null;
    }
  
    this.activeView = view;
  
    // Ensure containers are properly reset
    const tempContainer = document.getElementById('temperatureChart');
    const meteoContainer = document.getElementById('meteogramChart');
    
    if (tempContainer) {
      tempContainer.innerHTML = '';
      tempContainer.style.display = view === 'temp' ? 'block' : 'none';
    }
    
    if (meteoContainer) {
      meteoContainer.innerHTML = '';
      meteoContainer.style.display = view === 'meteogram' ? 'block' : 'none';
    }
  
    // Use setTimeout to ensure DOM is updated before creating new chart
    setTimeout(() => {
      if (view === 'temp') {
        this.updateTemperatureChart();
      } else if (view === 'meteogram') {
        this.updateMeteogramChart();
      }
    }, 100);
  }
  

  // Updated handleWeatherData method
  // Add this method inside the WeatherFormComponent class

  private handleWeatherData(result: WeatherResult): void {
    console.log('Handling weather data:', result);
    if (!result || !result.weather_data || !Array.isArray(result.weather_data) || result.weather_data.length === 0) {
      this.error = 'An error occurred. Please try again later.';
      this.loading = false;
      this.results = [];
      return;
    }
  
    try {
      if (!result.forecast_data?.hourly) {
        const hourlyData = this.createHourlyDataFromDaily(result.weather_data);
        result.forecast_data = {
          hourly: hourlyData.map(data => ({
            timestamp: new Date(data.startTime).getTime(),
            temperature: data.values.temperature || 0,
            humidity: data.values.humidity || 0,
            pressure: data.values.pressureSeaLevel || 29.92,
            windSpeed: data.values.windSpeed || 0,
            windDirection: data.values.windDirection || 0,
          }))
        };
      }
  
      this.results = [result];
      this.loading = false;
      this.error = null;
  
      // Update currentMapLocation if latitude and longitude are available
      if (result.latitude && result.longitude) {
        this.currentMapLocation = {
          lat: Number(result.latitude),
          lng: Number(result.longitude)
        };
        console.log('Current map location set to:', this.currentMapLocation);
  
        if (this.showDetails && this.mapInitialized) {
          this.updateMapCenter();
        } else if (this.showDetails && !this.mapInitialized) {
          setTimeout(() => {
            this.initMap();
            this.mapInitialized = true;
            this.cdRef.detectChanges();
          }, 100);
        }
      } else {
        this.currentMapLocation = null;
        console.log('No valid latitude and longitude provided.');
      }
  
      // Update charts if needed
      if (this.activeView === 'temp' || this.activeView === 'meteogram') {
        if (this.chartUpdateTimeout) {
          clearTimeout(this.chartUpdateTimeout);
        }
  
        this.chartUpdateTimeout = setTimeout(() => {
          if (this.activeView === 'temp') {
            this.updateTemperatureChart();
          } else if (this.activeView === 'meteogram') {
            this.updateMeteogramChart();
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error handling weather data:', error);
      this.error = 'An error occurred while processing weather data.';
      this.loading = false;
      this.results = [];
    }
  }
  
  
  
   

private handleChartContainers(): void {
  if (!isPlatformBrowser(this.platformId)) {
    return;
  }

  const tempContainer = document.getElementById('temperatureChart');
  const meteoContainer = document.getElementById('meteogramChart');
  
  if (tempContainer) tempContainer.style.display = 'none';
  if (meteoContainer) meteoContainer.style.display = 'none';
  
  if (this.activeView === 'temp' && tempContainer) {
    tempContainer.style.display = 'block';
  } else if (this.activeView === 'meteogram' && meteoContainer) {
    meteoContainer.style.display = 'block';
  }
}

  // New helper method to create hourly data from daily data
  private createHourlyDataFromDaily(dailyData: WeatherData[]): HourlyWeatherData[] {
    const hourlyData: HourlyWeatherData[] = [];
    
    dailyData.forEach(day => {
      for (let hour = 0; hour < 24; hour++) {
        const dateTime = new Date(day.startTime);
        dateTime.setHours(hour);
        
        // Calculate temperature using sinusoidal interpolation
        const progress = hour / 24;
        const temperature = day.values.temperatureMin + 
          (day.values.temperatureMax - day.values.temperatureMin) * 
          Math.sin((progress * Math.PI) - (Math.PI / 2)) * 0.5 + 0.5;

        // Generate realistic wind direction (changes gradually)
        const baseDirection = Math.random() * 360;
        const windDirection = (baseDirection + (hour * 15)) % 360;

        hourlyData.push({
          startTime: dateTime.toISOString(),
          values: {
            temperature: temperature,
            humidity: day.values.humidity || 0,
            pressureSeaLevel: day.values.pressureSeaLevel || 29.92,
            windSpeed: day.values.windSpeed || 0,
            windDirection: windDirection
          }
        });
      }
    });

    return hourlyData;
  }

  private markFormAsTouched(): void {
    Object.keys(this.weatherForm.controls).forEach(key => {
      const control = this.weatherForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

   // Update these methods
   isLocationFavorite(city: string, state: string): boolean {
    const favs = this.weatherService.favorites();
    return favs.some(f => f.city === city && f.state === state);
  }

  toggleFavorite(result: WeatherResult): void {
    if (this.isLocationFavorite(result.city, result.state)) {
      const favoriteId = this.weatherService.getFavoriteId(result.city, result.state);
      if (favoriteId) {
        this.weatherService.removeFavorite(favoriteId).subscribe({
          error: (error) => console.error('Error removing favorite:', error)
        });
      }
    } else {
      const newFavorite: Omit<Favorite, '_id'> = {
        street: result.street,
        city: result.city,
        state: result.state,
        weather_data: this.processWeatherData(result.weather_data)
      };

      this.weatherService.addFavorite(newFavorite).subscribe({
        error: (error) => console.error('Error adding favorite:', error)
      });
    }
  }

  removeFromFavorites(favorite: Favorite): void {
    if (favorite._id) {
      this.weatherService.removeFavorite(favorite._id).subscribe({
        error: (error) => console.error('Error removing favorite:', error)
      });
    }
  }

  // Add this method to your WeatherFormComponent class
  onFavoriteClick(favorite: Favorite): void {
  // Set form values
  this.weatherForm.patchValue({
    street: favorite.street,
    city: favorite.city,
    state: favorite.state,
    autodetectLocation: false
  });

  // Switch to results tab
  this.activeTab = 'results';

  // Submit the form to get weather data
  this.onSubmit();
}

  clearForm(): void {
    this.ngZone.run(() => {
      this.weatherForm.reset();
      this.results = [];
      this.error = null;
      this.citySuggestions = [];
      this.showSuggestions = false;
      this.selectedDate = null;
      this.showDetails = false;
      
      // Clean up map
      this.destroyMap();
      
      this.activeView = 'day';
      
      if (this.currentChart) {
        this.currentChart.destroy();
        this.currentChart = null;
      }
      
      const tempContainer = document.getElementById('temperatureChart');
      const meteoContainer = document.getElementById('meteogramChart');
      
      if (tempContainer) {
        tempContainer.style.display = 'none';
        tempContainer.innerHTML = '';
      }
      
      if (meteoContainer) {
        meteoContainer.style.display = 'none';
        meteoContainer.innerHTML = '';
      }
  
      this.cdRef.detectChanges();
    });
  }
  
  

  toggleTab(tab: 'results' | 'favorites'): void {
    if (this.activeTab === tab) return;
    
    // Clean up current tab
    if (this.activeTab === 'results') {
      this.ngZone.run(() => {
        // Properly destroy map when switching tabs
        this.destroyMap();
        this.showDetails = false;
        this.selectedDate = null;
        
        if (this.currentChart) {
          this.currentChart.destroy();
          this.currentChart = null;
        }
      });
    }
    
    this.activeTab = tab;
    
    if (tab === 'results') {
      this.activeView = 'day';
      
      // Only initialize map if we're showing details
      if (this.results.length > 0 && this.showDetails && this.currentMapLocation) {
        this.scheduleMapInitialization();
      }
    }
    
    this.cdRef.detectChanges();
  }

  getWeatherStatus(weatherCode: number): string {
    return this.weatherStatuses[weatherCode] || 'Unknown';
  }

  getCurrentDayWeather(): WeatherData | null {
    if (this.results.length > 0 && this.results[0].weather_data.length > 0) {
      return this.results[0].weather_data[0];
    }
    return null;
  }

  getWeatherIcon(weatherCode: number): string {
    const iconPath = this.weatherIcons[weatherCode.toString()];
    return iconPath || '/assets/icons/unknown.svg';
  }
  
  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    console.error(`Failed to load weather icon: ${img.src}`);
    img.style.display = 'none';
  }

  // Updated meteogram chart with windbarb and chart initialization
  // In the updateMeteogramChart method, update the meteogramOptions to include windbarbs:

  private updateMeteogramChart(): void {
    if (!this.results[0]?.forecast_data?.hourly) {
      console.log('No hourly weather data available for meteogram');
      return;
    }
  
    try {
      const hourlyData: HourlyData[] = this.results[0].forecast_data.hourly;
      
      const processedHourlyData = hourlyData
        .filter(data => data && typeof data.timestamp === 'number')
        .map(data => ({
          timestamp: data.timestamp,
          temperature: data.temperature || 0,
          humidity: data.humidity || 0,
          pressure: data.pressure || 29.92,
          windSpeed: data.windSpeed || 0,
          windDirection: data.windDirection || 0,
          precipitationProbability: data.precipitationProbability || 0
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
  
      if (processedHourlyData.length === 0) {
        console.warn('No valid hourly data available');
        return;
      }
  
      const meteogramOptions: Highcharts.Options = {
        chart: {
          height: 400,
          marginRight: 50,
          marginLeft: 50,
          marginTop: 40,
          marginBottom: 60,
          style: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          },
          backgroundColor: '#FFFFFF',
          spacingBottom: 15,
          spacingTop: 15,
          animation: {
            duration: 1000,
            easing: 'easeOutQuart'
          }
        },
        title: {
          text: 'Hourly Weather (For Next 5 Days)',
          align: 'center',
          style: {
            fontSize: '16px',
            fontWeight: '500',
            color: '#333333'
          },
          margin: 15
        },
        xAxis: [{
          type: 'datetime',
          tickInterval: 4 * 3600 * 1000,
          minorTickInterval: 3600 * 1000,
          gridLineWidth: 1,
          gridLineColor: '#E5E7EB',
          labels: {
            format: '{value:%H}',
            style: {
              fontSize: '11px',
              color: '#666666'
            }
          },
          minorGridLineWidth: 0,
          lineColor: '#E5E7EB'
        }, {
          type: 'datetime',
          linkedTo: 0,
          opposite: true,
          tickInterval: 24 * 3600 * 1000,
          labels: {
            format: '{value:%a, %b %e}',
            style: {
              fontSize: '11px',
              color: '#666666'
            }
          }
        }],
        yAxis: [{
          title: {
            text: 'Temperature (°F)',
            style: { color: '#E64D3D' }
          },
          labels: {
            format: '{value}°F',
            style: { color: '#E64D3D' }
          },
          opposite: false,
          gridLineColor: '#E5E7EB'
        }, {
          title: {
            text: 'Humidity (%)',
            style: { color: '#3498DB' }
          },
          labels: {
            format: '{value}%',
            style: { color: '#3498DB' }
          },
          opposite: true,
          max: 100,
          min: 0,
          gridLineColor: '#E5E7EB'
        }, {
          title: {
            text: 'Pressure (inHg)',
            style: { color: '#F39C12' }
          },
          labels: {
            format: '{value}',
            style: { color: '#F39C12' }
          },
          opposite: true,
          gridLineColor: '#E5E7EB'
        }, {
          title: {
            text: 'Wind (mph)',
            style: { color: '#666666' }
          },
          labels: {
            format: '{value} mph',
            style: { color: '#666666' }
          },
          opposite: true,
          offset: 40,
          min: 0,
          max: Math.max(...processedHourlyData.map(d => d.windSpeed)) + 5,
          gridLineWidth: 0
        }],
        series: [{
          name: 'Temperature',
          type: 'spline',
          data: processedHourlyData.map(d => [d.timestamp, d.temperature]),
          color: '#E64D3D',
          lineWidth: 2,
          marker: {
            enabled: false
          },
          tooltip: { valueSuffix: '°F' },
          zIndex: 2,
          animation: {
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }, {
          name: 'Humidity',
          type: 'column',
          yAxis: 1,
          data: processedHourlyData.map(d => [d.timestamp, d.humidity]),
          color: '#3498DB',
          tooltip: { valueSuffix: '%' },
          groupPadding: 0,
          pointPadding: 0,
          borderWidth: 0,
          states: {
            hover: {
              brightness: 0.1
            }
          },
          animation: {
            defer: 250,
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }, {
          name: 'Pressure',
          type: 'spline',
          yAxis: 2,
          data: processedHourlyData.map(d => [d.timestamp, d.pressure]),
          color: '#F39C12',
          lineWidth: 1,
          dashStyle: 'ShortDot',
          marker: {
            enabled: false
          },
          tooltip: { valueSuffix: ' inHg' },
          animation: {
            defer: 500,
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }, {
          name: 'Wind',
          type: 'windbarb',
          yAxis: 3,
          data: processedHourlyData.map(d => ({
            x: d.timestamp,
            value: d.windSpeed,
            direction: d.windDirection
          })),
          color: '#666666',
          lineWidth: 1,
          vectorLength: 12,
          yOffset: -15,
          tooltip: {
            pointFormat: '<b>Wind Speed:</b> {point.value} mph<br/><b>Direction:</b> {point.direction}°'
          },
          animation: {
            defer: 750,
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }],
        tooltip: {
          shared: true,
          useHTML: true,
          headerFormat: '<b>{point.x:%A, %b %e, %H:00}</b><br/>',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: '#E5E7EB',
          borderRadius: 4,
          padding: 8,
          shadow: true,
          style: {
            fontSize: '12px'
          }
        },
        legend: {
          enabled: true,
          align: 'center',
          verticalAlign: 'bottom',
          layout: 'horizontal',
          itemStyle: {
            fontSize: '11px',
            fontWeight: 'normal',
            color: '#666666'
          },
          itemDistance: 20
        },
        plotOptions: {
          series: {
            animation: {
              duration: 1000,
              easing: 'easeOutQuart'
            },
            events: {
              legendItemClick: function() {
                return false;
              }
            }
          },
          spline: {
            animation: {
              duration: 1000,
              easing: 'easeOutQuart'
            },
            states: {
              hover: {
                lineWidth: 2
              }
            }
          },
          column: {
            animation: {
              duration: 1000,
              easing: 'easeOutQuart'
            },
            grouping: false,
            dataLabels: {
              enabled: true,
              inside: true,
              crop: false,
              overflow: 'allow' as const,
              style: {
                fontSize: '10px',
                fontWeight: 'normal',
                color: '#FFFFFF',
                textOutLine: 'none',
                textShadow: 'none'
              },
              formatter: function() {
                return this.y ? `${Math.round(this.y)}` : '';
              }
            }
          },
          windbarb: {
            animation: {
              duration: 1000,
              easing: 'easeOutQuart'
            },
            crisp: false,
            pointPlacement: 'between',
            onSeries: 'Temperature'
          }
        },
        credits: {
          enabled: false
        }
      };
  
      // Create new chart
      const container = document.getElementById('meteogramChart');
      if (container) {
        if (this.currentChart) {
          this.currentChart.destroy();
        }
        this.currentChart = Highcharts.chart(container, meteogramOptions);
      }
  
    } catch (error) {
      console.error('Error updating meteogram chart:', error);
    }
  }

  // Helper function to calculate Beaufort scale
  private getBeaufortScale(windSpeed: number): number {
    if (windSpeed < 1) return 0;
    if (windSpeed < 4) return 1;
    if (windSpeed < 8) return 2;
    if (windSpeed < 13) return 3;
    if (windSpeed < 19) return 4;
    if (windSpeed < 25) return 5;
    if (windSpeed < 32) return 6;
    if (windSpeed < 39) return 7;
    if (windSpeed < 47) return 8;
    if (windSpeed < 55) return 9;
    if (windSpeed < 64) return 10;
    if (windSpeed < 73) return 11;
    return 12;
  }

  private generateDayPlotBands(hourlyData: ProcessedWeatherPoint[]): Highcharts.XAxisPlotBandsOptions[] {
    const plotBands: Highcharts.XAxisPlotBandsOptions[] = [];
    let currentDate = '';
  
    hourlyData.forEach(data => {
      const date = new Date(data.timestamp);
      const dateStr = date.toLocaleDateString();

      if (dateStr !== currentDate) {
        currentDate = dateStr;
        const startDate = new Date(date);
        const endDate = new Date(date);
        
        plotBands.push({
          from: startDate.setHours(0, 0, 0, 0),
          to: endDate.setHours(23, 59, 59, 999),
          color: 'rgba(128, 128, 128, 0.05)',
          label: {
            text: date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            }),
            style: {
              fontSize: '12px',
              color: '#666666'
            },
            y: 20
          }
        });
      }
    });
  
    return plotBands;
  }

  private updateTemperatureChart(): void {
    if (!this.results[0]?.weather_data) {
      console.log('No weather data available');
      return;
    }
  
    try {
      const temperatureData = this.results[0].weather_data.map(day => ({
        x: new Date(day.startTime).getTime(),
        low: Number(day.values.temperatureMin),
        high: Number(day.values.temperatureMax)
      })).filter(data => 
        !isNaN(data.x) && 
        !isNaN(data.low) && 
        !isNaN(data.high)
      );
  
      if (temperatureData.length === 0) {
        console.warn('No valid temperature data after processing');
        return;
      }
  
      // Create new chart
      const container = document.getElementById('temperatureChart');
      if (container) {
        // Important: Ensure container is visible
        container.style.display = 'block';
        
        if (this.currentChart) {
          this.currentChart.destroy();
        }
  
        this.currentChart = Highcharts.chart('temperatureChart', {
          chart: {
            type: 'arearange',
            height: 400
          },
          title: {
            text: 'Temperature Ranges (Min, Max)'
          },
          xAxis: {
            type: 'datetime',
            labels: {
              format: '{value:%d %b}'
            }
          },
          yAxis: {
            title: {
              text: 'Temperature (°F)'
            }
          },
          tooltip: {
            shared: true,
            valueSuffix: '°F',
            formatter: function() {
              const point = this.points?.[0]?.point as any;
              return `<b>${Highcharts.dateFormat('%A, %b %e', point.x)}</b><br/>
                      High: ${point.high.toFixed(1)}°F<br/>
                      Low: ${point.low.toFixed(1)}°F`;
            }
          },
          series: [{
            name: 'Temperature',
            data: temperatureData.map(d => [d.x, d.low, d.high]),
            type: 'arearange',
            fillColor: {
              linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
              stops: [
                [0, 'rgba(255, 166, 0, 0.6)'],
                [1, 'rgba(255, 255, 255, 0.1)']
              ]
            },
            lineWidth: 1.5,
            lineColor: '#1E90FF',
            marker: {
              enabled: true
            }
          }]
        });
      }
    } catch (error) {
      console.error('Error updating temperature chart:', error);
    }
  }

  shareWeather(): void {
    if (this.results.length > 0) {
      let weatherToShare: WeatherData | null;
      
      if (this.selectedDate) {
        // If a specific date is selected (clicked from day view)
        weatherToShare = this.getDayWeather(this.selectedDate);
      } else {
        // If just clicked on details button (current day)
        weatherToShare = this.getCurrentDayWeather();
      }
  
      if (!weatherToShare) return;
  
      const shareData = this.formatWeatherShareData(weatherToShare);
      const tweetText = this.formatTweetText(shareData);
      
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
    }
  }

  shareWeatherFromDetails(): void {
    if (this.results.length > 0) {
      const currentWeather = this.getCurrentDayWeather();
      if (!currentWeather) return;
  
      const shareData = this.formatWeatherShareData(currentWeather);
      const tweetText = this.formatTweetText(shareData);
      
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
    }
  }

  private formatWeatherShareData(weather: WeatherData): WeatherShareData {
    const temperature = weather.values.apparentTemperature || 
                       weather.values.temperatureMax || 
                       weather.values.temperatureMin;
    
    // Get location from results
    let location: string;
    if (this.weatherForm.get('autodetectLocation')?.value) {
      // For current location, use city and state
      if (this.results[0]?.city && this.results[0]?.state) {
        location = `${this.results[0].city}, ${this.results[0].state}`;
      } else {
        location = 'Current Location';
      }
    } else {
      // For manually entered address
      location = `${this.results[0].street}, ${this.results[0].city}, ${this.results[0].state}`;
    }
  
    return {
      temperature: parseFloat(temperature.toFixed(2)),
      location: location,
      conditions: this.getWeatherStatus(weather.values.weatherCode),
      date: new Date(weather.startTime)
    };
  }

  private formatTweetText(data: WeatherShareData): string {
    const dateStr = data.date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    return `The temperature in ${data.location} on ${dateStr} is ${data.temperature}°F and the conditions are ${data.conditions} #CSCI571WeatherForecast`;
  }

  public selectedDate: string | null = null; // Add this property at the top of the class

  showDayDetails(date: string): void {
    if (!date) return;
    
    this.ngZone.run(() => {
      this.selectedDate = date;
      this.showDetails = true;
      
      if (this.currentMapLocation) {
        this.scheduleMapInitialization();
      }
    });
  }

  private updateMapCenter(): void {
    if (!this.map || !this.currentMapLocation) {
      console.error('Map or currentMapLocation is not set.');
      return;
    }
    try {
      console.log('Updating map center to:', this.currentMapLocation);
      this.map.setCenter({ lat: this.currentMapLocation.lat, lng: this.currentMapLocation.lng });
      if (this.marker) {
        this.marker.setPosition({ lat: this.currentMapLocation.lat, lng: this.currentMapLocation.lng });
      } else {
        this.marker = new google.maps.Marker({
          position: { lat: this.currentMapLocation.lat, lng: this.currentMapLocation.lng },
          map: this.map,
          animation: google.maps.Animation.DROP
        });
      }
      // Trigger resize in case the container size changed
      google.maps.event.trigger(this.map, 'resize');
      console.log('Map center updated successfully.');
    } catch (error) {
      console.error('Error updating map center:', error);
      this.showErrorMessage('Failed to update map. Please try again later.');
    }
  }
  
  
  
  
  // Update hideDetails to properly clean up when clicking back
  hideDetails(): void {
    this.showDetails = false;
    this.selectedDate = null; // Clear the selected date
  }

  private destroyMap(): void {
    if (this.marker) {
      this.marker.setMap(null);
      this.marker = null;
    }
    
    if (this.map) {
      google.maps.event.clearInstanceListeners(this.map);
      this.map = null;
    }
  
    this.mapInitialized = false;
    this.mapContainer = null;
    this.cdRef.detectChanges();
  }
  

  // Add this helper method to get weather data for a specific date
  getDayWeather(date: string | null): WeatherData | null {
    if (!date || !this.results[0]?.weather_data) return null;
    
    return this.results[0].weather_data.find(day => 
      new Date(day.startTime).toDateString() === new Date(date).toDateString()
    ) || null;
  }
  
  private initMap(): void {
    if (!isPlatformBrowser(this.platformId) || !this.currentMapLocation || !this.showDetails) {
      return;
    }
  
    if (!this.mapElement) {
      console.error('Map element not found');
      return;
    }
  
    try {
      const mapOptions: google.maps.MapOptions = {
        center: { 
          lat: this.currentMapLocation.lat, 
          lng: this.currentMapLocation.lng 
        },
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_LEFT
        },
        fullscreenControl: true,
        fullscreenControlOptions: {
          position: google.maps.ControlPosition.RIGHT_TOP
        },
        streetViewControl: true,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER
        }
      };
  
      // Create new map instance
      this.map = new google.maps.Map(this.mapElement.nativeElement, mapOptions);
  
      // Create new marker
      this.marker = new google.maps.Marker({
        position: { 
          lat: this.currentMapLocation.lat, 
          lng: this.currentMapLocation.lng 
        },
        map: this.map,
        animation: google.maps.Animation.DROP
      });
  
      // Add resize listener
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        this.ngZone.run(() => {
          google.maps.event.trigger(this.map, 'resize');
        });
      });
  
      this.mapInitialized = true;
      console.log('Map initialized successfully');
    } catch (error) {
      console.error('Error initializing map:', error);
      this.error = 'Failed to initialize map. Please try again later.';
    }
  }
  
  
  
  
  
  
  
  
  private showErrorMessage(message: string): void {
    this.error = message;
    // You can also add additional UI elements to display the error message
  }
  
  private updateMap(location: MapPosition): void {
    if (!isPlatformBrowser(this.platformId)) return;
  
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      console.error('Invalid location for map update:', location);
      return;
    }
  
    try {
      if (!this.map) {
        // Initialize the map if it doesn't exist
        this.initMap();
        return;
      }
  
      // Update map center
      this.map.setCenter({ lat: location.lat, lng: location.lng });
      console.log('Map center updated to:', location);
  
      // Update marker position
      if (this.marker) {
        this.marker.setPosition({ lat: location.lat, lng: location.lng });
        console.log('Map marker updated to:', location);
      } else {
        this.marker = new google.maps.Marker({
          position: { lat: location.lat, lng: location.lng },
          map: this.map,
          animation: google.maps.Animation.DROP
        });
        console.log('Map marker created at:', location);
      }
  
      // Update currentMapLocation
      this.currentMapLocation = location;
    } catch (error) {
      console.error('Error updating map:', error);
    }
  }
  
  
  

 // Existing method for generating day plot bands remains unchanged
  // (Already included above)

  // Existing switchView method was updated above

  // Existing other methods remain unchanged

  // Existing form getters remain unchanged
  get street() { return this.weatherForm.get('street'); }
  get city() { return this.weatherForm.get('city'); }
  get state() { return this.weatherForm.get('state'); }
}
