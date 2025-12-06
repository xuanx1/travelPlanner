// Main Application JavaScript with OpenStreetMap (Leaflet) Integration

class TSPVisualizer {
    constructor() {
        this.map = null;
        this.previewMap = null;
        this.previewPathPolylines = [];
        this.previewBestPathPolyline = null;
        this.previewMarkers = [];
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
        this.constructionCompleted = false; // Track if a construction algorithm has completed
        this.routingProfile = 'driving-car'; // Default routing profile
        
        this.initializeEventListeners();
        this.algorithms.setUpdateCallback(this.onAlgorithmUpdate.bind(this));
    }

    initializeEventListeners() {
        // Routing profile buttons
        document.querySelectorAll('.routing-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const selectedProfile = e.currentTarget.dataset.profile;
                this.routingProfile = selectedProfile;
                
                // Update active state
                document.querySelectorAll('.routing-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Point controls
        document.getElementById('clearPoints').addEventListener('click', () => {
            this.clearAllPoints();
        });

        // Algorithm buttons
        document.querySelectorAll('.algorithm-btn').forEach(btn => {
            // Add tooltip if data-tooltip-label exists
            const tooltipLabel = btn.dataset.tooltipLabel;
            const tooltipDesc = btn.dataset.tooltipDesc;
            const tooltipStrengths = btn.dataset.tooltipStrengths;
            const tooltipWeaknesses = btn.dataset.tooltipWeaknesses;
            
            if (tooltipLabel && tooltipDesc) {
                const tooltip = document.createElement('div');
                tooltip.className = 'algorithm-tooltip';
                
                // Title section
                const label = document.createElement('div');
                label.className = 'algorithm-tooltip-label';
                label.textContent = tooltipLabel;
                tooltip.appendChild(label);
                
                const value = document.createElement('div');
                value.className = 'algorithm-tooltip-value';
                value.textContent = tooltipDesc;
                tooltip.appendChild(value);
                
                // Create sections container for side-by-side layout
                const sectionsContainer = document.createElement('div');
                sectionsContainer.className = 'algorithm-tooltip-sections';
                
                // Strengths section
                if (tooltipStrengths) {
                    const strengthsSection = document.createElement('div');
                    strengthsSection.className = 'algorithm-tooltip-section';
                    
                    const strengthsLabel = document.createElement('div');
                    strengthsLabel.className = 'algorithm-tooltip-section-label';
                    strengthsLabel.textContent = 'Strengths';
                    
                    const strengthsValue = document.createElement('div');
                    strengthsValue.className = 'algorithm-tooltip-section-value';
                    strengthsValue.textContent = tooltipStrengths;
                    
                    strengthsSection.appendChild(strengthsLabel);
                    strengthsSection.appendChild(strengthsValue);
                    sectionsContainer.appendChild(strengthsSection);
                }
                
                // Weaknesses section
                if (tooltipWeaknesses) {
                    const weaknessesSection = document.createElement('div');
                    weaknessesSection.className = 'algorithm-tooltip-section';
                    
                    const weaknessesLabel = document.createElement('div');
                    weaknessesLabel.className = 'algorithm-tooltip-section-label';
                    weaknessesLabel.textContent = 'Weaknesses';
                    
                    const weaknessesValue = document.createElement('div');
                    weaknessesValue.className = 'algorithm-tooltip-section-value';
                    weaknessesValue.textContent = tooltipWeaknesses;
                    
                    weaknessesSection.appendChild(weaknessesLabel);
                    weaknessesSection.appendChild(weaknessesValue);
                    sectionsContainer.appendChild(weaknessesSection);
                }
                
                tooltip.appendChild(sectionsContainer);
                document.body.appendChild(tooltip);
                
                // Position tooltip on hover
                btn.addEventListener('mouseenter', () => {
                    const rect = btn.getBoundingClientRect();
                    tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
                    tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
                    tooltip.style.opacity = '0.9';
                    tooltip.style.visibility = 'visible';
                });
                
                btn.addEventListener('mouseleave', () => {
                    tooltip.style.opacity = '0';
                    tooltip.style.visibility = 'hidden';
                });
            }

            btn.addEventListener('click', (e) => {
                const algorithmBtn = e.currentTarget;
                const algorithm = algorithmBtn.dataset.algorithm;
                this.selectAlgorithm(algorithm);
                document.querySelectorAll('.algorithm-btn').forEach(b => b.classList.remove('active'));
                algorithmBtn.classList.add('active');
                
                // Automatically run the algorithm if we have enough points
                if (this.points.length >= 3) {
                    this.runAlgorithm();
                }
            });
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
        
        // Close preview button
        document.getElementById('closePreview').addEventListener('click', () => {
            this.closePreview();
        });
        
        // Disable refinement buttons from the start
        this.updateRefinementButtonState();
    }

    resetAlgorithmHistory() {
        this.algorithmsUsed = [];
    }

    setStatus(message, showProgress = false) {
        const statusText = document.getElementById('statusText');
        const progressBar = document.getElementById('progressBar');
        
        statusText.textContent = message;
        
        if (showProgress) {
            progressBar.style.display = 'block';
        } else {
            progressBar.style.display = 'none';
        }
    }

    clearStatus() {
        this.setStatus('Ready to explore! ✈️', false);
    }

    initMap() {
        // Initialize Leaflet map with Google Maps tiles
        this.map = L.map('map', {
            center: [-1, 109], // Southeast Asia
            zoom: 4,
            zoomControl: true
        });

        // Add Google Maps tile layer
        this.tileLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=auto", {
            attribution: "&copy; Google Maps",
            subdomains: ["mt0", "mt1", "mt2", "mt3"],
            maxZoom: 16,
            minZoom: 5,
        }).addTo(this.map);

        // Add click listener to place points
        this.map.on('click', (event) => {
            this.addPoint(event.latlng.lat, event.latlng.lng);
        });
    }

    initPreviewMap() {
        // Initialize preview map for milestone preview
        this.previewMap = L.map('previewMap', {
            center: [-1, 109],
            zoom: 4,
            zoomControl: true
        });

        L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=auto", {
            attribution: "&copy; Google Maps",
            subdomains: ["mt0", "mt1", "mt2", "mt3"],
            maxZoom: 16,
            minZoom: 5,
        }).addTo(this.previewMap);

        // Force map to invalidate size and redraw
        setTimeout(() => {
            this.previewMap.invalidateSize();
        }, 100);
    }

    closePreview() {
        // Clear preview map
        if (this.previewMap) {
            this.previewPathPolylines.forEach(polyline => this.previewMap.removeLayer(polyline));
            this.previewPathPolylines = [];
            if (this.previewBestPathPolyline) {
                this.previewMap.removeLayer(this.previewBestPathPolyline);
                this.previewBestPathPolyline = null;
            }
        }
        document.getElementById('previewInfo').style.display = 'none';
    }

    async isLocationOnLand(lat, lng) {
        try {
            // Set a 2 second timeout for the reverse geocoding request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                return true; // Allow if service fails
            }
            
            const data = await response.json();
            
            // Water bodies typically have these address types
            const waterTypes = ['water', 'waterway', 'bay', 'ocean', 'sea', 'lake', 'river'];
            if (waterTypes.includes(data.address_type)) {
                return false;
            }
            
            // Check if name indicates water
            if (data.name && data.name.toLowerCase().includes('water')) {
                return false;
            }
            
            // Check address object for water indicators
            if (data.address) {
                const addressStr = JSON.stringify(data.address).toLowerCase();
                if (addressStr.includes('water') || addressStr.includes('ocean') || 
                    addressStr.includes('sea') || addressStr.includes('bay')) {
                    return false;
                }
            }
            
            // If we got a valid address with a country, it's likely on land
            if (data.address && data.address.country) {
                return true;
            }
            
            // If no country found, probably water
            return false;
        } catch (error) {
            // Timeout or other error - allow placement to be fast
            return true;
        }
    }

    async addPoint(lat, lng, placeName = null) {
        // Show status - checking location
        this.setStatus('Checking if that spot is on land...', false);
        
        // Check if location is on land
        const isOnLand = await this.isLocationOnLand(lat, lng);
        
        if (!isOnLand) {
            this.clearStatus();
            return; // Silently reject water locations
        }
        
        // Show status - adding point
        this.setStatus('Adding your stop...', false);
        
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
            const tooltip = `<div class="tooltip-content"><div class="tooltip-label">PLACE</div><div class="tooltip-value">${placeName}</div><div class="tooltip-coords"><div class="tooltip-coord-item"><span class="tooltip-coord-label">LAT</span><span class="tooltip-coord-value">${lat.toFixed(4)}</span></div><div class="tooltip-coord-item"><span class="tooltip-coord-label">LON</span><span class="tooltip-coord-value">${lng.toFixed(4)}</span></div></div></div>`;
            marker.bindTooltip(tooltip, { permanent: false, direction: 'top' });
            this.clearStatus();
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
            // Show status when dragging
            this.setStatus('Finding the name of that spot...', false);
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

        // Add hover listener to mark visualization step as complete
        marker.on('mouseover', () => {
            // Check if routes are drawn (best path or evaluated paths exist)
            const hasRoutes = this.bestPathPolyline || this.pathPolylines.length > 0;
            if (hasRoutes) {
                this.markStepComplete('visualize-tsp');
            }
        });

        this.markers.push(marker);
        this.algorithms.setPoints(this.points);
        this.updateStats();
        
        // Auto-update milestone name whenever points change
        this.updateMilestoneName();
        
        // Track progress: Mark "Plot points" as complete when 3+ points added
        if (this.points.length >= 3) {
            this.markStepComplete('plot-points');
        }
    }

    markStepComplete(stepName) {
        const stepElement = document.querySelector(`[data-step="${stepName}"]`);
        if (stepElement && !stepElement.classList.contains('completed')) {
            stepElement.classList.add('completed');
        }
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
            
            // Unmark "Plot points" if we drop below 3 points
            if (this.points.length < 3) {
                this.unmarkStep('plot-points');
            }
            
            // Status message
            this.setStatus(`One less stop! ${this.points.length} destination${this.points.length !== 1 ? 's' : ''} left`, false);
            setTimeout(() => this.clearStatus(), 2000);
        }
    }
    
    unmarkStep(stepName) {
        const stepElement = document.querySelector(`[data-step="${stepName}"]`);
        if (stepElement && stepElement.classList.contains('completed')) {
            stepElement.classList.remove('completed');
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
        
        // Reset all progress steps
        this.unmarkStep('plot-points');
        this.unmarkStep('choose-algorithm');
        this.unmarkStep('run-construction');
        this.unmarkStep('run-refinement');
        this.unmarkStep('visualize-tsp');
        
        // Status message
        this.setStatus('Cleared! Ready for a fresh route 🗺️', false);
        setTimeout(() => this.clearStatus(), 3000);
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
        const algorithmNames = {
            'nearestNeighbor': 'Nearest Neighbor',
            'convexHull': 'Convex Hull',
            'genetic': 'Genetic Algorithm',
            'twoOpt': '2-Opt',
            'simulatedAnnealing': 'Simulated Annealing'
        };
        this.setStatus(`Cool! Let's try ${algorithmNames[algorithm] || algorithm}`, false);
        setTimeout(() => this.clearStatus(), 3000);
        this.updateExecutionControls();
        this.updateRefinementButtonState();
        // Track progress: Mark "Choose an algorithm" as complete
        this.markStepComplete('choose-algorithm');
    }

    updateRefinementButtonState() {
        const refinementAlgorithms = ['genetic', 'twoOpt', 'simulatedAnnealing'];
        
        document.querySelectorAll('.algorithm-btn').forEach(btn => {
            const algo = btn.dataset.algorithm;
            
            if (refinementAlgorithms.includes(algo)) {
                // Enable only if a construction algorithm has completed and nothing is running
                const shouldEnable = this.constructionCompleted && !this.isRunning;
                
                if (!shouldEnable) {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                    btn.title = 'Run a construction algorithm first';
                } else {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    btn.title = '';
                }
            }
        });
    }

    async runAlgorithm() {
        if (!this.selectedAlgorithm || this.points.length < 3) return;

        this.isRunning = true;
        this.startTime = Date.now();
        this.currentAlgorithm = this.selectedAlgorithm;
        
        // Disable refinement buttons while construction is running
        this.updateRefinementButtonState();
        
        // Show status
        this.setStatus(`Running ${this.selectedAlgorithm}...`, true);
        
        // Track algorithm usage
        const algorithmNames = {
            'nearestNeighbor': 'Nearest Neighbor',
            'convexHull': 'Convex Hull',
            'genetic': 'Genetic Algorithm',
            'twoOpt': '2-Opt',
            'simulatedAnnealing': 'Simulated Annealing'
        };
        this.algorithmsUsed.push(algorithmNames[this.selectedAlgorithm] || this.selectedAlgorithm);
        
        // Track progress for construction vs refinement algorithms
        const constructionAlgorithms = ['nearestNeighbor', 'convexHull'];
        const refinementAlgorithms = ['genetic', 'twoOpt', 'simulatedAnnealing'];
        
        if (constructionAlgorithms.includes(this.selectedAlgorithm)) {
            this.markStepComplete('run-construction');
        }
        if (refinementAlgorithms.includes(this.selectedAlgorithm)) {
            this.markStepComplete('run-refinement');
        }
        
        // Clear paths based on algorithm type
        if (constructionAlgorithms.includes(this.selectedAlgorithm)) {
            // Construction algorithm: clear all paths and reset best path
            this.clearPaths();
            this.algorithms.bestPath = null;
            this.algorithms.bestDistance = Infinity;
        } else {
            // Refinement algorithm: only clear evaluated paths, keep best path
            this.pathPolylines.forEach(polyline => this.map.removeLayer(polyline));
            this.pathPolylines = [];
            // Keep the existing best path from construction
        }
        
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
        
        // Mark construction as completed if this was a construction algorithm
        if (this.selectedAlgorithm === 'nearestNeighbor' || this.selectedAlgorithm === 'convexHull') {
            this.constructionCompleted = true;
        }
        
        const algorithmName = {
            'nearestNeighbor': 'Nearest Neighbor',
            'convexHull': 'Convex Hull',
            'genetic': 'Genetic Algorithm',
            'twoOpt': '2-Opt',
            'simulatedAnnealing': 'Simulated Annealing'
        }[this.selectedAlgorithm] || this.selectedAlgorithm;
        
        // Convert straight lines to actual routes
        await this.convertPathsToRoutes();
        
        this.setStatus(`Nice! ${algorithmName} found a route of ${this.algorithms.bestDistance.toFixed(2)} KM ✨`, false);
        setTimeout(() => this.clearStatus(), 5000);
        this.updateExecutionControls();
        // Re-enable refinement buttons after construction finishes
        this.updateRefinementButtonState();
    }

    pauseAlgorithm() {
        if (this.algorithms.isPaused) {
            this.algorithms.resume();
            this.setStatus(`Back on it! Computing ${this.selectedAlgorithm}...`, true);
        } else {
            this.algorithms.pause();
            this.setStatus('Paused for a coffee break ☕', false);
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
        if (data.currentPath) {
            this.drawPath(data.currentPath, '#ffc107', 2).catch(err => console.error(err));
        }

        // Update best path
        if (data.bestPath) {
            if (this.bestPathPolyline) {
                this.map.removeLayer(this.bestPathPolyline);
            }
            this.drawPath(data.bestPath, '#28a745', 4).then(polyline => {
                this.bestPathPolyline = polyline;
            }).catch(err => console.error(err));
        }

        // Update statistics
        document.getElementById('currentBest').textContent = 
            (data.bestDistance !== Infinity ? data.bestDistance.toFixed(2) : '-') + ' KM';
        document.getElementById('evaluating').textContent = 
            (data.currentDistance ? data.currentDistance.toFixed(2) : '-') + ' KM';
        document.getElementById('currentAlgorithm').textContent = data.algorithm || 'None';
    }

    async drawPath(points, color, strokeWeight) {
        if (points.length < 2) return null;

        try {
            // Draw straight line path immediately (no routing during execution)
            const polyline = L.polyline(points.map(p => [p.lat, p.lng]), {
                color: color,
                weight: strokeWeight,
                opacity: 1.0
            }).addTo(this.map);
            
            if (color !== '#28a745') { // Don't add non-best paths to cleanup array
                this.pathPolylines.push(polyline);
            }

            return polyline;
        } catch (error) {
            console.error('Error drawing path:', error);
            return null;
        }
    }

    // New method to convert all paths to actual routes after algorithm completes
    async convertPathsToRoutes() {
        this.setStatus('Converting to actual routes...', false);
        
        try {
            // Convert best path
            if (this.bestPathPolyline && this.points.length >= 2) {
                const routedCoordinates = await this.getRoutedPath(this.points);
                if (routedCoordinates && routedCoordinates.length > 0) {
                    this.map.removeLayer(this.bestPathPolyline);
                    this.bestPathPolyline = L.polyline(routedCoordinates, {
                        color: '#28a745',
                        weight: 4,
                        opacity: 1.0
                    }).addTo(this.map);
                }
            }

            // Convert evaluated paths
            const newPathPolylines = [];
            for (let polyline of this.pathPolylines) {
                try {
                    // Extract points from polyline
                    const latlngs = polyline.getLatLngs();
                    const points = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
                    
                    if (points.length >= 2) {
                        const routedCoordinates = await this.getRoutedPath(points);
                        if (routedCoordinates && routedCoordinates.length > 0) {
                            this.map.removeLayer(polyline);
                            const newPolyline = L.polyline(routedCoordinates, {
                                color: '#ffc107',
                                weight: 2,
                                opacity: 1.0
                            }).addTo(this.map);
                            newPathPolylines.push(newPolyline);
                        } else {
                            newPathPolylines.push(polyline); // Keep original if routing fails
                        }
                    } else {
                        newPathPolylines.push(polyline);
                    }
                } catch (error) {
                    console.error('Error routing evaluated path:', error);
                    newPathPolylines.push(polyline); // Keep original if error
                }
            }
            this.pathPolylines = newPathPolylines;
            
            this.clearStatus();
        } catch (error) {
            console.error('Error converting paths to routes:', error);
            this.setStatus('Error converting to routes. Keeping straight lines.', false);
            setTimeout(() => this.clearStatus(), 3000);
        }
    }

    drawDirectPath(routedCoordinates, color, strokeWeight, isEvaluatedPath = false) {
        // Draw a path that is already routed (no need to call OSRM)
        if (!routedCoordinates || routedCoordinates.length < 2) return null;

        try {
            const polyline = L.polyline(routedCoordinates, {
                color: color,
                weight: strokeWeight,
                opacity: 1.0
            }).addTo(this.map);
            
            if (isEvaluatedPath) {
                this.pathPolylines.push(polyline);
            }

            return polyline;
        } catch (error) {
            console.error('Error drawing direct path:', error);
            return null;
        }
    }

    async getRoutedPath(points) {
        // Build coordinates string for OSRM: lng,lat;lng,lat;...
        const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
        
        // Close the loop by adding the first point at the end
        const closedCoordinates = coordinates + `;${points[0].lng},${points[0].lat}`;
        
        // Try OSRM first
        let result = await this.tryOSRM(closedCoordinates);
        if (result) return result;
        
        // Try GraphHopper as fallback
        result = await this.tryGraphHopper(points);
        if (result) return result;
        
        // Try Valhalla as last fallback
        result = await this.tryValhalla(points);
        if (result) return result;
        
        // All services failed
        this.setStatus('Routing services taking a break... Try again in a moment 🛣️', false);
        setTimeout(() => {
            if (!this.isRunning) {
                this.clearStatus();
            }
        }, 5000);
        
        return null;
    }

    async tryOSRM(closedCoordinates) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            // Map our routing profiles to OSRM profiles
            const profileMap = {
                'driving-car': 'driving',
                'driving-hgv': 'driving',
                'cycling-regular': 'bike',
                'foot-walking': 'foot'
            };
            const profile = profileMap[this.routingProfile] || 'driving';
            
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/${profile}/${closedCoordinates}?overview=full&geometries=geojson`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('OSRM routing failed');
            }
            
            const data = await response.json();
            
            if (data.routes && data.routes.length > 0) {
                const routeCoordinates = data.routes[0].geometry.coordinates;
                return routeCoordinates.map(coord => [coord[1], coord[0]]);
            }
            return null;
        } catch (error) {
            console.warn('OSRM service unavailable:', error.message);
            return null;
        }
    }

    async tryGraphHopper(points) {
        try {
            // Map our routing profiles to GraphHopper vehicles
            const vehicleMap = {
                'driving-car': 'car',
                'driving-hgv': 'hgv',
                'cycling-regular': 'bike',
                'foot-walking': 'foot'
            };
            const vehicle = vehicleMap[this.routingProfile] || 'car';
            
            // Build GraphHopper format: point=lat,lng&point=lat,lng
            const pointParams = points.map(p => `point=${p.lat},${p.lng}`).join('&');
            // Add first point again to close the loop
            const allPointsParams = pointParams + `&point=${points[0].lat},${points[0].lng}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            const response = await fetch(
                `https://graphhopper.com/api/1/route?${allPointsParams}&vehicle=${vehicle}&locale=en&type=json`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('GraphHopper routing failed');
            }
            
            const data = await response.json();
            
            if (data.paths && data.paths.length > 0) {
                const points = data.paths[0].points.coordinates;
                // GraphHopper returns [lng, lat], convert to [lat, lng]
                return points.map(coord => [coord[1], coord[0]]);
            }
            return null;
        } catch (error) {
            console.warn('GraphHopper service unavailable:', error.message);
            return null;
        }
    }

    async tryValhalla(points) {
        try {
            // Map our routing profiles to Valhalla costing models
            const costingMap = {
                'driving-car': 'auto',
                'driving-hgv': 'auto',
                'cycling-regular': 'bicycle',
                'foot-walking': 'pedestrian'
            };
            const costing = costingMap[this.routingProfile] || 'auto';
            
            const locations = points.map(p => ({ lat: p.lat, lon: p.lng }));
            // Add first point again to close the loop
            locations.push({ lat: points[0].lat, lon: points[0].lng });
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            const response = await fetch(
                'https://valhalla.openstreetmap.de/route',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        locations: locations,
                        costing: costing
                    }),
                    signal: controller.signal
                }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('Valhalla routing failed');
            }
            
            const data = await response.json();
            
            if (data.trip && data.trip.legs) {
                const routeCoordinates = [];
                data.trip.legs.forEach(leg => {
                    if (leg.shape) {
                        // Decode polyline or use coordinates directly
                        const coords = this.decodePolyline(leg.shape);
                        routeCoordinates.push(...coords);
                    }
                });
                return routeCoordinates;
            }
            return null;
        } catch (error) {
            console.warn('Valhalla service unavailable:', error.message);
            return null;
        }
    }

    decodePolyline(encoded) {
        // Simple polyline decoder for Valhalla format
        const precision = 6;
        const factor = Math.pow(10, precision);
        let index = 0, lat = 0, lng = 0;
        const coordinates = [];
        
        while (index < encoded.length) {
            let result = 0, shift = 0, byte;
            do {
                byte = encoded.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
            
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);
            
            result = 0;
            shift = 0;
            do {
                byte = encoded.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
            
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);
            
            coordinates.push([lat / factor, lng / factor]);
        }
        
        return coordinates;
    }

    updatePathVisibility() {
        const showBest = document.getElementById('showBestPath').checked;
        const showEvaluated = document.getElementById('showEvaluatedPaths').checked;

        // First, handle evaluated paths
        this.pathPolylines.forEach(polyline => {
            if (showEvaluated) {
                polyline.addTo(this.map);
            } else {
                this.map.removeLayer(polyline);
            }
        });

        // Then, redraw best path last so it's always on top
        if (this.bestPathPolyline) {
            if (showBest) {
                // Remove and re-add to ensure it's on top
                this.map.removeLayer(this.bestPathPolyline);
                this.bestPathPolyline.addTo(this.map);
            } else {
                this.map.removeLayer(this.bestPathPolyline);
            }
        }
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
        // No longer needed - algorithms run directly from button click
        return;
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
            this.setStatus('Looking up the location name...', false);
            
            // Use Nominatim reverse geocoding API
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            
            if (data && data.display_name) {
                // Store the place name
                this.placeNames.set(markerIndex, data.display_name);
                const tooltip = `<div class="tooltip-content"><div class="tooltip-label">PLACE</div><div class="tooltip-value">${data.display_name}</div><div class="tooltip-coords"><div class="tooltip-coord-item"><span class="tooltip-coord-label">LAT</span><span class="tooltip-coord-value">${lat.toFixed(4)}</span></div><div class="tooltip-coord-item"><span class="tooltip-coord-label">LON</span><span class="tooltip-coord-value">${lng.toFixed(4)}</span></div></div></div>`;
                marker.bindTooltip(tooltip, { permanent: false, direction: 'top' });
                
                // Update milestone name after getting place name
                this.updateMilestoneName();
                this.clearStatus();
            } else {
                // Fallback to coordinates
                const coordName = `Point ${markerIndex + 1}`;
                this.placeNames.set(markerIndex, coordName);
                const tooltip = `<div class="tooltip-content"><div class="tooltip-label">PLACE</div><div class="tooltip-value">Point ${markerIndex + 1}</div><div class="tooltip-coords"><div class="tooltip-coord-item"><span class="tooltip-coord-label">LAT</span><span class="tooltip-coord-value">${lat.toFixed(4)}</span></div><div class="tooltip-coord-item"><span class="tooltip-coord-label">LON</span><span class="tooltip-coord-value">${lng.toFixed(4)}</span></div></div></div>`;
                marker.bindTooltip(tooltip, { permanent: false, direction: 'top' });
                this.updateMilestoneName();
                this.clearStatus();
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            // Fallback to coordinates
            const coordName = `Point ${markerIndex + 1}`;
            this.placeNames.set(markerIndex, coordName);
            const tooltip = `<div class="tooltip-content"><div class="tooltip-label">PLACE</div><div class="tooltip-value">Point ${markerIndex + 1}</div><div class="tooltip-coords"><div class="tooltip-coord-item"><span class="tooltip-coord-label">LAT</span><span class="tooltip-coord-value">${lat.toFixed(4)}</span></div><div class="tooltip-coord-item"><span class="tooltip-coord-label">LON</span><span class="tooltip-coord-value">${lng.toFixed(4)}</span></div></div></div>`;
            marker.bindTooltip(tooltip, { permanent: false, direction: 'top' });
            this.updateMilestoneName();
            this.clearStatus();
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
                suggestedName = `${countries[0]} Tour (${cities.length} Places)`;
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

    async saveMilestone() {
        const name = document.getElementById('milestoneName').value.trim();
        if (!name) {
            alert('Please enter a milestone name');
            return;
        }

        if (!this.algorithms.bestPath || this.algorithms.bestDistance === Infinity) {
            alert('Please run an algorithm first to get a route');
            return;
        }

        // Validate and extract the routed best path from the current polyline
        let bestPathRouted = [];
        if (this.bestPathPolyline && this.bestPathPolyline._latlngs) {
            bestPathRouted = this.bestPathPolyline._latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
        }

        // Check if we have a valid routed path
        if (bestPathRouted.length < 2) {
            alert('Error: Final route could not be established. Some points may not be connectable. Please check your route and try again.');
            return;
        }

        // Validate that all consecutive points in the route have valid connections
        let hasConnectionIssues = false;
        let errorMessage = '';

        // Check for gaps in the route (if points couldn't be routed)
        if (bestPathRouted.length < this.points.length * 2) {
            // A typical route should have multiple coordinates per point segment
            // If it's too sparse, some segments may have failed to route
            hasConnectionIssues = true;
            errorMessage = 'Warning: Some route segments may not be optimally connected.';
        }

        if (hasConnectionIssues) {
            const proceed = confirm(errorMessage + '\n\nContinue saving anyway?');
            if (!proceed) return;
        }

        // Create milestone object with only the final routed path
        const milestone = {
            id: Date.now(),
            name: name,
            date: new Date().toISOString(),
            distance: this.algorithms.bestDistance,
            algorithms: [...this.algorithmsUsed], // All algorithms used in sequence
            pointCount: this.points.length,
            points: [...this.points],
            bestPath: bestPathRouted, // Only save the final routed path
            evaluatedPaths: [], // Don't save evaluated paths - only final result
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
        
        // Status message with instructions
        this.setStatus(`✅ Saved "${name}" locally. Downloaded JSON file - copy it to replace milestones-data.json to update GitHub Pages 📥`, false);
        setTimeout(() => this.clearStatus(), 5000);
    }

    async loadMilestones() {
        // First, try to load from milestones-data.json (if it exists)
        try {
            const response = await fetch('milestones-data.json');
            if (response.ok) {
                const jsonData = await response.json();
                if (Array.isArray(jsonData) && jsonData.length > 0) {
                    // Convert JSON format to internal milestone format
                    this.milestones = jsonData.map(m => ({
                        id: m.id || `milestone-${Date.now()}-${Math.random()}`,
                        name: m.name || m.milestoneName,
                        distance: m.distance || m.bestDistance,
                        pointCount: m.pointCount || (m.points ? m.points.length : m.coordinates ? m.coordinates.length : 0),
                        // Use coordinates array (has names) if available, otherwise use points
                        coordinates: m.coordinates || m.points || m.bestPath || [],
                        algorithms: m.algorithms || m.algorithmSequence || [],
                        date: m.date || m.timestamp,
                        bestPath: m.path || m.bestPath || []
                    }));
                    console.log('✅ Loaded milestones from JSON:', this.milestones.length);
                    return;
                }
            }
        } catch (e) {
            console.log('⚠️ milestones-data.json fetch error:', e.message);
            // If fetch fails, try XMLHttpRequest as fallback
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'milestones-data.json', false); // synchronous
                xhr.send();
                if (xhr.status === 200) {
                    const jsonData = JSON.parse(xhr.responseText);
                    if (Array.isArray(jsonData) && jsonData.length > 0) {
                        this.milestones = jsonData.map(m => ({
                            id: m.id || `milestone-${Date.now()}-${Math.random()}`,
                            name: m.name || m.milestoneName,
                            distance: m.distance || m.bestDistance,
                            pointCount: m.pointCount || (m.points ? m.points.length : m.coordinates ? m.coordinates.length : 0),
                            // Use coordinates array (has names) if available, otherwise use points
                            coordinates: m.coordinates || m.points || m.bestPath || [],
                            algorithms: m.algorithms || m.algorithmSequence || [],
                            date: m.date || m.timestamp,
                            bestPath: m.path || m.bestPath || []
                        }));
                        console.log('✅ Loaded milestones from JSON (XMLHttpRequest):', this.milestones.length);
                        return;
                    }
                }
            } catch (e2) {
                console.log('⚠️ XMLHttpRequest also failed:', e2.message);
            }
        }
        
        // Fallback: Load from localStorage
        const stored = localStorage.getItem('tsp_milestones');
        if (stored) {
            try {
                this.milestones = JSON.parse(stored);
                console.log('✅ Loaded milestones from localStorage:', this.milestones.length);
            } catch (e) {
                console.error('❌ Error loading milestones from localStorage:', e);
                this.milestones = [];
            }
        } else {
            console.log('⚠️ No milestones found in localStorage');
            this.milestones = [];
        }
    }

    saveMilestonesToStorage() {
        try {
            localStorage.setItem('tsp_milestones', JSON.stringify(this.milestones));
            // Auto-sync to JSON for GitHub Pages
            this.saveMilestonesToJSON();
        } catch (e) {
            // Storage limit exceeded (QuotaExceededError)
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                if (this.milestones.length > 1) {
                    // Find and remove the oldest milestone
                    let oldestIndex = 0;
                    let oldestDate = new Date(this.milestones[0].date);
                    
                    for (let i = 1; i < this.milestones.length; i++) {
                        const currentDate = new Date(this.milestones[i].date);
                        if (currentDate < oldestDate) {
                            oldestDate = currentDate;
                            oldestIndex = i;
                        }
                    }
                    
                    const removedMilestone = this.milestones[oldestIndex];
                    
                    // Create a backup and offer download before removing
                    const backupData = JSON.stringify(removedMilestone, null, 2);
                    const backupBlob = new Blob([backupData], { type: 'application/json' });
                    const backupUrl = URL.createObjectURL(backupBlob);
                    const backupLink = document.createElement('a');
                    backupLink.href = backupUrl;
                    backupLink.download = `${removedMilestone.name}-backup-${new Date(removedMilestone.date).toISOString().split('T')[0]}.json`;
                    
                    // Show confirmation dialog with download option
                    const confirmed = confirm(
                        `Storage is full! Your oldest trip "${removedMilestone.name}" will be removed.\n\n` +
                        `Click OK to download it first, then it will be removed to save your new trip.\n` +
                        `Cancel to keep both trips.`
                    );
                    
                    if (confirmed) {
                        // Trigger download
                        backupLink.click();
                        URL.revokeObjectURL(backupUrl);
                        
                        // Remove after a brief delay to let download start
                        setTimeout(() => {
                            this.milestones.splice(oldestIndex, 1);
                            
                            // Try saving again
                            try {
                                localStorage.setItem('tsp_milestones', JSON.stringify(this.milestones));
                                this.renderMilestones();
                                this.setStatus(`Downloaded & removed "${removedMilestone.name}". New trip saved! 📦`, false);
                                setTimeout(() => this.clearStatus(), 4000);
                            } catch (e2) {
                                console.error('Still cannot save after removing oldest:', e2);
                                alert('Storage is completely full. Please delete more milestones.');
                            }
                        }, 500);
                    } else {
                        // User cancelled - put the milestone back if we removed it
                        this.setStatus(`Storage full. Delete some trips to make space. 💾`, false);
                        setTimeout(() => this.clearStatus(), 3000);
                    }
                } else {
                    console.error('Cannot save: storage limit exceeded and only one milestone exists');
                    alert('Storage is full. Please delete some milestones to make space.');
                }
            } else {
                throw e;
            }
        }
    }

    saveMilestonesToJSON() {
        // Auto-merge the NEW milestone into existing milestones-data.json
        if (this.milestones.length === 0) return;
        
        const lastMilestone = this.milestones[this.milestones.length - 1];
        const newMilestoneData = {
            id: lastMilestone.id || `milestone-${Date.now()}-${Math.random()}`,
            name: lastMilestone.name,
            date: lastMilestone.date,
            distance: lastMilestone.distance,
            algorithms: lastMilestone.algorithms || [],
            pointCount: lastMilestone.pointCount,
            points: lastMilestone.points || [],
            path: lastMilestone.bestPath || lastMilestone.path || [],
            coordinates: lastMilestone.coordinates || []
        };

        // Try to read existing data and merge
        fetch('milestones-data.json')
            .then(r => r.json())
            .then(existingData => {
                // Merge: keep existing data, add new milestone
                const merged = Array.isArray(existingData) ? existingData : [];
                
                // Check if this milestone already exists (by id)
                const existingIndex = merged.findIndex(m => m.id === newMilestoneData.id);
                if (existingIndex >= 0) {
                    merged[existingIndex] = newMilestoneData;
                } else {
                    merged.push(newMilestoneData);
                }
                
                // Auto-save merged data
                this.autoSaveMergedJSON(merged, lastMilestone);
            })
            .catch(() => {
                // If fetch fails, try to save just new milestone
                this.autoSaveMergedJSON([newMilestoneData], lastMilestone);
            });
    }

    async autoSaveMergedJSON(mergedData, lastMilestone) {
        try {
            // Try modern File System Access API (Chrome, Edge, Firefox)
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'milestones-data.json',
                    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(JSON.stringify(mergedData, null, 2));
                await writable.close();
                console.log('✅ Auto-saved merged milestones to milestones-data.json');
            } else {
                // Fallback: auto-download with proper filename
                const jsonString = JSON.stringify(mergedData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                
                // Format: trip_name_YYYY-MM-DD_HH-MM-SS.json
                const savedDate = new Date(lastMilestone.date);
                const dateStr = savedDate.toISOString().replace(/[:.]/g, '-').split('T')[0]; // YYYY-MM-DD
                const timeStr = savedDate.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS
                link.download = `${lastMilestone.name.replace(/\s+/g, '_')}_${dateStr}_${timeStr}.json`;
                
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                console.log('⬇️ Downloaded milestones as', link.download);
            }
        } catch (err) {
            console.log('⚠️ Could not auto-save to file:', err.message);
        }
    }

    downloadJSON(dataToSave, milestone) {
        // Fallback download method (called from other places if needed)
        const jsonString = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        if (milestone) {
            const savedDate = new Date(milestone.date);
            const dateStr = savedDate.toISOString().replace(/[:.]/g, '-').split('T')[0]; // YYYY-MM-DD
            const timeStr = savedDate.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS
            link.download = `${milestone.name.replace(/\s+/g, '_')}_${dateStr}_${timeStr}.json`;
        } else {
            link.download = 'milestones-data.json';
        }
        
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    renderMilestones() {
        const container = document.getElementById('milestonesList');
        
        if (this.milestones.length === 0) {
            container.innerHTML = '<p class="no-milestones">No milestones saved yet. Complete a route and save it!</p>';
            return;
        }

        // Calculate efficiency ratio for each milestone (points / distance)
        // Higher ratio = better (more destinations with shorter distance)
        const withRatio = this.milestones.map(m => ({
            ...m,
            efficiencyRatio: m.pointCount / m.distance
        }));
        
        const sorted = withRatio.sort((a, b) => b.efficiencyRatio - a.efficiencyRatio);
        
        // Find the best milestone by efficiency ratio
        const bestMilestoneId = sorted.length > 0 ? sorted[0].id : null;

        container.innerHTML = sorted.map((milestone) => {
            const date = new Date(milestone.date);
            const isBest = milestone.id === bestMilestoneId;
            
            // Handle both old format (single algorithm) and new format (multiple algorithms)
            const algorithmsDisplay = milestone.algorithms 
                ? milestone.algorithms.join(' → ') 
                : (milestone.algorithm || 'Unknown');
            
            // Build coordinates list with numbered circles
            const coordinatesList = (milestone.coordinates || []).map((coord, index) => 
                `<li class="milestone-place-item"><span class="milestone-place-number">${index + 1}</span><span class="milestone-place-name">${coord.name || `Point ${index + 1}`}</span></li>`
            ).join('');

            return `
                <div class="milestone-card ${isBest ? 'best-milestone' : ''}">
                    <div class="milestone-header">
                        <span class="milestone-name">${isBest ? '🏆 ' : ''}${milestone.name}</span>
                        <div class="milestone-actions">
                            <button class="milestone-action-btn" onclick="tspVisualizer.loadMilestone(${milestone.id})">Preview</button>
                            <button class="milestone-action-btn" onclick="tspVisualizer.downloadMilestone(${milestone.id})">Download</button>
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
                    <div class="milestone-footer">
                        <div class="milestone-date">
                            Created: ${date.toLocaleString()}
                        </div>
                        <div class="milestone-efficiency">
                            Efficiency: ${milestone.efficiencyRatio.toFixed(3)}
                        </div>
                    </div>
                    ${coordinatesList ? `
                        <div class="milestone-places">
                            <div class="milestone-places-title">Places</div>
                            <ol class="milestone-places-list">${coordinatesList}</ol>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    loadMilestone(milestoneId) {
        const milestone = this.milestones.find(m => m.id === milestoneId);
        if (!milestone) return;

        // Show preview instead of loading to main map
        this.previewMilestone(milestoneId);
    }

    async previewMilestone(milestoneId) {
        const milestone = this.milestones.find(m => m.id === milestoneId);
        if (!milestone) return;

        // Initialize preview map if not already done
        if (!this.previewMap) {
            this.initPreviewMap();
        }

        // Clear previous preview
        this.previewPathPolylines.forEach(polyline => this.previewMap.removeLayer(polyline));
        this.previewPathPolylines = [];
        if (this.previewBestPathPolyline) {
            this.previewMap.removeLayer(this.previewBestPathPolyline);
            this.previewBestPathPolyline = null;
        }
        
        // Clear previous preview markers
        if (!this.previewMarkers) {
            this.previewMarkers = [];
        }
        this.previewMarkers.forEach(marker => this.previewMap.removeLayer(marker));
        this.previewMarkers = [];

        // Add markers for each point
        const pointsToDisplay = milestone.points || milestone.coordinates || [];
        if (pointsToDisplay && pointsToDisplay.length > 0) {
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: '<div class="marker-pin"></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            pointsToDisplay.forEach((point, index) => {
                // Ensure lat/lng are numbers (JSON might have strings)
                const lat = parseFloat(point.lat);
                const lng = parseFloat(point.lng);
                
                const marker = L.marker([lat, lng], {
                    icon: customIcon
                }).addTo(this.previewMap);
                
                // Add tooltip with place name
                const placeName = point.name || (milestone.coordinates && milestone.coordinates[index] ? milestone.coordinates[index].name : `Point ${index + 1}`);
                const tooltip = `<div class="tooltip-content"><div class="tooltip-label">PLACE</div><div class="tooltip-value">${placeName}</div><div class="tooltip-coords"><div class="tooltip-coord-item"><span class="tooltip-coord-label">LATITUDE</span><span class="tooltip-coord-value">${lat.toFixed(4)}</span></div><div class="tooltip-coord-item"><span class="tooltip-coord-label">LONGITUDE</span><span class="tooltip-coord-value">${lng.toFixed(4)}</span></div></div></div>`;
                marker.bindTooltip(tooltip, { permanent: false, direction: 'top' });
                
                this.previewMarkers.push(marker);
            });
        }

        // Draw the saved paths on preview map
        const bestPath = milestone.bestPath || milestone.path;
        
        // Draw best path - simple straight line connecting the route
        if (bestPath && bestPath.length > 0) {
            try {
                // Draw initial straight line polyline
                console.log('Drawing initial straight path with', bestPath.length, 'points');
                this.previewBestPathPolyline = this.drawDirectPathOnPreview(bestPath, '#28a745', 4, false);
                
                // Then fetch and replace with actual routed path
                this.updatePreviewWithActualRoute(bestPath);
            } catch (err) {
                console.error('Error drawing best path:', err);
            }
        } else {
            // Fallback: connect all coordinates in order if no explicit path
            const pointsToConnect = milestone.points || milestone.coordinates || [];
            if (pointsToConnect.length > 1) {
                console.log('No explicit path found, connecting all', pointsToConnect.length, 'points in order');
                this.previewBestPathPolyline = this.drawDirectPathOnPreview(pointsToConnect, '#28a745', 4, false);
                
                // Fetch actual route for these points
                this.updatePreviewWithActualRoute(pointsToConnect);
            }
        }
        
        // Draw evaluated paths if available
        if (milestone.evaluatedPaths && milestone.evaluatedPaths.length > 0) {
            milestone.evaluatedPaths.forEach(routedCoords => {
                if (routedCoords && routedCoords.length > 0) {
                    this.drawDirectPathOnPreview(routedCoords, '#ffc107', 2, true);
                }
            });
        }

        // Update preview info
        const algorithmsDisplay = milestone.algorithms 
            ? milestone.algorithms.join(' → ') 
            : (milestone.algorithm || 'Unknown');
        
        document.getElementById('previewName').textContent = milestone.name;
        
        // Build places list with numbered circles
        let placesListHTML = '';
        if (milestone.coordinates && milestone.coordinates.length > 0) {
            placesListHTML = '<div class="preview-places-section"><strong>Places</strong><ol class="places-list">' +
                milestone.coordinates.map((coord, index) => 
                    `<li class="places-item"><span class="place-number">${index + 1}</span>${coord.name}</li>`
                ).join('') +
                '</ol></div>';
        }
        
        document.getElementById('previewStats').innerHTML = `
            <div class="preview-stats-dashboard">
                <div class="stat-item">
                    <div class="stat-label">Distance</div>
                    <div class="stat-value">${milestone.distance.toFixed(2)} km</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Points</div>
                    <div class="stat-value">${milestone.pointCount}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Efficiency</div>
                    <div class="stat-value" style="color: ${milestone.pointCount / milestone.distance >= 5 ? '#28a745' : milestone.pointCount / milestone.distance >= 3 ? '#ffc107' : '#dc3545'}">${(milestone.pointCount / milestone.distance).toFixed(3)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Created</div>
                    <div class="stat-value">${new Date(milestone.date).toLocaleString()}</div>
                </div>
            </div>
            <div class="preview-algorithms-section">
                <strong>Algorithms</strong>
                <ol class="algorithms-list">
                    ${milestone.algorithms ? milestone.algorithms.map((algo, index) => 
                        `<li class="algorithms-item"><span class="algo-number">${index + 1}</span>${algo}</li>`
                    ).join('') : ''}
                </ol>
            </div>
            ${placesListHTML}
        `;
        document.getElementById('previewInfo').style.display = 'block';

        // Invalidate map size and fit bounds after paths are drawn and DOM is fully settled
        await new Promise(resolve => setTimeout(resolve, 300));
        this.previewMap.invalidateSize();
        const pointsForBounds = milestone.points || milestone.coordinates || [];
        if (pointsForBounds.length > 0) {
            const bounds = L.latLngBounds(pointsForBounds.map(p => [parseFloat(p.lat), parseFloat(p.lng)]));
            this.previewMap.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    async drawPathOnPreview(points, color, strokeWeight) {
        if (points.length < 2) return null;

        try {
            const routedCoordinates = await this.getRoutedPath(points);
            
            if (!routedCoordinates) {
                return null;
            }
            
            const polyline = L.polyline(routedCoordinates, {
                color: color,
                weight: strokeWeight,
                opacity: 1.0
            }).addTo(this.previewMap);
            
            if (color !== '#28a745') {
                this.previewPathPolylines.push(polyline);
            }

            return polyline;
        } catch (error) {
            console.error('Error drawing routed path on preview:', error);
            return null;
        }
    }

    drawDirectPathOnPreview(routedCoordinates, color, strokeWeight, isEvaluatedPath = false) {
        if (!routedCoordinates || routedCoordinates.length < 2) return null;

        try {
            // Convert to [lat, lng] array format if needed
            const latlngs = routedCoordinates.map(coord => 
                Array.isArray(coord) ? coord : [coord.lat, coord.lng]
            );
            
            const polyline = L.polyline(latlngs, {
                color: color,
                weight: strokeWeight,
                opacity: 1.0
            }).addTo(this.previewMap);
            
            if (isEvaluatedPath) {
                this.previewPathPolylines.push(polyline);
            }

            return polyline;
        } catch (error) {
            console.error('Error drawing direct path on preview:', error);
            return null;
        }
    }

    async updatePreviewWithActualRoute(pathPoints) {
        // Fetch actual routed path and replace the straight line visualization
        if (!pathPoints || pathPoints.length < 2) return;
        
        try {
            const routedCoords = await this.getRoutedPath(pathPoints);
            if (routedCoords && routedCoords.length > pathPoints.length) {
                // Remove the old straight line
                if (this.previewBestPathPolyline) {
                    this.previewMap.removeLayer(this.previewBestPathPolyline);
                }
                
                // Draw the new routed path
                this.previewBestPathPolyline = this.drawDirectPathOnPreview(routedCoords, '#28a745', 4, false);
                console.log('✅ Updated preview with actual routed path');
            }
        } catch (err) {
            console.log('⚠️ Could not fetch actual route, keeping straight line visualization:', err.message);
        }
    }

    deleteMilestone(milestoneId) {
        if (!confirm('Are you sure you want to delete this milestone?')) return;

        this.milestones = this.milestones.filter(m => m.id !== milestoneId);

        this.saveMilestonesToStorage();
        this.renderMilestones();
    }

    downloadMilestone(milestoneId) {
        const milestone = this.milestones.find(m => m.id === milestoneId);
        if (!milestone) return;

        // Show loading status
        this.setStatus('Downloading milestone...', true);

        // Simulate brief download processing
        setTimeout(() => {
            // Create a copy of the milestone for download
            const downloadData = {
                ...milestone,
                exportDate: new Date().toISOString(),
                exportedFrom: 'Itinerary Planner'
            };

            // Convert to JSON
            const jsonString = JSON.stringify(downloadData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const savedDate = new Date(milestone.date);
            const dateStr = savedDate.toISOString().replace(/[:.]/g, '-').split('T')[0]; // YYYY-MM-DD
            const timeStr = savedDate.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS
            const link = document.createElement('a');
            link.href = url;
            link.download = `${milestone.name.replace(/\s+/g, '_')}_${dateStr}_${timeStr}.json`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Clear status with success message
            this.setStatus(`Downloaded "${milestone.name}" 📥`, false);
            setTimeout(() => this.clearStatus(), 3000);
        }, 800); // 800ms delay to show progress bar
    }

}

// Global variables
let tspVisualizer;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('TSP Visualizer loaded. Initializing with OpenStreetMap...');
    tspVisualizer = new TSPVisualizer();
    await tspVisualizer.loadMilestones();
    tspVisualizer.initMap();
    tspVisualizer.initPreviewMap();
    tspVisualizer.renderMilestones();
    
    // Auto-load best milestone in preview map
    if (tspVisualizer.milestones.length > 0) {
        // Find best milestone by efficiency ratio
        const withRatio = tspVisualizer.milestones.map(m => ({
            ...m,
            efficiencyRatio: m.pointCount / m.distance
        }));
        const bestMilestone = withRatio.sort((a, b) => b.efficiencyRatio - a.efficiencyRatio)[0];
        if (bestMilestone) {
            await tspVisualizer.previewMilestone(bestMilestone.id);
        }
    }
});