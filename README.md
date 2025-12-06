# Tourist Attraction Router

A web-based [visualization](https://xuanx1.github.io/travelPlanner/) tool for solving the Traveling Salesman Problem (TSP) using various algorithms, integrated with OpenStreetMap for realistic geographic visualization.

![Screenshot 2025-12-06 180856](https://github.com/user-attachments/assets/d03a61ca-a373-4b9f-aafb-49697e68b3d4)

## Features

- **Interactive OpenStreetMap Integration**: Click to place points, drag to move them, right-click to delete
- **Place Search**: Real-time search and add real locations by name using OpenStreetMap's geocoding
- **Multiple Transportation Modes**: Choose routing profiles (Car, Bus/Truck, Cycling, Walking) for realistic route calculations
- **Smart Route Optimization**: Straight-line display during algorithm execution, actual routed paths after completion
- **Save & Compare Milestones**: Save your best routes with complete stats including coordinates, place names, and full algorithm history
- **Algorithm Sequence Tracking**: Track all algorithms used to achieve the final route (e.g., Nearest Neighbor → 2-Opt)
- **Algorithm Tooltips**: Hover over any algorithm to see how it works, its strengths, and weaknesses
- **Multiple TSP Algorithms**:
  - Nearest Neighbor (Construction algorithm)
  - Convex Hull (Construction algorithm)  
  - Genetic Algorithm (Metaheuristic)
  - 2-Opt (Local improvement)
  - Simulated Annealing (Metaheuristic)
- **Real-time Visualization**: Watch algorithms solve the problem step-by-step with instant visual feedback
- **Algorithm Controls**: Run construction algorithms, then refine with improvement algorithms
- **Path Visualization Options**: Toggle best path and evaluated paths
- **Responsive Design**: Works on desktop and mobile devices
- **Statistics Display**: Current best distance, running time, and algorithm sequence info
- **Milestone Preview**: Auto-load and preview the most efficient saved route on page load


## Usage

### Adding Points
- **Click** on the map to add a new point (automatically gets location name via reverse geocoding)
- **Search for places** by name in the search bar (e.g., "Eiffel Tower", "Times Square")
- **Drag** existing points to move them (location name updates automatically)
- **Right-click** on a point to delete it
- Use "CLEAR ALL POINTS" to remove all points
- All points show popups with their location names

### Saving & Comparing Routes
1. Run one or more algorithms to find a route (e.g., run Nearest Neighbor, then run 2-Opt to improve)
2. The milestone name is **automatically generated** based on your locations (updates as you add/remove points)
3. Edit the name if desired, then click "SAVE MILESTONE" to save the route
4. View all saved milestones in two places:
   - **In-app**: Bottom of the page in the "SAVED MILESTONES" panel
   - **GitHub Pages**: View all saved milestones at milestones-data.json
5. Each milestone shows:
   - Distance and point count
   - **All algorithms used in sequence** (e.g., "Nearest Neighbor → 2-Opt")
   - **Coordinates with names** for each point
   - Date and time saved
6. The best route (shortest distance) is marked with a 🏆
7. Load any saved milestone to view it again
8. Delete milestones you no longer need
9. Milestones are saved to browser localStorage and persist across sessions

### Running Algorithms
1. Add at least 3 points to the map
2. **Select a routing profile** from the ROUTING MEDIUM section (Car, Bus/Truck, Cycling, or Walking)
3. Select an algorithm from the list
4. **Hover over any algorithm** to see a detailed tooltip explaining:
   - How the algorithm works
   - Key strengths
   - Known weaknesses
5. Click the algorithm button to run it
6. **Construction algorithms** create an initial solution
7. **Refinement algorithms** improve upon the best existing solution
8. Paths display as straight lines during execution, then convert to actual routed paths when complete

### Algorithm Recommendations
- Start with **Nearest Neighbor** or **Convex Hull** for initial solutions
- Follow up with **2-Opt** to improve the solution
- Use **Genetic Algorithm** or **Simulated Annealing** for larger problems
- Experiment with different combinations for best results

### Visualization Options
- **Show Best Path**: Displays the current best solution in green
- **Show Evaluated Paths**: Shows intermediate solutions being evaluated in yellow
- **Show Evaluated Steps**: Provides detailed step visualization (for supported algorithms)

## File Structure

```
tsp/
├── index.html          # Main HTML file
├── styles.css          # CSS styles and responsive design
├── app.js              # Main application logic and Google Maps integration
├── algorithms.js       # TSP algorithm implementations
└── README.md          # This file
```

## Features

### Algorithms

1. **Nearest Neighbor**: Greedy construction algorithm
2. **Convex Hull**: Starts with convex hull then optimally inserts remaining points
3. **Genetic Algorithm**: Evolutionary approach with crossover and mutation
4. **2-Opt**: Local search improvement algorithm
5. **Simulated Annealing**: Probabilistic optimization technique

### Routing Profiles
Select different transportation modes to calculate realistic routes:
- **Car**: Standard driving routes optimized for cars
- **Bus/Truck**: Larger vehicles with different route preferences
- **Cycling**: Routes suitable for bicycles
- **Walking**: Pedestrian-friendly routes

Routes are calculated using OSRM (Open Source Routing Machine) with automatic fallback to GraphHopper and Valhalla if the primary service is unavailable.

### Milestone System
- Automatically generated names based on your locations
- Saves complete route information including:
  - Total distance
  - All points with coordinates and names
  - Algorithm sequence used
  - Timestamp
- Best route marked with 🏆
- Load, preview, delete, or download milestones as JSON
- Data persists in browser localStorage
