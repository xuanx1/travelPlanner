// Main Application JavaScript with OpenStreetMap (Leaflet) Integration

class TSPVisualizer {
    constructor() {
        this.map = null;
        this.points = [];
        this.markers = [];
        this.pathPolylines = [];
        this.bestPathPolyline = null;
        this.algorithms = new TSPAlgorithms();
        this.isRunning = false;
        this.startTime = null;
        this.currentAlgorithm = null;
        this.selectedAlgorithm = null;
        this.tileLayer = null;
        this.milestones = [];
        this.placeNames = new Map(); // Map of marker index to place name
        this.searchTimeout = null; // For debouncing search
        this.algorithmsUsed = []; // Track all algorithms used in sequence
        
        this.loadMilestones();
        this.initializeEventListeners();
        this.algorithms.setUpdateCallback(this.onAlgorithmUpdate.bind(this));
    }

    initializeEventListeners() {
        // Point controls
        document.getElementById('clearPoints').addEventListener('click', () => {
            this.clearAllPoints();
        });

        // Algorithm buttons
        document.querySelectorAll('.algorithm-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectAlgorithm(e.target.dataset.algorithm);
                document.querySelectorAll('.algorithm-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Execution controls
        document.getElementById('runAlgorithm').addEventListener('click', () => {
            this.runAlgorithm();
        });

        document.getElementById('pauseAlgorithm').addEventListener('click', () => {
            this.pauseAlgorithm();
        });

        document.getElementById('stopAlgorithm').addEventListener('click', () => {
            this.stopAlgorithm();
        });

        // Visualization options
        document.getElementById('showBestPath').addEventListener('change', (e) => {
            this.updatePathVisibility();
        });

        document.getElementById('showEvaluatedPaths').addEventListener('change', (e) => {
            this.updatePathVisibility();
        });

        // Place search - real-time as user types
        document.getElementById('placeSearch').addEventListener('input', (e) => {
            this.searchPlaceRealtime(e.target.value);
        });

        // Clear search results when clicking outside
        document.addEventListener('click', (e) => {
            const searchInput = document.getElementById('placeSearch');
            const searchResults = document.getElementById('searchResults');
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.remove('active');
            }
        });

        // Save milestone
        document.getElementById('saveMilestone').addEventListener('click', () => {
            this.saveMilestone();
        });
    }

    resetAlgorithmHistory() {
        this.algorithmsUsed = [];
    }

    initMap() {
        // Initialize Leaflet map with OpenStreetMap tiles
        this.map = L.map('map', {
            center: [37.7749, -122.4194], // San Francisco
            zoom: 10,
            zoomControl: true
        });

        // Add OpenStreetMap tile layer
        this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add click listener to place points
        this.map.on('click', (event) => {
            this.addPoint(event.latlng.lat, event.latlng.lng);
        });
    }

    async addPoint(lat, lng, placeName = null) {
        const point = { lat, lng };
        this.points.push(point);

        // Create custom icon
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div class="marker-pin"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Create marker
        const marker = L.marker([lat, lng], {
            icon: customIcon,
            draggable: true
        }).addTo(this.map);

        const markerIndex = this.markers.length;
        
        // Store place name if provided, otherwise reverse geocode
        if (placeName) {
            this.placeNames.set(markerIndex, placeName);
            marker.bindPopup(placeName);
        } else {
            // Reverse geocode to get place name from coordinates
            this.reverseGeocode(lat, lng, markerIndex, marker);
        }

        // Add drag listener
        marker.on('dragend', (event) => {
            const index = this.markers.indexOf(marker);
            const newPos = event.target.getLatLng();
            this.points[index] = {
                lat: newPos.lat,
                lng: newPos.lng
            };
            // Clear place name and reverse geocode new location
            this.placeNames.delete(index);
            this.reverseGeocode(newPos.lat, newPos.lng, index, marker);
            this.algorithms.setPoints(this.points);
            this.clearPaths();
            this.updateStats();
        });

        // Add right-click to delete
        marker.on('contextmenu', () => {
            this.removePoint(marker);
        });

        this.markers.push(marker);
        this.algorithms.setPoints(this.points);
        this.updateStats();
        
        // Auto-update milestone name whenever points change
        this.updateMilestoneName();
    }

    removePoint(marker) {
        const index = this.markers.indexOf(marker);
        if (index > -1) {
            this.map.removeLayer(marker);
            this.markers.splice(index, 1);
            this.points.splice(index, 1);
            this.placeNames.delete(index);
            
            // Re-index place names
            const newPlaceNames = new Map();
            this.placeNames.forEach((name, idx) => {
                if (idx > index) {
                    newPlaceNames.set(idx - 1, name);
                } else if (idx < index) {
                    newPlaceNames.set(idx, name);
                }
            });
            this.placeNames = newPlaceNames;
            
            this.algorithms.setPoints(this.points);
            this.clearPaths();
            this.updateStats();
            
            // Auto-update milestone name after removal
            this.updateMilestoneName();
        }
    }

    clearAllPoints() {
        // Remove all markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        this.points = [];
        this.placeNames.clear();
        this.algorithmsUsed = [];
        
        // Clear paths
        this.clearPaths();
        
        // Update algorithms and stats
        this.algorithms.setPoints(this.points);
        this.updateStats();
        this.updateExecutionControls();
        
        // Clear milestone name
        this.updateMilestoneName();
    }

    clearPaths() {
        // Clear all polylines
        this.pathPolylines.forEach(polyline => this.map.removeLayer(polyline));
        this.pathPolylines = [];
        
        if (this.bestPathPolyline) {
            this.map.removeLayer(this.bestPathPolyline);
            this.bestPathPolyline = null;
        }
    }

    selectAlgorithm(algorithm) {
        this.selectedAlgorithm = algorithm;
        this.updateExecutionControls();
    }

    async runAlgorithm() {
        if (!this.selectedAlgorithm || this.points.length < 3) return;

        this.isRunning = true;
        this.startTime = Date.now();
        this.currentAlgorithm = this.selectedAlgorithm;
        
        // Track algorithm usage
        const algorithmNames = {
            'nearestNeighbor': 'Nearest Neighbor',
            'convexHull': 'Convex Hull',
            'genetic': 'Genetic Algorithm',
            'twoOpt': '2-Opt',
            'simulatedAnnealing': 'Simulated Annealing'
        };
        this.algorithmsUsed.push(algorithmNames[this.selectedAlgorithm] || this.selectedAlgorithm);
        
        // Clear existing path visuals
        this.clearPaths();
        
        // For construction algorithms, reset the best path
        // For improvement algorithms (2-Opt), keep the existing best path
        const constructionAlgorithms = ['nearestNeighbor', 'convexHull', 'genetic', 'simulatedAnnealing'];
        if (constructionAlgorithms.includes(this.selectedAlgorithm)) {
            this.algorithms.bestPath = null;
            this.algorithms.bestDistance = Infinity;
        }
        // For 2-Opt, it will use the existing bestPath if available
        
        this.updateExecutionControls();
        this.updateStats();

        // Start timer
        this.startTimer();

        try {
            switch (this.selectedAlgorithm) {
                case 'nearestNeighbor':
                    await this.algorithms.nearestNeighbor();
                    break;
                case 'convexHull':
                    await this.algorithms.convexHull();
                    break;
                case 'genetic':
                    await this.algorithms.genetic();
                    break;
                case 'twoOpt':
                    await this.algorithms.twoOpt();
                    break;
                case 'simulatedAnnealing':
                    await this.algorithms.simulatedAnnealing();
                    break;
                default:
                    console.error('Unknown algorithm:', this.selectedAlgorithm);
            }
        } catch (error) {
            console.error('Algorithm error:', error);
        }

        this.isRunning = false;
        this.updateExecutionControls();
    }

    pauseAlgorithm() {
        if (this.algorithms.isPaused) {
            this.algorithms.resume();
        } else {
            this.algorithms.pause();
        }
        this.updateExecutionControls();
    }

    stopAlgorithm() {
        this.algorithms.stop();
        this.isRunning = false;
        this.updateExecutionControls();
    }

    onAlgorithmUpdate(data) {
        // Update current path
        if (data.currentPath && document.getElementById('showEvaluatedPaths').checked) {
            this.drawPath(data.currentPath, '#ffc107', 2);
        }

        // Update best path
        if (data.bestPath && document.getElementById('showBestPath').checked) {
            if (this.bestPathPolyline) {
                this.map.removeLayer(this.bestPathPolyline);
            }
            this.bestPathPolyline = this.drawPath(data.bestPath, '#28a745', 4);
        }

        // Update statistics
        document.getElementById('currentBest').textContent = 
            (data.bestDistance !== Infinity ? data.bestDistance.toFixed(2) : '-') + ' KM';
        document.getElementById('evaluating').textContent = 
            (data.currentDistance ? data.currentDistance.toFixed(2) : '-') + ' KM';
        document.getElementById('currentAlgorithm').textContent = data.algorithm || 'None';
    }

    drawPath(points, color, strokeWeight) {
        if (points.length < 2) return null;

        // Create path including return to start
        const pathCoordinates = points.map(p => [p.lat, p.lng]);
        if (points.length > 2) {
            pathCoordinates.push([points[0].lat, points[0].lng]); // Close the loop
        }

        const polyline = L.polyline(pathCoordinates, {
            color: color,
            weight: strokeWeight,
            opacity: 1.0
        }).addTo(this.map);
        
        if (color !== '#28a745') { // Don't add non-best paths to cleanup array
            this.pathPolylines.push(polyline);
        }

        return polyline;
    }

    updatePathVisibility() {
        const showBest = document.getElementById('showBestPath').checked;
        const showEvaluated = document.getElementById('showEvaluatedPaths').checked;

        if (this.bestPathPolyline) {
            if (showBest) {
                this.bestPathPolyline.addTo(this.map);
            } else {
                this.map.removeLayer(this.bestPathPolyline);
            }
        }

        this.pathPolylines.forEach(polyline => {
            if (showEvaluated) {
                polyline.addTo(this.map);
            } else {
                this.map.removeLayer(polyline);
            }
        });
    }

    updateStats() {
        document.getElementById('pointCount').textContent = this.points.length;
        
        // Calculate possible paths (factorial of n-1 for TSP)
        const n = this.points.length;
        let possiblePaths = 0;
        if (n > 2) {
            if (n <= 10) {
                possiblePaths = this.factorial(n - 1);
            } else {
                possiblePaths = '∞';
            }
        }
        document.getElementById('possiblePaths').textContent = 
            typeof possiblePaths === 'number' ? possiblePaths.toLocaleString() : possiblePaths;
    }

    factorial(n) {
        if (n <= 1) return 1;
        return n * this.factorial(n - 1);
    }

    updateExecutionControls() {
        const runBtn = document.getElementById('runAlgorithm');
        const pauseBtn = document.getElementById('pauseAlgorithm');
        const stopBtn = document.getElementById('stopAlgorithm');

        const canRun = this.selectedAlgorithm && this.points.length >= 3 && !this.isRunning;
        const isRunning = this.isRunning;
        const isPaused = this.algorithms.isPaused;

        runBtn.disabled = !canRun;
        pauseBtn.disabled = !isRunning;
        stopBtn.disabled = !isRunning;

        pauseBtn.textContent = isPaused ? 'RESUME' : 'PAUSE';
    }

    startTimer() {
        const updateTimer = () => {
            if (this.isRunning && this.startTime) {
                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                document.getElementById('runningFor').textContent = elapsed + ' S';
                setTimeout(updateTimer, 1000);
            }
        };
        updateTimer();
    }

    async reverseGeocode(lat, lng, markerIndex, marker) {
        try {
            // Use Nominatim reverse geocoding API
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            
            if (data && data.display_name) {
                // Store the place name
                this.placeNames.set(markerIndex, data.display_name);
                marker.bindPopup(data.display_name);
                
                // Update milestone name after getting place name
                this.updateMilestoneName();
            } else {
                // Fallback to coordinates
                const coordName = `Point at (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
                this.placeNames.set(markerIndex, coordName);
                marker.bindPopup(coordName);
                this.updateMilestoneName();
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            // Fallback to coordinates
            const coordName = `Point at (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            this.placeNames.set(markerIndex, coordName);
            marker.bindPopup(coordName);
            this.updateMilestoneName();
        }
    }

    updateMilestoneName() {
        if (this.points.length === 0) {
            document.getElementById('milestoneName').value = 'Empty Route';
            return;
        }

        // Get all place names
        const placeNames = [];
        this.placeNames.forEach((name) => {
            placeNames.push(name);
        });

        if (placeNames.length === 0) {
            // No named places, use generic name
            document.getElementById('milestoneName').value = `${this.points.length} Points Route`;
            return;
        }

        // Parse place names to extract cities, regions, countries
        const locations = placeNames.map(name => {
            const parts = name.split(',').map(p => p.trim());
            return {
                full: name,
                city: parts[0] || '',
                region: parts[1] || '',
                country: parts[parts.length - 1] || ''
            };
        });

        // Count unique countries
        const countries = [...new Set(locations.map(l => l.country).filter(c => c))];
        const cities = [...new Set(locations.map(l => l.city).filter(c => c))];
        
        let suggestedName = '';

        if (countries.length === 1) {
            // Single country - use country name
            if (cities.length <= 3) {
                // Few cities - list them
                suggestedName = `${cities.join(' - ')} Tour`;
            } else {
                // Many cities - use country
                suggestedName = `${countries[0]} Tour (${cities.length} cities)`;
            }
        } else if (countries.length <= 3) {
            // Few countries - list them
            suggestedName = `${countries.join(' - ')} Route`;
        } else {
            // Many countries - detect continent or use generic
            const europeanCountries = ['France', 'Germany', 'Italy', 'Spain', 'UK', 'United Kingdom', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Portugal', 'Greece', 'Poland', 'Czech Republic', 'Hungary', 'Sweden', 'Norway', 'Denmark', 'Finland'];
            const asianCountries = ['China', 'Japan', 'South Korea', 'Thailand', 'Vietnam', 'Singapore', 'Malaysia', 'Indonesia', 'India', 'Philippines'];
            const americanCountries = ['USA', 'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru'];
            
            const euroCount = countries.filter(c => europeanCountries.some(ec => c.includes(ec))).length;
            const asiaCount = countries.filter(c => asianCountries.some(ac => c.includes(ac))).length;
            const americaCount = countries.filter(c => americanCountries.some(ac => c.includes(ac))).length;
            
            if (euroCount >= countries.length * 0.6) {
                suggestedName = `European Tour (${countries.length} countries)`;
            } else if (asiaCount >= countries.length * 0.6) {
                suggestedName = `Asian Tour (${countries.length} countries)`;
            } else if (americaCount >= countries.length * 0.6) {
                suggestedName = `Americas Tour (${countries.length} countries)`;
            } else {
                suggestedName = `World Tour (${countries.length} countries)`;
            }
        }

        // Add date for uniqueness
        const date = new Date();
        const dateStr = `${date.getFullYear()}`;
        suggestedName = `${suggestedName} ${dateStr}`;

        document.getElementById('milestoneName').value = suggestedName;
    }

    searchPlaceRealtime(query) {
        const searchResults = document.getElementById('searchResults');
        
        // Clear existing timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // If query is empty, hide results
        if (!query || query.trim().length < 2) {
            searchResults.classList.remove('active');
            return;
        }

        // Show loading state
        searchResults.innerHTML = '<div class="search-result-item">Searching...</div>';
        searchResults.classList.add('active');

        // Debounce the search - wait 300ms after user stops typing
        this.searchTimeout = setTimeout(async () => {
            try {
                // Use Nominatim API for geocoding
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=5`
                );
                const results = await response.json();

                if (results.length === 0) {
                    searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
                    return;
                }

                searchResults.innerHTML = '';
                results.forEach(result => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML = `
                        <span class="place-name">${result.name || result.display_name.split(',')[0]}</span>
                        <span class="place-address">${result.display_name}</span>
                    `;
                    item.addEventListener('click', async () => {
                        const lat = parseFloat(result.lat);
                        const lng = parseFloat(result.lon);
                        await this.addPoint(lat, lng, result.display_name);
                        this.map.setView([lat, lng], 13);
                        searchResults.classList.remove('active');
                        document.getElementById('placeSearch').value = '';
                    });
                    searchResults.appendChild(item);
                });
            } catch (error) {
                console.error('Search error:', error);
                searchResults.innerHTML = '<div class="search-result-item">Error searching. Please try again.</div>';
            }
        }, 300); // 300ms debounce delay
    }

    saveMilestone() {
        const name = document.getElementById('milestoneName').value.trim();
        if (!name) {
            alert('Please enter a milestone name');
            return;
        }

        if (!this.algorithms.bestPath || this.algorithms.bestDistance === Infinity) {
            alert('Please run an algorithm first to get a route');
            return;
        }

        // Create milestone object with coordinates and full algorithm history
        const milestone = {
            id: Date.now(),
            name: name,
            date: new Date().toISOString(),
            distance: this.algorithms.bestDistance,
            algorithms: [...this.algorithmsUsed], // All algorithms used in sequence
            pointCount: this.points.length,
            points: [...this.points],
            path: [...this.algorithms.bestPath],
            placeNames: {},
            coordinates: [] // Store coordinates with names
        };

        // Save place names and coordinates
        this.points.forEach((point, index) => {
            const placeName = this.placeNames.get(index);
            if (placeName) {
                milestone.placeNames[index] = placeName;
            }
            milestone.coordinates.push({
                index: index,
                lat: point.lat.toFixed(6),
                lng: point.lng.toFixed(6),
                name: placeName || `Point ${index + 1}`
            });
        });

        // Add to milestones array
        this.milestones.push(milestone);
        this.saveMilestonesToStorage();
        this.renderMilestones();

        // Clear input
        document.getElementById('milestoneName').value = '';
    }

    loadMilestones() {
        const stored = localStorage.getItem('tsp_milestones');
        if (stored) {
            try {
                this.milestones = JSON.parse(stored);
            } catch (e) {
                console.error('Error loading milestones:', e);
                this.milestones = [];
            }
        }
    }

    saveMilestonesToStorage() {
        localStorage.setItem('tsp_milestones', JSON.stringify(this.milestones));
    }

    renderMilestones() {
        const container = document.getElementById('milestonesList');
        
        if (this.milestones.length === 0) {
            container.innerHTML = '<p class="no-milestones">No milestones saved yet. Complete a route and save it!</p>';
            return;
        }

        // Sort by distance (best first)
        const sorted = [...this.milestones].sort((a, b) => a.distance - b.distance);

        container.innerHTML = sorted.map((milestone, index) => {
            const date = new Date(milestone.date);
            const isBest = index === 0;
            
            // Handle both old format (single algorithm) and new format (multiple algorithms)
            const algorithmsDisplay = milestone.algorithms 
                ? milestone.algorithms.join(' → ') 
                : (milestone.algorithm || 'Unknown');
            
            // Build coordinates list with names
            const coordinatesList = (milestone.coordinates || []).map(coord => 
                `${coord.name}: (${coord.lat}, ${coord.lng})`
            ).join('<br>');

            return `
                <div class="milestone-card ${isBest ? 'best-milestone' : ''}">
                    <div class="milestone-header">
                        <span class="milestone-name">${isBest ? '🏆 ' : ''}${milestone.name}</span>
                        <div class="milestone-actions">
                            <button class="milestone-action-btn" onclick="tspVisualizer.loadMilestone(${milestone.id})">Load</button>
                            <button class="milestone-action-btn delete" onclick="tspVisualizer.deleteMilestone(${milestone.id})">Delete</button>
                        </div>
                    </div>
                    <div class="milestone-info">
                        <strong>Distance:</strong> ${milestone.distance.toFixed(2)} km
                    </div>
                    <div class="milestone-info">
                        <strong>Algorithms:</strong> ${algorithmsDisplay}
                    </div>
                    <div class="milestone-info">
                        <strong>Points:</strong> ${milestone.pointCount}
                    </div>
                    <div class="milestone-date">
                        Saved: ${date.toLocaleString()}
                    </div>
                    ${coordinatesList ? `
                        <div class="milestone-places">
                            <div class="milestone-places-title">Places:</div>
                            <div class="milestone-places-list">${coordinatesList}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    loadMilestone(milestoneId) {
        const milestone = this.milestones.find(m => m.id === milestoneId);
        if (!milestone) return;

        // Clear current points
        this.clearAllPoints();

        // Load points
        milestone.points.forEach((point, index) => {
            const placeName = milestone.placeNames[index] || null;
            this.addPoint(point.lat, point.lng, placeName);
        });

        // Draw the saved path
        this.clearPaths();
        this.algorithms.bestPath = milestone.path;
        this.algorithms.bestDistance = milestone.distance;
        
        if (this.algorithms.bestPath) {
            this.bestPathPolyline = this.drawPath(this.algorithms.bestPath, '#28a745', 4);
        }

        // Update stats
        const algorithmsDisplay = milestone.algorithms 
            ? milestone.algorithms.join(' → ') 
            : (milestone.algorithm || 'Unknown');
        document.getElementById('currentBest').textContent = milestone.distance.toFixed(2) + ' KM';
        document.getElementById('currentAlgorithm').textContent = algorithmsDisplay;

        // Fit map to bounds
        if (milestone.points.length > 0) {
            const bounds = L.latLngBounds(milestone.points.map(p => [p.lat, p.lng]));
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    deleteMilestone(milestoneId) {
        if (!confirm('Are you sure you want to delete this milestone?')) return;

        this.milestones = this.milestones.filter(m => m.id !== milestoneId);
        this.saveMilestonesToStorage();
        this.renderMilestones();
    }
}

// Global variables
let tspVisualizer;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('TSP Visualizer loaded. Initializing with OpenStreetMap...');
    tspVisualizer = new TSPVisualizer();
    tspVisualizer.initMap();
    tspVisualizer.renderMilestones();
});