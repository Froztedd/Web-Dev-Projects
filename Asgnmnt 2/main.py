from flask import Flask, request, jsonify
import requests
import os
from dotenv import load_dotenv
import urllib.parse
import logging
from datetime import datetime

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.DEBUG)


# Function to load API keys from environment variables
def load_api_keys():
    load_dotenv()
    tomorrow_api_key = os.getenv('APIKEY')
    geocode_api_key = os.getenv('GEOAPI')
    ipinfo_api_key = os.getenv('IPINFO')

    if not tomorrow_api_key:
        raise ValueError("APIKEY (Tomorrow.io) not found in .env file")
    if not geocode_api_key:
        raise ValueError("GEOAPI (Geocoding API) not found in .env file")
    if not ipinfo_api_key:
        raise ValueError("IPINFO (ipinfo.io) API key not found in .env file")

    return tomorrow_api_key, geocode_api_key, ipinfo_api_key

# Route to fetch location based on IP using ipinfo.io
@app.route('/get_location', methods=['GET'])
def get_location():
    tomorrow_api_key, geocode_api_key, ipinfo_api_key = load_api_keys()
    try:
        # Fetch user's location via IP
        response = requests.get(f"https://ipinfo.io/json?token={ipinfo_api_key}")
        data = response.json()
        loc = data.get('loc', None)

        if loc:
            lat, lon = loc.split(',')
            return jsonify({"lat": lat, "lon": lon})
        else:
            return jsonify({"error": "Could not determine location."}), 500
    except Exception as e:
        logging.exception("Error fetching location data")
        return jsonify({"error": str(e)}), 500

# Function to get latitude and longitude from address
def geocode_address(address, city, state, geocode_api_key):
    full_address = f"{address}, {city}, {state}"
    params = {
        'address': full_address,
        'key': geocode_api_key
    }
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    logging.debug(f"Geocoding Request URL: {url} with params: {params}")  # Log request details
    response = requests.get(url, params=params)

    logging.debug(f"Geocoding Response Status: {response.status_code}")  # Log status code
    logging.debug(f"Geocoding Response Body: {response.text}")  # Log response body

    if response.status_code == 200:
        data = response.json()
        if data['status'] == 'OK' and len(data['results']) > 0:
            location = data['results'][0]['geometry']['location']
            return float(location['lat']), float(location['lng'])
        else:
            raise ValueError(f"Geocoding error: {data['status']}")
    else:
        raise ConnectionError(f"Error: {response.status_code}, {response.text}")


# Function to fetch weather data from Tomorrow.io
def get_weather_data(lat, lon, tomorrow_api_key):
    url = 'https://api.tomorrow.io/v4/timelines'

    fields = [
        'temperature', 'temperatureMin', 'temperatureMax', 'humidity', 'pressureSeaLevel', 
        'windSpeed', 'visibility', 'cloudCover', 'uvIndex', 'weatherCode',
        'precipitationType', 'precipitationProbability', 'windDirection', 'temperatureApparent', 'moonPhase',
        'sunriseTime', 'sunsetTime'
    ]

    params = {
        'apikey': tomorrow_api_key,
        'location': f'{lat},{lon}',
        'fields': ','.join(fields),
        'timesteps': '1d,1h,current',  # Corrected to comma-separated string
        'units': 'imperial',
        'timezone': 'America/Los_Angeles'
    }

    response = requests.get(url, params=params)
    if response.status_code == 200:
        data = response.json()

        # Check if timelines and intervals exist in the response
        if 'data' not in data or 'timelines' not in data['data'] or len(data['data']['timelines']) == 0:
            raise ValueError("No timelines found in API response.")

        if 'intervals' not in data['data']['timelines'][0] or len(data['data']['timelines'][0]['intervals']) == 0:
            raise ValueError("No intervals found in API response.")

        return data
    else:
        logging.error(f"API Error: {response.status_code}, {response.text}")
        raise ConnectionError(f"Error: {response.status_code}, {response.text}")

def process_temperature_range_data(api_data):
    forecast_data = []
    for timeline in api_data['data']['timelines']:
        if timeline['timestep'] == '1d':
            for interval in timeline['intervals'][:15]:  # Limit to 15 days
                values = interval['values']
                
                # Validate and format sunrise and sunset times
                sunrise = values.get('sunriseTime', 'N/A')
                sunset = values.get('sunsetTime', 'N/A')
                try:
                    if sunrise != 'N/A':
                        sunrise = datetime.fromisoformat(sunrise).isoformat()
                except ValueError:
                    sunrise = 'N/A'
                
                try:
                    if sunset != 'N/A':
                        sunset = datetime.fromisoformat(sunset).isoformat()
                except ValueError:
                    sunset = 'N/A'

                forecast_data.append({
                    'date': interval['startTime'].split('T')[0],  # Date in YYYY-MM-DD
                    'weatherCode': values.get('weatherCode', 'Unknown'),
                    'temperatureMax': values.get('temperatureMax', 'N/A'),
                    'temperatureMin': values.get('temperatureMin', 'N/A'),
                    'temperatureApparent': values.get('temperatureApparent', 'N/A'),
                    'windSpeed': values.get('windSpeed', 'N/A'),
                    'windDirection': values.get('windDirection', 'N/A'),
                    'humidity': values.get('humidity', 'N/A'),
                    'pressureSeaLevel': values.get('pressureSeaLevel', 'N/A'),
                    'visibility': values.get('visibility', 'N/A'),
                    'cloudCover': values.get('cloudCover', 'N/A'),
                    'uvIndex': values.get('uvIndex', 'N/A'),
                    'precipitationType': values.get('precipitationType', 'N/A'),
                    'precipitationProbability': values.get('precipitationProbability', 'N/A'),
                    'moonPhase': values.get('moonPhase', 'N/A'),
                    'sunrise': sunrise,
                    'sunset': sunset,
                })
    logging.debug(f'Forecast Data: {forecast_data}')
    return forecast_data

def process_hourly_temperature_data(api_data):
    hourly_data = []
    for timeline in api_data['data']['timelines']:
        if timeline['timestep'] == '1h':
            for interval in timeline['intervals'][:120]:  # Limit to next 5 days (120 hours)
                try:
                    timestamp = datetime.fromisoformat(interval['startTime']).timestamp() * 1000  # Convert to milliseconds
                except ValueError:
                    logging.warning(f"Invalid startTime format: {interval.get('startTime')}")
                    continue  # Skip this interval if the timestamp is invalid
                
                values = interval['values']
                
                # Extracting fields with default values if not present
                temperature = values.get('temperature', 'N/A')
                temperatureApparent = values.get('temperatureApparent', 'N/A')
                wind_speed = values.get('windSpeed', 'N/A')
                wind_direction = values.get('windDirection', 'N/A')
                precipitation_probability = values.get('precipitationProbability', 'N/A')
                precipitation_type = values.get('precipitationType', 'N/A')
                humidity = values.get('humidity', 'N/A')
                pressure_sea_level = values.get('pressureSeaLevel', 'N/A')
                visibility = values.get('visibility', 'N/A')
                cloud_cover = values.get('cloudCover', 'N/A')
                uv_index = values.get('uvIndex', 'N/A')
                moon_phase = values.get('moonPhase', 'N/A')
                
                hourly_data.append([
                    timestamp,
                    temperature,
                    temperatureApparent,
                    wind_speed,
                    wind_direction,
                    precipitation_probability,
                    precipitation_type,
                    humidity,
                    pressure_sea_level,
                    visibility,
                    cloud_cover,
                    uv_index,
                    moon_phase
                ])
    logging.debug(f'Hourly Temperature Data: {hourly_data}')
    return hourly_data

# Route to render the home page
@app.route('/', methods=['GET', 'POST'])
def index():
    return app.send_static_file('index.html')

# Route to handle weather data retrieval using GET
@app.route('/get_weather', methods=['GET'])
def get_weather():
    tomorrow_api_key, geocode_api_key, ipinfo_api_key = load_api_keys()

    auto_detect = request.args.get('auto_detect', 'false').lower() == 'true'

    if auto_detect:
        try:
            response = requests.get(f"https://ipinfo.io/json?token={ipinfo_api_key}")
            data = response.json()
            loc = data.get('loc', None)
            if loc:
                lat, lon = loc.split(',')
            else:
                return jsonify({"error": "Could not determine location."}), 500
        except Exception as e:
            logging.exception("Error fetching user location")
            return jsonify({'error': f"Error fetching user location: {str(e)}"}), 500
    else:
        street = request.args.get('street')
        city = request.args.get('city')
        state = request.args.get('state')

        if not street or not city or not state:
            return jsonify({'error': "All address fields are required."}), 400

        try:
            lat, lon = geocode_address(street, city, state, geocode_api_key)
        except Exception as e:
            logging.exception("Error during geocoding")
            return jsonify({'error': f"Error during geocoding: {str(e)}"}), 500

    try:
        weather_data = get_weather_data(lat, lon, tomorrow_api_key)

        # Process forecast dataAC
        forecast_data = process_temperature_range_data(weather_data)

        # Process hourly temperature data
        hourly_temperature_data = process_hourly_temperature_data(weather_data)

        # Extract current weather data
        current_weather = {}
        for timeline in weather_data['data']['timelines']:
            if timeline['timestep'] == 'current':
                if timeline['intervals']:
                    current_values = timeline['intervals'][0]['values']
                    current_weather = {
                        'latitude': lat,
                        'longitude': lon,
                        'temperature': current_values.get('temperature', 'N/A'),
                        'humidity': current_values.get('humidity', 'N/A'),
                        'windSpeed': current_values.get('windSpeed', 'N/A'),
                        'visibility': current_values.get('visibility', 'N/A'),
                        'pressureSeaLevel': current_values.get('pressureSeaLevel', 'N/A'),
                        'cloudCover': current_values.get('cloudCover', 'N/A'),
                        'uvIndex': current_values.get('uvIndex', 'N/A'),
                        'weatherCode': current_values.get('weatherCode', 'Unknown'),
                        'precipitationIntensity': current_values.get('precipitationIntensity', 'N/A'),
                        'precipitationProbability': current_values.get('precipitationProbability', 'N/A'),
                        'sunriseTime': current_values.get('sunriseTime', 'N/A'),
                        'sunsetTime': current_values.get('sunsetTime', 'N/A'),
                    }
                break  # Assuming only one 'current' timeline

        # Return current weather, forecast, and hourly data
        return jsonify({
            'weather_data': current_weather,
            'forecast_data': forecast_data,
            'hourly_data': hourly_temperature_data
        })
    except Exception as e:
        logging.exception("Error fetching weather data")
        return jsonify({'error': f"Error fetching weather data: {str(e)}"}), 500

# Route to fetch detailed weather data for a specific date
@app.route('/get_detailed_weather', methods=['GET'])
def get_detailed_weather():
    tomorrow_api_key, geocode_api_key, ipinfo_api_key = load_api_keys()

    date = request.args.get('date')
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    if not date or not lat or not lon:
        return jsonify({'error': 'Missing required parameters: date, lat, lon'}), 400

    try:
        # Fetch weather data
        weather_data = get_weather_data(lat, lon, tomorrow_api_key)

        # Extract forecast data
        forecast_data = process_temperature_range_data(weather_data)

        # Find the detailed data for the specified date
        detailed_weather = next((day for day in forecast_data if day['date'] == date), None)

        if not detailed_weather:
            logging.error(f'No weather data found for date: {date}')
            return jsonify({'error': f'No weather data found for date: {date}'}), 404

        logging.debug(f'Detailed Weather Data for {date}: {detailed_weather}')
        return jsonify({'detailed_weather': detailed_weather})
    except Exception as e:
        logging.exception("Error fetching detailed weather data")
        return jsonify({'error': f"Error fetching detailed weather data: {str(e)}"}), 500
    
def handle_request(street, city, state):
   
    try:
        # Load API keys
        tomorrow_api_key, geocode_api_key, ipinfo_api_key = load_api_keys()

        # Geocode the address to get latitude and longitude
        lat, lon = geocode_address(street, city, state, geocode_api_key)

        # Fetch weather data from Tomorrow.io
        weather_data = get_weather_data(lat, lon, tomorrow_api_key)

        # Process forecast data
        forecast_data = process_temperature_range_data(weather_data)

        # Process hourly temperature data
        hourly_data = process_hourly_temperature_data(weather_data)

        # Extract current weather data
        current_weather = {}
        for timeline in weather_data['data']['timelines']:
            if timeline['timestep'] == 'current':
                if timeline['intervals']:
                    current_values = timeline['intervals'][0]['values']
                    current_weather = {
                        'latitude': lat,
                        'longitude': lon,
                        'temperature': current_values.get('temperature', 'N/A'),
                        'humidity': current_values.get('humidity', 'N/A'),
                        'windSpeed': current_values.get('windSpeed', 'N/A'),
                        'visibility': current_values.get('visibility', 'N/A'),
                        'pressureSeaLevel': current_values.get('pressureSeaLevel', 'N/A'),
                        'cloudCover': current_values.get('cloudCover', 'N/A'),
                        'uvIndex': current_values.get('uvIndex', 'N/A'),
                        'weatherCode': current_values.get('weatherCode', 'Unknown'),
                        'precipitationIntensity': current_values.get('precipitationIntensity', 'N/A'),
                        'precipitationProbability': current_values.get('precipitationProbability', 'N/A'),
                        'sunriseTime': current_values.get('sunriseTime', 'N/A'),
                        'sunsetTime': current_values.get('sunsetTime', 'N/A'),
                    }
                break  # Assuming only one 'current' timeline

        # Compile the response
        response = {
            'weather_data': current_weather,
            'forecast_data': forecast_data,
            'hourly_data': hourly_data
        }

        return response

    except Exception as e:
        logging.exception("Error in handle_request")
        raise e

# Example Integration as a Flask Route
@app.route('/handle_request', methods=['GET'])
def handle_request_route():
    """
    Flask route to handle weather data retrieval based on address.

    Expected GET Parameters:
        - street (str): The street address.
        - city (str): The city.
        - state (str): The state.

    Returns:
        JSON response containing weather data or error message.
    """
    # Extract address parameters from the request
    street = request.args.get('street')
    city = request.args.get('city')
    state = request.args.get('state')

    # Validate input
    if not street or not city or not state:
        return jsonify({'error': "All address fields (street, city, state) are required."}), 400

    try:
        # Call the handle_request function with the provided address
        weather_response = handle_request(street, city, state)

        # Return the weather data as JSON
        return jsonify(weather_response)

    except ValueError as ve:
        # Handle known errors (e.g., Geocoding errors)
        logging.error(f"ValueError: {ve}")
        return jsonify({'error': str(ve)}), 400

    except ConnectionError as ce:
        # Handle connection-related errors
        logging.error(f"ConnectionError: {ce}")
        return jsonify({'error': str(ce)}), 502

    except Exception as e:
        # Handle unexpected errors
        logging.exception("Unhandled exception in handle_request_route")
        return jsonify({'error': f"An unexpected error occurred: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
