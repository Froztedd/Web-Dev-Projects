document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('weather-form');
    const weatherCard = document.getElementById('weather-card');
    const forecastCard = document.getElementById('forecast-card');
    const forecastBody = document.getElementById('forecast-body');
    const errorMessage = document.getElementById('error-message');
    const autoDetectCheckbox = document.getElementById('auto-detect');
    const streetField = document.getElementById('street');
    const cityField = document.getElementById('city');
    const stateField = document.getElementById('state');
    const clearButton = document.querySelector('.clear-btn');
    const detailedWeatherHeading = document.getElementById('detailed-weather-heading'); // Select heading from HTML
    const toggleChartButton = document.getElementById('toggle-chart-button');
    const weatherChartSection = document.getElementById('weather-chart-section');

    // Store latitude and longitude globally after fetching weather data
    let currentLat = null;
    let currentLon = null;

    // Clear form fields and hide weather/forecast cards on "Clear"
    clearButton.addEventListener('click', function () {
        streetField.value = '';
        cityField.value = '';
        stateField.value = '';
        autoDetectCheckbox.checked = false;
        streetField.disabled = false;
        cityField.disabled = false;
        stateField.disabled = false;
        streetField.required = true;
        cityField.required = true;
        stateField.required = true;
        weatherCard.style.display = 'none';
        forecastCard.style.display = 'none';
        errorMessage.style.display = 'none';

        // Hide detailed weather section, heading, and chart toggle section
        const detailedCard = document.getElementById('detailed-weather-card');
        if (detailedCard) {
            detailedCard.style.display = 'none';
            detailedCard.innerHTML = ''; // Clear any existing content
        }

        if (detailedWeatherHeading) {
            detailedWeatherHeading.style.display = 'none';
        }

        const weatherChartsToggle = document.getElementById('weather-charts-toggle');
        if (weatherChartsToggle) {
            weatherChartsToggle.style.display = 'none';
        }

        weatherChartSection.style.display = 'none'; // Hide the chart section if open
    });

    // Auto-detect location behavior
    autoDetectCheckbox.addEventListener('change', function () {
        if (autoDetectCheckbox.checked) {
            streetField.disabled = true;
            cityField.disabled = true;
            stateField.disabled = true;
            streetField.required = false;
            cityField.required = false;
            stateField.required = false;
        } else {
            streetField.disabled = false;
            cityField.disabled = false;
            stateField.disabled = false;
            streetField.required = true;
            cityField.required = true;
            stateField.required = true;
        }
    });

    // Form submission behavior
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        const autoDetect = autoDetectCheckbox.checked;

        if (autoDetect) {
            fetchUserLocationAndWeather();
        } else {
            const street = streetField.value;
            const city = cityField.value;
            const state = stateField.value;
            fetchWeatherData(street, city, state);
        }
    });

    // Fetch user's location based on IP and reverse geocode it
    async function fetchUserLocationAndWeather() {
        try {
            const response = await fetch('/get_location', { method: 'GET' });
            const data = await response.json();
            if (data.error) {
                displayError(data.error);
                return;
            }
            const { lat, lon } = data;
            currentLat = lat;
            currentLon = lon;
            const address = await reverseGeocode(lat, lon);
            fetchWeatherByLatLon(lat, lon, address);
        } catch (error) {
            console.error('Error fetching user location and weather:', error);
            displayError('Error fetching location data.');
        }
    }

    // Function to reverse geocode lat/lon to an address
    async function reverseGeocode(lat, lon) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
            const data = await response.json();
            const city = data.address.city || data.address.town || data.address.village || '';
            const state = data.address.state || '';
            return `${city}, ${state}`;
        } catch (error) {
            console.error('Error reverse geocoding:', error);
            return 'Auto-detected Location';
        }
    }

    // Fetch weather data by address
    async function fetchWeatherData(street, city, state) {
        const queryParams = `?street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&auto_detect=false`;
        try {
            const response = await fetch(`/get_weather${queryParams}`, { method: 'GET' });
            const data = await response.json();
            console.log('Weather Data:', data.weather_data);
            console.log('Forecast Data:', data.forecast_data);

            if (data.error) {
                displayError(data.error);
            } else {
                currentLat = data.weather_data.latitude; // Now correctly set
                currentLon = data.weather_data.longitude; // Now correctly set
                const formattedAddress = `${street}, ${city}, ${state}`;
                data.weather_data.location = formattedAddress;
                displayWeatherData(data.weather_data, data.forecast_data);
            }
        } catch (error) {
            console.error('Error fetching weather data:', error);
            displayError('Error fetching weather data.');
        }
    }

    // Fetch weather data by lat/lon
    async function fetchWeatherByLatLon(lat, lon, address) {
        const queryParams = `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&auto_detect=true`;
        try {
            const response = await fetch(`/get_weather${queryParams}`, { method: 'GET' });
            const data = await response.json();
            console.log('Weather Data:', data.weather_data);
            console.log('Forecast Data:', data.forecast_data);

            if (data.error) {
                displayError(data.error);
            } else {
                currentLat = lat;
                currentLon = lon;
                data.weather_data.location = address;
                displayWeatherData(data.weather_data, data.forecast_data);
            }
        } catch (error) {
            console.error('Error fetching weather by lat/lon:', error);
            displayError('Error fetching weather data.');
        }
    }

    // Display weather and forecast data
    function displayWeatherData(weatherData, forecastData) {
        console.log('Displaying weather data:', weatherData);
        console.log('Displaying forecast data:', forecastData);
    
        // Get today's date without time
        const today = new Date();
        today.setHours(0, 0, 0, 0);
    
        // Find today's weather from forecastData
        const todayWeather = forecastData.find(day => {
            const dayDate = new Date(day.date);
            dayDate.setHours(0, 0, 0, 0);
            return dayDate.getTime() === today.getTime();
        });
    
        if (todayWeather) {
            // Populate weatherCard with today's weather
            const address = weatherData.location || "Auto-detected Location";
            const temperature = todayWeather.temperatureMax || "N/A";
            const weatherDescription = mapWeatherCodeToDescription(todayWeather.weatherCode || "Unknown");
            const humidity = todayWeather.humidity || "N/A";
            const pressure = todayWeather.pressureSeaLevel || "N/A";
            const windSpeed = todayWeather.windSpeed || "N/A";
            const visibility = todayWeather.visibility || "N/A";
            const cloudCover = todayWeather.cloudCover || "N/A";
            const uvIndex = todayWeather.uvIndex || "N/A";
    
            document.getElementById('address').textContent = address;
            document.getElementById('temperature-value').textContent = temperature;
            document.getElementById('weather-description').textContent = weatherDescription;
            document.getElementById('humidity').textContent = humidity;
            document.getElementById('pressure').textContent = pressure;
            document.getElementById('wind-speed').textContent = windSpeed;
            document.getElementById('visibility').textContent = visibility;
            document.getElementById('cloud-cover').textContent = cloudCover;
            document.getElementById('uv-index').textContent = uvIndex;
    
            const weatherIcon = document.getElementById('weather-icon');
            weatherIcon.src = getWeatherIcon(todayWeather.weatherCode);
            weatherIcon.alt = weatherDescription;
        } else {
            displayError("Today's weather data not available.");
        }
    
        // Show the weather card
        weatherCard.style.display = 'block';
        errorMessage.style.display = 'none';
    
        // Update the forecast table
        if (forecastData && Array.isArray(forecastData)) {
            populateForecastTable(forecastData);
        } else {
            console.log('No forecast data available.');
            forecastCard.style.display = 'none';
        }
    }
    

    // Populate the forecast table with data (Next 7 days excluding today)
    function populateForecastTable(forecastData) {
        console.log('Populating forecast table with:', forecastData);
    
        // Clear previous forecast rows
        forecastBody.innerHTML = '';
    
        // Get tomorrow's date without time
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
    
        // Filter forecastData to include only the next 6 days excluding today
        const filteredForecast = forecastData.filter(day => {
            const dayDate = new Date(day.date);
            dayDate.setHours(0, 0, 0, 0);
            return dayDate >= tomorrow;
        });
    
        // Limit to the next 6 days
        const limitedForecast = filteredForecast.slice(0, 6);
    
        limitedForecast.forEach((day) => {
            const row = document.createElement('tr');
    
            // Store the date in a data attribute for easy access
            row.setAttribute('data-date', day.date);
    
            const dateCell = document.createElement('td');
            const date = new Date(day.date);
            const formattedDate = `${date.toLocaleDateString('en-US', { weekday: 'long' })}, ${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getFullYear()}`;
            dateCell.textContent = formattedDate;
            row.appendChild(dateCell);
    
            const statusCell = document.createElement('td');
            const statusWrapper = document.createElement('div');
            statusWrapper.classList.add('status-wrapper');
    
            const icon = document.createElement('img');
            icon.src = getWeatherIcon(day.weatherCode); // Use weatherCode for icon
            icon.alt = mapWeatherCodeToDescription(day.weatherCode); // Use weatherCode for alt text
    
            const weatherDescription = document.createElement('span');
            weatherDescription.textContent = mapWeatherCodeToDescription(day.weatherCode); // Use weatherCode for description
    
            statusWrapper.appendChild(icon);
            statusWrapper.appendChild(weatherDescription);
            statusCell.appendChild(statusWrapper);
            row.appendChild(statusCell);
    
            const tempHighCell = document.createElement('td');
            tempHighCell.textContent = day.temperatureMax !== 'N/A' ? `${day.temperatureMax}°F` : 'N/A';
            row.appendChild(tempHighCell);
    
            const tempLowCell = document.createElement('td');
            tempLowCell.textContent = day.temperatureMin !== 'N/A' ? `${day.temperatureMin}°F` : 'N/A';
            row.appendChild(tempLowCell);
    
            const windSpeedCell = document.createElement('td');
            windSpeedCell.textContent = day.windSpeed !== 'N/A' ? `${day.windSpeed} mph` : 'N/A';
            row.appendChild(windSpeedCell);
    
            // Add click event to each row to fetch detailed weather
            row.addEventListener('click', () => {
                const selectedDate = row.getAttribute('data-date');
                fetchDetailedWeather(selectedDate, currentLat, currentLon);
            });
    
            forecastBody.appendChild(row);
        });
    
        // Show the forecast card if there are rows to display
        if (limitedForecast.length > 0) {
            forecastCard.style.display = 'block';
        } else {
            forecastCard.style.display = 'none';
        }
    }
    
    
    

    // Fetch detailed weather for the selected date using the new API endpoint
    async function fetchDetailedWeather(date, lat, lon) {
        try {
            console.log(`Fetching detailed weather for Date: ${date}, Lat: ${lat}, Lon: ${lon}`);
            const queryParams = `?date=${encodeURIComponent(date)}&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
            const url = `/get_detailed_weather${queryParams}`;
            console.log(`Fetching URL: ${url}`);
            const response = await fetch(url, { method: 'GET' });
            
            console.log(`Response Status: ${response.status}`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Fetch failed: ${errorText}`);
                displayError(`Server Error: ${response.statusText}`);
                return;
            }

            const data = await response.json();
            console.log('Received Data:', data);

            if (data.error) {
                console.error(`Server Error: ${data.error}`);
                displayError(data.error);
            } else {
                displayDetailedWeather(data.detailed_weather, date);
            }
        } catch (error) {
            console.error('Fetch Exception:', error);
            displayError('Error fetching detailed weather data.');
        }
    }

    // Display detailed weather information for a selected forecast day
    function displayDetailedWeather(weatherData, date) {
        // Hide the other cards and tables
        weatherCard.style.display = 'none';
        forecastCard.style.display = 'none';

        // Select the existing detailed-weather-card div
        const detailedCard = document.getElementById('detailed-weather-card');

        // Show "Daily Weather Details" heading
        if (detailedWeatherHeading) {
            detailedWeatherHeading.style.display = 'block';
        }

        // Show the "Weather Charts" heading and arrow button
        const weatherChartsToggle = document.getElementById('weather-charts-toggle');
        if (weatherChartsToggle) {
            weatherChartsToggle.style.display = 'block';
        }

        // Hide the weather chart by default
        weatherChartSection.style.display = 'none';
        toggleChartButton.textContent = '▼'; // Downward arrow to indicate expandable chart

        // Validate weatherData
        if (!weatherData) {
            displayError('No detailed weather data available.');
            return;
        }

        // Format the date for display
        const formattedDate = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
        });

        // Populate the existing detailed-weather-card with the weather details
        detailedCard.innerHTML = `
            <div class="detailed-weather-info">
                <p class="weather-date">${formattedDate}</p>
                <p class="weather-condition">${mapWeatherCodeToDescription(weatherData.weatherCode)}</p>
                <img src="${getWeatherIcon(weatherData.weatherCode)}" alt="${mapWeatherCodeToDescription(weatherData.weatherCode)}" class="weather-icon-large" />
                <p class="temperature-display">${weatherData.temperatureMax !== 'N/A' ? `${weatherData.temperatureMax}°F` : 'N/A'}/${weatherData.temperatureMin !== 'N/A' ? `${weatherData.temperatureMin}°F` : 'N/A'}</p>
                <div class="detailed-stats">
                    <p><strong>Precipitation:</strong> ${weatherData.precipitationIntensity !== 'N/A' ? weatherData.precipitationIntensity : 'N/A'} in</p>
                    <p><strong>Chance of Rain:</strong> ${weatherData.precipitationProbability !== 'N/A' ? weatherData.precipitationProbability : 'N/A'}%</p>
                    <p><strong>Wind Speed:</strong> ${weatherData.windSpeed !== 'N/A' ? weatherData.windSpeed : 'N/A'} mph</p>
                    <p><strong>Humidity:</strong> ${weatherData.humidity !== 'N/A' ? weatherData.humidity : 'N/A'}%</p>
                    <p><strong>Visibility:</strong> ${weatherData.visibility !== 'N/A' ? weatherData.visibility : 'N/A'} miles</p>
                    <p><strong>Sunrise/Sunset:</strong> ${weatherData.sunrise !== 'N/A' ? formatTime(weatherData.sunrise) : 'N/A'}/${weatherData.sunset !== 'N/A' ? formatTime(weatherData.sunset) : 'N/A'}</p>
                </div>
            </div>
        `;
        // Show the detailed-weather-card
        detailedCard.style.display = 'block';

        // Show the button to toggle the weather chart
        toggleChartButton.style.display = 'block';
    }

    // Event listener for the chart toggle button
    toggleChartButton.addEventListener('click', function () {
        if (weatherChartSection.style.display === 'none') {
            // Show the chart section
            weatherChartSection.style.display = 'block';
            toggleChartButton.textContent = '▲'; // Change to upward arrow
            displayTempRange();
            displayHourlyWeatherChart(); // Call the function to display the chart
        } else {
            // Hide the chart section
            weatherChartSection.style.display = 'none';
            toggleChartButton.textContent = '▼'; // Change back to downward arrow
        }
    });

    // Format time from ISO string to readable format
    function formatTime(isoString) {
        if (isoString === 'N/A') return 'N/A';
        const date = new Date(isoString);
        if (isNaN(date)) return 'N/A';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Display an error message
    function displayError(message) {
        const errorParagraph = errorMessage.querySelector('p');
        errorParagraph.textContent = message;
        errorMessage.style.display = 'block';
        weatherCard.style.display = 'none';
        forecastCard.style.display = 'none';

        // Remove any existing detailed weather card content
        const detailedCard = document.getElementById('detailed-weather-card');
        if (detailedCard) {
            detailedCard.style.display = 'none';
            detailedCard.innerHTML = '';
        }

        // Hide "Daily Weather Details" heading if it exists
        if (detailedWeatherHeading) {
            detailedWeatherHeading.style.display = 'none';
        }

        // Hide the chart toggle and section
        const weatherChartsToggle = document.getElementById('weather-charts-toggle');
        if (weatherChartsToggle) {
            weatherChartsToggle.style.display = 'none';
        }
        weatherChartSection.style.display = 'none';
    }

    // Function to get the weather icon based on the weather code
    function getWeatherIcon(code) {
        const weatherIcons = {
            "1000": "static/Images/Weather Symbols for Weather Codes/clear_day.svg", // Clear, Sunny
            "1001": "static/Images/Weather Symbols for Weather Codes/cloudy.svg", // Cloudy
            "1100": "static/Images/Weather Symbols for Weather Codes/mostly_clear_day.svg", // Mostly Clear
            "1101": "static/Images/Weather Symbols for Weather Codes/mostly_clear_day.svg", // Partly Cloudy
            "1102": "static/Images/Weather Symbols for Weather Codes/mostly_cloudy.svg", // Mostly Cloudy
            "2000": "static/Images/Weather Symbols for Weather Codes/fog.svg", // Fog
            "2100": "static/Images/Weather Symbols for Weather Codes/fog_light.svg", // Light Fog
            "4000": "static/Images/Weather Symbols for Weather Codes/drizzle.svg", // Drizzle
            "4001": "static/Images/Weather Symbols for Weather Codes/rain.svg", // Rain
            "4200": "static/Images/Weather Symbols for Weather Codes/rain_light.svg", // Light Rain
            "4201": "static/Images/Weather Symbols for Weather Codes/rain_heavy.svg", // Heavy Rain
            "5000": "static/Images/Weather Symbols for Weather Codes/snow.svg", // Snow
            "5001": "static/Images/Weather Symbols for Weather Codes/flurries.svg", // Flurries
            "5100": "static/Images/Weather Symbols for Weather Codes/snow_light.svg", // Light Snow
            "5101": "static/Images/Weather Symbols for Weather Codes/snow_heavy.svg", // Heavy Snow
            "6000": "static/Images/Weather Symbols for Weather Codes/freezing_drizzle.svg", // Freezing Drizzle
            "6001": "static/Images/Weather Symbols for Weather Codes/freezing_rain.svg", // Freezing Rain
            "6200": "static/Images/Weather Symbols for Weather Codes/freezing_rain_light.svg", // Light Freezing Rain
            "6201": "static/Images/Weather Symbols for Weather Codes/freezing_rain_heavy.svg", // Heavy Freezing Rain
            "7000": "static/Images/Weather Symbols for Weather Codes/ice_pellets.svg", // Ice Pellets
            "7101": "static/Images/Weather Symbols for Weather Codes/ice_pellets_heavy.svg", // Heavy Ice Pellets
            "7102": "static/Images/Weather Symbols for Weather Codes/ice_pellets_light.svg", // Light Ice Pellets
            "8000": "static/Images/Weather Symbols for Weather Codes/tstorm.svg"  // Thunderstorm
        };
          
        return weatherIcons[code] || "static/Images/default-weather.png";
    }

    // Function to map weather code to description
    function mapWeatherCodeToDescription(code) {
        const weatherCodeDescriptions = {
            "1000": "Clear, Sunny",
            "1100": "Mostly Clear",
            "1101": "Partly Cloudy",
            "1102": "Mostly Cloudy",
            "1001": "Cloudy",
            "2000": "Fog",
            "2100": "Light Fog",
            "4000": "Drizzle",
            "4001": "Rain",
            "4200": "Light Rain",
            "4201": "Heavy Rain",
            "5000": "Snow",
            "5001": "Flurries",
            "5100": "Light Snow",
            "5101": "Heavy Snow",
            "6000": "Freezing Drizzle",
            "6001": "Freezing Rain",
            "6200": "Light Freezing Rain",
            "6201": "Heavy Freezing Rain",
            "7000": "Ice Pellets",
            "7101": "Heavy Ice Pellets",
            "7102": "Light Ice Pellets",
            "8000": "Thunderstorm"
        };
        return weatherCodeDescriptions[code] || "Unknown";
    }



    async function displayHourlyWeatherChart() {
    try {
        // Fetch weather data from the backend
        const response = await fetch('/get_weather?auto_detect=true');
        const data = await response.json();

        // Check for any error in the returned data
        if (data.error) {
            throw new Error(data.error);
        }

        const hourlyData = data.hourly_data;

        // Log the hourly data for debugging
        console.debug('Hourly Data:', hourlyData);

        // Process data for hourly weather chart
        const hourlyTemperatureData = hourlyData.map(entry => ({
            x: entry[0], // timestamp in milliseconds
            y: entry[1]  // temperature
        }));

        const humidityData = hourlyData.map(entry => ({
            x: entry[0], // timestamp in milliseconds
            y: entry[7]  // humidity
        }));

        const airPressureData = hourlyData.map(entry => ({
            x: entry[0], // timestamp in milliseconds
            y: entry[8]  // air pressure in inHg
        }));

        // Prepare WindBarb data with speed converted to m/s and filter out invalid entries
        const windBarbData = hourlyData.map(entry => {
            const speedMph = entry[3];
            const direction = entry[4];

            // Validate data
            if (speedMph === 'N/A' || direction === 'N/A' || speedMph === null || direction === null) {
                return null; // Skip invalid data points
            }

            const speedMs = speedMph * 0.44704; // Convert mph to m/s

            return {
                x: entry[0],           // timestamp in milliseconds
                direction: direction,  // wind direction in degrees
                value: speedMs         // wind speed in m/s
            };
        }).filter(entry => entry !== null); // Remove null entries

        // Create hourly weather chart
        Highcharts.chart('hourly-weather-chart', {
            chart: {
                zoomType: 'x',
                width: 850,         // Adjust width to fit within the container
                height: 300,        // Reduced height for more compact appearance
                marginLeft: 50,     // Add margin for left side
                marginRight: 50,    // Add margin for right side
                marginBottom: 70    // Increased bottom margin for wind barbs
            },
            title: {
                text: 'Hourly Weather (For Next 5 Days)',
                align: 'center'
            },
            xAxis: {
                type: 'datetime',
                tickInterval: 6 * 3600 * 1000, // 6-hour intervals
                labels: {
                    format: '{value:%I:%M %p}' // Display in 12-hour format with AM/PM
                },
                plotBands: (function() {
                    const bands = [];
                    const dates = new Set();
                    hourlyData.forEach(entry => {
                        const date = new Date(entry[0]);
                        const dateString = date.toISOString().split('T')[0];
                        if (!dates.has(dateString)) {
                            dates.add(dateString);
                            bands.push({
                                from: Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
                                to: Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + 1),
                                color: 'rgba(255, 255, 255, 0.1)', // Light band for each day
                                label: {
                                    text: date.toLocaleDateString(), // Show date on top
                                    align: 'center',
                                    style: {
                                        fontWeight: 'bold',
                                        color: 'black'
                                    }
                                }
                            });
                        }
                    });
                    return bands;
                })()
            },
            yAxis: [{
                // Primary y-axis for Temperature (°F)
                title: {
                    text: 'Temperature (°F)'
                },
                labels: {
                    format: '{value}°F'
                },
                opposite: false
            }, {
                // Secondary y-axis for Humidity (%)
                title: {
                    text: 'Humidity (%)' // Optional: Remove if you don't want the title
                },
                labels: {
                    enabled: false // Hides the labels on the y-axis
                },
                max: 100,
                min: 0,
                opposite: false
            }, {
                // Tertiary y-axis for Air Pressure (inHg)
                title: {
                    text: 'Air Pressure (inHg)' // Optional: Remove if you don't want the title
                },
                labels: {
                    enabled: false // Hides the labels on the y-axis
                },
                opposite: false
            }],
            tooltip: {
                shared: true,
                xDateFormat: '%A, %b %e, %I:%M %p', // Custom date-time format
                formatter: function () {
                    let tooltipHtml = `<b>${Highcharts.dateFormat('%A, %b %e, %I:%M %p', this.x)}</b><br/>`;

                    this.points.forEach(point => {
                        if (point.series.type === 'line' && point.series.name === 'Temperature') {
                            tooltipHtml += `<span style="color:${point.color}">●</span> Temperature: ${point.y}°F<br/>`;
                        } else if (point.series.type === 'column' && point.series.name === 'Humidity') {
                            tooltipHtml += `<span style="color:${point.color}">●</span> Humidity: ${point.y}%<br/>`;
                        } else if (point.series.type === 'line' && point.series.name === 'Air Pressure') {
                            tooltipHtml += `<span style="color:${point.color}">●</span> Air Pressure: ${point.y} inHg<br/>`;
                        } else if (point.series.type === 'windbarb' && point.series.name === 'Wind') {
                            const speedMph = (point.point.value / 0.44704).toFixed(2); // Convert m/s back to mph
                            tooltipHtml += `<span style="color:${point.color}">●</span> Wind: ${speedMph} mph, ${point.point.direction}°<br/>`;
                        }
                    });

                    return tooltipHtml;
                }
            },
            series: [{
                name: 'Humidity',
                data: humidityData,
                type: 'column',
                color: '#3c7cfd', // Light blue histogram
                yAxis: 1,
                tooltip: {
                    valueSuffix: '%'
                }
            }, {
                name: 'Temperature',
                data: hourlyTemperatureData,
                color: '#FF0000', // Red line
                type: 'line',
                yAxis: 0,
                tooltip: {
                    valueSuffix: '°F'
                }
            }, {
                name: 'Air Pressure',
                data: airPressureData,
                type: 'line',
                dashStyle: 'ShortDot',
                color: '#FFD700', // Yellow dotted line
                yAxis: 2,
                tooltip: {
                    valueSuffix: ' inHg'
                }
            }, {
                name: 'Wind',
                type: 'windbarb',
                data: windBarbData,
                color: '#1f77b4', // Light blue for better visibility
                vectorLength: 20,  // Increased from 15 to 20 for better visibility
                yOffset: 10,       // Offset to position wind barbs below the chart
                tooltip: {
                    valueSuffix: ' m/s',
                    pointFormat: 'Wind: {point.value:.2f} m/s, {point.direction}°'
                }
            }],
            plotOptions: {
                series: {
                    stacking: false, // Not stacking the series
                    marker: {
                        enabled: false // Disable markers for cleaner look
                    }
                }
            },
            gridLineWidth: 1,
            gridLineColor: '#D3D3D3', // Set grid line color
        });

    } catch (error) {
        console.error('Error fetching weather data for charts:', error);
        document.getElementById('weather-chart-section').innerHTML = 
            '<p class="error-message">Error loading weather charts. Please try again later.</p>';
    }
}
    
    async function displayTempRange() {
        try {
            const response = await fetch('/get_weather?auto_detect=true');
            const data = await response.json();
    
            // Check for any error in the returned data
            if (data.error) {
                throw new Error(data.error);
            }
    
            const forecastData = data.forecast_data; // Adjusted to match your data key
            const temperatureData = forecastData.map(entry => ({
                x: new Date(entry.date).getTime(), // Convert date to timestamp
                low: entry.temperatureMin,          // Minimum temperature
                high: entry.temperatureMax          // Maximum temperature
            }));
    
            // Create the Highcharts arearange chart
            Highcharts.chart('temperature-range-chart', {
                chart: {
                    type: 'arearange',
                    width: 850,           // Adjust width to fit within the container
                    height: 300,          // Reduced height for more compact appearance
                    marginLeft: 50,       // Add margin for left side
                    marginRight: 50,      // Add margin for right side
                    scrollablePlotArea: {
                        minWidth: 600,
                        scrollPositionX: 1
                    }
                },
                title: {
                    text: 'Temperature Ranges (Min, Max)',
                    align: 'center'
                },
                xAxis: {
                    type: 'datetime',
                    accessibility: {
                        rangeDescription: 'Range: Displayed days.'
                    }
                },
                tooltip: {
                    crosshairs: true,
                    shared: true,
                    valueSuffix: '°F',
                    xDateFormat: '%A, %b %e' // Display date in tooltip
                },
                legend: {
                    enabled: false
                },
                series: [{
                    name: 'Temperatures',
                    data: temperatureData.map(entry => [entry.x, entry.low, entry.high]), // Format as [x, low, high]
                    color: {
                        linearGradient: {
                            x1: 0,
                            x2: 0,
                            y1: 0,
                            y2: 1
                        },
                        stops: [
                            [0, '#ff8d14'], // Red for high
                            [1, '#1491ff']  // Blue for low
                        ]
                    }
                }]
            });
    
        } catch (error) {
            console.error('Error fetching weather data for charts:', error);
            document.getElementById('weather-chart-section').innerHTML = 
                '<p class="error-message">Error loading weather charts. Please try again later.</p>';
        }
    }
    

// Add event listener for the toggle chart button
document.addEventListener('DOMContentLoaded', function () {
    const toggleChartButton = document.getElementById('toggle-chart-button');
    const weatherChartSection = document.getElementById('weather-chart-section');
    const arrowImage = document.getElementById('arrow-image');

    const arrowDownSrc = 'images/arrow-down.png';
    const arrowUpSrc = 'images/arrow-up.png';

    if (toggleChartButton && weatherChartSection && arrowImage) {
        toggleChartButton.addEventListener('click', function () {
            if (weatherChartSection.style.display === 'none' || weatherChartSection.style.display === '') {
                // Show the chart section
                weatherChartSection.style.display = 'block';

                // Swap the arrow to point up
                arrowImage.src = arrowUpSrc;

                // Display temperature min/max chart first
                displayTempRange(() => {
                    // After temp range chart is displayed, display hourly chart
                    displayHourlyWeatherChart(() => {
                        // After both charts are displayed, scroll into view
                        weatherChartSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                });
            } else {
                // Hide the chart section
                weatherChartSection.style.display = 'none';

                // Swap the arrow to point down
                arrowImage.src = arrowDownSrc;
            }
        });
    }
});

});
