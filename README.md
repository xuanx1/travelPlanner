# TSP Visualizer with OpenStreetMap

A web-based visualization tool for solving the Traveling Salesman Problem (TSP) using various algorithms, integrated with OpenStreetMap for realistic geographic visualization.

![TSP Visualizer Screenshot]()

## Features

- **Interactive OpenStreetMap Integration**: Click to place points, drag to move them, right-click to delete
- **Place Search**: Real-time search and add real locations by name using OpenStreetMap's geocoding
- **Save & Compare Milestones**: Save your best routes with complete stats including coordinates, place names, and full algorithm history
- **Algorithm Sequence Tracking**: Track all algorithms used to achieve the final route (e.g., Nearest Neighbor → 2-Opt)
- **Multiple TSP Algorithms**:
  - Nearest Neighbor (Construction algorithm)
  - Convex Hull (Construction algorithm)  
  - Genetic Algorithm (Metaheuristic)
  - 2-Opt (Local improvement)
  - Simulated Annealing (Metaheuristic)
- **Real-time Visualization**: Watch algorithms solve the problem step-by-step (100ms per iteration)
- **Algorithm Controls**: Run, pause, and stop execution
- **Path Visualization Options**: Toggle best path and evaluated paths
- **Responsive Design**: Works on desktop and mobile devices
- **Statistics Display**: Current best distance, running time, and algorithm sequence info


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
4. View all saved milestones at the bottom of the page
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
2. Select an algorithm from the list
3. Adjust the delay slider to control visualization speed
4. Click "RUN" to start the algorithm
5. Use "PAUSE"/"RESUME" and "STOP" to control execution

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

## Technical Details

### Algorithms Implemented

1. **Nearest Neighbor**: Greedy construction algorithm
2. **Convex Hull**: Starts with convex hull then optimally inserts remaining points
3. **Genetic Algorithm**: Evolutionary approach with crossover and mutation
4. **2-Opt**: Local search improvement algorithm
5. **Simulated Annealing**: Probabilistic optimization technique

### Algorithms
Add new algorithms by extending the `TSPAlgorithms` class in `algorithms.js`. Implement the algorithm method and add UI controls in `index.html`.

- For best performance, limit points to under 20 for complex algorithms
- The Genetic Algorithm is optimized for problems with 4-50 points
- 2-Opt works well for local improvements on any size problem
- Adjust the delay slider for faster execution on larger problems