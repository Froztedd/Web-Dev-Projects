// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables
const TOMORROW_API_KEY = process.env.TOMORROW_API_KEY;
const GOOGLE_GEOCODING_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware setup
// CORS Configuration
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || origin === 'http://localhost:4200' || origin === 'https://weatherappnew-441709.uc.r.appspot.com') {
            callback(null, true);
        } else {
            console.log('Rejected Origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Keep these middleware configurations
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('Origin:', req.headers.origin);
    next();
});

// Add CORS error handling
app.use((err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        console.error('CORS Error:', {
            origin: req.headers.origin,
            method: req.method,
            path: req.path
        });
        return res.status(403).json({
            error: 'CORS Error',
            message: 'Origin not allowed'
        });
    }
    next(err);
});


// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  });

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// MongoDB connection error handling
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
  });
  
  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
  });

// Tomorrow.io API base URL
const TOMORROW_API_BASE_URL = 'https://api.tomorrow.io/v4';

// Define Favorite Schema
// Update the favoriteSchema in server.js
const favoriteSchema = new mongoose.Schema({
    street: String,
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    weather_data: {
      type: Array,
      default: []
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  const Favorite = mongoose.model('Favorite', favoriteSchema)

// Create axios instance for Tomorrow.io API
const tomorrowApi = axios.create({
    baseURL: TOMORROW_API_BASE_URL,
    timeout: 10000,
    headers: {
        'Accept': 'application/json',
        'apikey': TOMORROW_API_KEY
    }
});

// Utility function to format and validate time values
const formatTimeValue = (timeValue) => {
    if (!timeValue) return null;
    try {
        const date = new Date(timeValue);
        if (isNaN(date.getTime())) {
            console.error('Invalid time value:', timeValue);
            return null;
        }
        return date.toISOString();
    } catch (e) {
        console.error('Error formatting time value:', e);
        return null;
    }
};

// Validate weather data structure
const validateWeatherData = (weatherData) => {
    if (!Array.isArray(weatherData)) {
        console.error('Weather data is not an array');
        return false;
    }

    return weatherData.every(day => {
        if (!day.startTime || !day.values) {
            console.error('Missing required fields in weather data');
            return false;
        }

        const requiredNumericFields = [
            'temperatureMax',
            'temperatureMin',
            'windSpeed',
            'humidity',
            'visibility',
            'cloudCover'
        ];

        const hasValidNumericFields = requiredNumericFields.every(field => 
            typeof day.values[field] === 'number' && !isNaN(day.values[field])
        );

        if (!hasValidNumericFields) {
            console.error('Invalid numeric fields in weather data');
            return false;
        }

        const validTimes = (
            day.values.sunriseTime === null || typeof day.values.sunriseTime === 'string'
        ) && (
            day.values.sunsetTime === null || typeof day.values.sunsetTime === 'string'
        );

        if (!validTimes) {
            console.error('Invalid time format in weather data');
            return false;
        }

        return true;
    });
};

// Function to Geocode Address using Google Geocoding API
const geocodeAddress = async (address) => {
    const encodedAddress = encodeURIComponent(address);
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_GEOCODING_API_KEY}`;

    try {
        const response = await axios.get(geocodeUrl);
        if (response.data.status === 'OK') {
            const location = response.data.results[0].geometry.location;
            return { lat: location.lat, lon: location.lng };
        } else {
            throw new Error(`Geocoding failed: ${response.data.status}`);
        }
    } catch (error) {
        throw new Error(`Geocoding error: ${error.message}`);
    }
};

// Function to process weather data
const processWeatherData = (intervals) => {
    return intervals.map(interval => {
        // Process and validate time values
        const sunriseTime = formatTimeValue(interval.values.sunriseTime);
        const sunsetTime = formatTimeValue(interval.values.sunsetTime);

        // Create processed interval object
        return {
            startTime: interval.startTime,
            values: {
                temperatureMax: Number(interval.values.temperatureMax) || 0,
                temperatureMin: Number(interval.values.temperatureMin) || 0,
                windSpeed: Number(interval.values.windSpeed) || 0,
                weatherCode: Number(interval.values.weatherCode) || 1000,
                humidity: Number(interval.values.humidity) || 0,
                visibility: Number(interval.values.visibility) || 0,
                cloudCover: Number(interval.values.cloudCover) || 0,
                apparentTemperature: Number(interval.values.temperature) || Number(interval.values.temperatureMax) || 0,
                precipitationProbability: Number(interval.values.precipitationProbability) || 0,
                sunriseTime,
                sunsetTime
            }
        };
    });
};

// **Updated Function to Process Hourly Data with Enhanced Validations**
const processHourlyData = (intervals) => {
    if (!intervals || !Array.isArray(intervals)) {
        console.warn('Invalid intervals data received');
        return [];
    }

    return intervals
        .map(interval => {
            // Validate the interval data
            if (!interval.startTime || !interval.values) {
                console.warn('Invalid interval data:', interval);
                return null;
            }

            const timestamp = new Date(interval.startTime).getTime();
            if (isNaN(timestamp)) {
                console.warn('Invalid timestamp:', interval.startTime);
                return null;
            }

            return {
                timestamp,
                temperature: Number(interval.values.temperature) || 0,
                humidity: Number(interval.values.humidity) || 0,
                pressure: Number(interval.values.pressureSeaLevel) || 29.92,
                windSpeed: Number(interval.values.windSpeed) || 0,
                windDirection: Number(interval.values.windDirection) || 0,
                precipitationProbability: Number(interval.values.precipitationProbability) || 0
            };
        })
        .filter(data => data !== null);
};


// Get all favorites
app.get('/api/favorites', async (req, res) => {
    try {
      console.log('GET /api/favorites called');
      const favorites = await Favorite.find().sort({ createdAt: -1 });
      console.log('Found favorites:', favorites);
      res.json(favorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      res.status(500).json({ 
        error: 'Failed to fetch favorites',
        details: error.message 
      });
    }
  });

// Add a favorite
app.post('/api/favorites', async (req, res) => {
    console.log('Received favorite creation request:', req.body);
    const { street, city, state } = req.body;
  
    if (!city || !state) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'City and state are required' });
    }
  
    try {
      // Check for existing favorite
      const existing = await Favorite.findOne({ city, state });
      if (existing) {
        console.log('Favorite already exists:', { city, state });
        return res.status(400).json({ error: 'Location already in favorites' });
      }
  
      const favorite = new Favorite({ street, city, state });
      const savedFavorite = await favorite.save();
      console.log('Successfully saved new favorite:', savedFavorite);
      res.status(201).json(savedFavorite);
    } catch (error) {
      console.error('Error in POST /api/favorites:', error);
      res.status(500).json({ 
        error: 'Failed to add favorite',
        details: error.message 
      });
    }
  });

// Delete a favorite
app.delete('/api/favorites/:id', async (req, res) => {
    try {
      console.log('Attempting to delete favorite with ID:', req.params.id);
      const result = await Favorite.findByIdAndDelete(req.params.id);
      
      if (!result) {
        console.log('Favorite not found with ID:', req.params.id);
        return res.status(404).json({ error: 'Favorite not found' });
      }
  
      console.log('Successfully deleted favorite:', result);
      res.json({ message: 'Favorite deleted', id: req.params.id });
    } catch (error) {
      console.error('Error in DELETE /api/favorites:', error);
      res.status(500).json({ 
        error: 'Failed to delete favorite',
        details: error.message 
      });
    }
  });

// **Updated Endpoint for Meteogram Data**
app.get('/api/get_meteogram_data', async (req, res) => {
    let { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({
            error: 'Latitude and longitude are required'
        });
    }

    try {
        const meteogramParams = {
            location: `${lat},${lon}`,
            fields: [
                "temperature",
                "humidity",
                "pressureSeaLevel",
                "windSpeed",
                "windDirection",
                "precipitationProbability"
            ],
            units: "imperial",
            timesteps: ["1h"],
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        };

        const response = await tomorrowApi.get('/timelines', { params: meteogramParams });

        if (!response.data?.data?.timelines) {
            throw new Error('Invalid data received from API');
        }

        const hourlyTimeline = response.data.data.timelines.find(t => t.timestep === '1h');
        
        if (!hourlyTimeline || !hourlyTimeline.intervals) {
            throw new Error('No hourly data available');
        }

        // Process all hourly data points
        const hourlyData = processHourlyData(hourlyTimeline.intervals);

        if (hourlyData.length === 0) {
            throw new Error('No valid hourly data after processing');
        }

        return res.json({
            success: true,
            hourlyData: hourlyData
        });

    } catch (error) {
        console.error('Error fetching meteogram data:', error);
        return res.status(500).json({
            error: 'Failed to fetch meteogram data',
            message: error.message
        });
    }
});
// Updated Endpoint to get weather data based on coordinates or address
app.get('/api/get_weather', async (req, res) => {
    let { street, city, state, auto_detect, lat, lon } = req.query;

    console.log('Received weather request with params:', { street, city, state, auto_detect, lat, lon });
    console.log('Using API Key:', TOMORROW_API_KEY ? 'Present' : 'Missing');

    try {
        // Define common weather parameters
        const weatherParams = {
            fields: [
                "temperature",
                "temperatureMax",
                "temperatureMin",
                "windSpeed",
                "windDirection",
                "humidity",
                "weatherCode",
                "precipitationProbability",
                "pressureSeaLevel",
                "cloudCover",
                "uvIndex",
                "visibility",
                "sunriseTime",
                "sunsetTime"
            ],
            units: "imperial",
            timesteps: ["1d", "1h"],
            startTime: "now",
            endTime: new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
        };

        let coordinates;
        let requestCity = city;
        let requestState = state;

        if (auto_detect === 'true' && lat && lon) {
            console.log('Processing auto-detect request with coordinates:', { lat, lon });
            coordinates = { lat: parseFloat(lat), lon: parseFloat(lon) };
            weatherParams.location = `${coordinates.lat},${coordinates.lon}`;
        } else if (street && city && state) {
            console.log('Processing address request:', { street, city, state });
            const address = `${street}, ${city}, ${state}, USA`;
            console.log('Geocoding address:', address);

            coordinates = await geocodeAddress(address);
            weatherParams.location = `${coordinates.lat},${coordinates.lon}`;
        } else {
            return res.status(400).json({
                error: 'Invalid request parameters',
                received: { street, city, state, auto_detect, lat, lon }
            });
        }

        // Fetch weather data
        const weatherResponse = await tomorrowApi.get('/timelines', { params: weatherParams });
        console.log('Received weather response');

        if (!weatherResponse.data?.data?.timelines) {
            throw new Error('Invalid weather data received from API');
        }

        // Process daily and hourly weather data
        const dailyTimeline = weatherResponse.data.data.timelines.find(t => t.timestep === '1d');
        const hourlyTimeline = weatherResponse.data.data.timelines.find(t => t.timestep === '1h');

        if (!dailyTimeline || !hourlyTimeline) {
            throw new Error('Missing required timeline data');
        }

        const weatherData = processWeatherData(dailyTimeline.intervals);
        const hourlyData = processHourlyData(hourlyTimeline.intervals);

        // Validate processed data
        if (!validateWeatherData(weatherData)) {
            throw new Error('Weather data validation failed');
        }

        // Extract city and state from processed weather data if not provided
        // This assumes that each day's data includes city and state
        // You might need to adjust this based on your actual data structure
        if (!city || !state) {
            const firstDay = weatherData[0];
            if (firstDay.city && firstDay.state) {
                requestCity = firstDay.city;
                requestState = firstDay.state;
            }
        }

        // Check if this location is in favorites
        const isFavorite = await Favorite.findOne({ 
            city: requestCity, 
            state: requestState 
        });

        // Send response with coordinates, weather data, and favorite info
        return res.json({
            weather_data: weatherData,
            forecast_data: { hourly: hourlyData },
            latitude: coordinates.lat,
            longitude: coordinates.lon,
            isFavorite: !!isFavorite,
            favoriteId: isFavorite?._id,
            city: requestCity,
            state: requestState,
            street: street || 'Current Location'
          });

    } catch (error) {
        console.error('Error processing weather request:', error);
        const errorResponse = {
            error: 'Weather service error',
            message: error.message
        };

        if (error.response?.data) {
            errorResponse.details = error.response.data;
        }

        return res.status(500).json(errorResponse);
    }
});

// Endpoint to get current location
app.get('/api/get_location', async (req, res) => {
    try {
        const locationResponse = await axios.get('https://ipapi.co/json/');
        const { latitude, longitude } = locationResponse.data;

        if (!latitude || !longitude) {
            throw new Error('Location coordinates not available');
        }

        res.json({ lat: latitude, lon: longitude });
    } catch (error) {
        console.error('Location error:', error);
        res.status(500).json({
            error: 'Failed to fetch location',
            details: error.message
        });
    }
});

// Test endpoint for API key
app.get('/test-api', async (req, res) => {
    try {
        const response = await tomorrowApi.get('/geocode', {
            params: { address: 'Los Angeles, CA, USA' }
        });
        res.json({
            status: 'API key working',
            response: response.data
        });
    } catch (error) {
        res.status(500).json({
            error: 'API key test failed',
            details: error.response?.data || error.message
        });
    }
});
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running' });
  });

// Endpoint for Google Places Autocomplete
app.get('/api/places/autocomplete', async (req, res) => {
    const { input } = req.query;

    if (!input || input.trim().length === 0) {
        return res.json({ predictions: [] });
    }

    try {
        const placesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json`;
        
        const params = {
            input: input,
            types: '(cities)',
            components: 'country:us',
            key: GOOGLE_GEOCODING_API_KEY
        };

        const response = await axios.get(placesUrl, { params });

        // Set CORS headers
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        if (response.data.status === 'OK') {
            const predictions = response.data.predictions.map(prediction => ({
                description: prediction.description,
                placeId: prediction.place_id,
                mainText: prediction.structured_formatting.main_text,
                secondaryText: prediction.structured_formatting.secondary_text
            }));

            res.json({ predictions });
        } else {
            console.error('Places API error:', response.data.status);
            res.json({ 
                predictions: [],
                error: response.data.status
            });
        }
    } catch (error) {
        console.error('Autocomplete API error:', error.message);
        res.status(500).json({
            predictions: [],
            error: error.message
        });
    }
});

// Add place details endpoint
app.get('/api/places/details', async (req, res) => {
    const { placeId } = req.query;

    if (!placeId) {
        return res.status(400).json({ error: 'Place ID is required' });
    }

    try {
        const detailsUrl = 'https://maps.googleapis.com/maps/api/place/details/json';
        
        const params = {
            place_id: placeId,
            fields: 'address_component,geometry',
            key: GOOGLE_GEOCODING_API_KEY
        };

        const response = await axios.get(detailsUrl, { params });

        if (response.data.status === 'OK') {
            const addressComponents = response.data.result.address_components;
            const state = addressComponents.find(
                component => component.types.includes('administrative_area_level_1')
            );

            res.json({
                city: addressComponents.find(
                    component => component.types.includes('locality')
                )?.long_name,
                state: state?.long_name || state?.short_name,
                location: response.data.result.geometry?.location
            });
        } else {
            res.json({ 
                error: response.data.status
            });
        }
    } catch (error) {
        console.error('Place Details API error:', error.message);
        res.status(500).json({
            error: error.message
        });
    }
});

// Start the server
mongoose.connection.once('open', () => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`MongoDB connected: ${mongoose.connection.host}`);
    });
  });