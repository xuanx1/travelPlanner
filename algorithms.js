// TSP Algorithms Implementation

class TSPAlgorithms {
    constructor() {
        this.points = [];
        this.bestPath = null;
        this.bestDistance = Infinity;
        this.isRunning = false;
        this.isPaused = false;
        this.currentAlgorithm = null;
        this.delay = 100;
        this.onUpdate = null;
        this.startTime = null;
    }

    setPoints(points) {
        this.points = points;
        this.bestPath = null;
        this.bestDistance = Infinity;
    }

    setDelay(delay) {
        this.delay = delay;
    }

    setUpdateCallback(callback) {
        this.onUpdate = callback;
    }

    calculateDistance(pointA, pointB) {
        const dx = pointA.lat - pointB.lat;
        const dy = pointA.lng - pointB.lng;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateTotalDistance(path) {
        if (path.length < 2) return 0;
        
        let total = 0;
        for (let i = 0; i < path.length - 1; i++) {
            total += this.calculateDistance(path[i], path[i + 1]);
        }
        // Return to start
        total += this.calculateDistance(path[path.length - 1], path[0]);
        return total;
    }

    factorial(n) {
        if (n <= 1) return 1;
        return n * this.factorial(n - 1);
    }

    async sleep() {
        if (this.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.delay));
        }
    }

    async waitIfPaused() {
        while (this.isPaused && this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    // Nearest Neighbor Algorithm
    async nearestNeighbor() {
        if (this.points.length < 2) return;

        this.isRunning = true;
        this.currentAlgorithm = 'Nearest Neighbor';
        this.startTime = Date.now();

        const unvisited = [...this.points];
        const path = [];
        
        // Start from first point
        let current = unvisited.shift();
        path.push(current);

        while (unvisited.length > 0 && this.isRunning) {
            await this.waitIfPaused();
            if (!this.isRunning) break;

            let nearest = null;
            let nearestDistance = Infinity;
            let nearestIndex = -1;

            // Find nearest unvisited point
            for (let i = 0; i < unvisited.length; i++) {
                const distance = this.calculateDistance(current, unvisited[i]);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearest = unvisited[i];
                    nearestIndex = i;
                }
            }

            if (nearest) {
                current = nearest;
                path.push(current);
                unvisited.splice(nearestIndex, 1);

                const totalDistance = this.calculateTotalDistance(path);
                if (totalDistance < this.bestDistance) {
                    this.bestDistance = totalDistance;
                    this.bestPath = [...path];
                }

                if (this.onUpdate) {
                    this.onUpdate({
                        currentPath: [...path],
                        bestPath: [...this.bestPath],
                        currentDistance: totalDistance,
                        bestDistance: this.bestDistance,
                        algorithm: this.currentAlgorithm
                    });
                }

                await this.sleep();
            }
        }

        this.isRunning = false;
    }

    // Convex Hull Algorithm (simplified)
    async convexHull() {
        if (this.points.length < 3) return;

        this.isRunning = true;
        this.currentAlgorithm = 'Convex Hull';
        this.startTime = Date.now();

        // Find convex hull points
        const hull = this.getConvexHull([...this.points]);
        const remaining = this.points.filter(p => !hull.includes(p));

        // Start with hull as path
        let path = [...hull];

        // Insert remaining points optimally
        for (const point of remaining) {
            if (!this.isRunning) break;
            await this.waitIfPaused();

            let bestPosition = 0;
            let bestIncrease = Infinity;

            for (let i = 0; i <= path.length; i++) {
                const testPath = [...path];
                testPath.splice(i, 0, point);
                const distance = this.calculateTotalDistance(testPath);
                const increase = distance - this.calculateTotalDistance(path);

                if (increase < bestIncrease) {
                    bestIncrease = increase;
                    bestPosition = i;
                }
            }

            path.splice(bestPosition, 0, point);
            const totalDistance = this.calculateTotalDistance(path);

            if (totalDistance < this.bestDistance) {
                this.bestDistance = totalDistance;
                this.bestPath = [...path];
            }

            if (this.onUpdate) {
                this.onUpdate({
                    currentPath: [...path],
                    bestPath: [...this.bestPath],
                    currentDistance: totalDistance,
                    bestDistance: this.bestDistance,
                    algorithm: this.currentAlgorithm
                });
            }

            await this.sleep();
        }

        this.isRunning = false;
    }

    getConvexHull(points) {
        // Graham scan algorithm
        if (points.length < 3) return points;

        // Find the bottom-most point
        let start = points.reduce((lowest, point) => 
            point.lat < lowest.lat || (point.lat === lowest.lat && point.lng < lowest.lng) 
                ? point : lowest
        );

        // Sort points by polar angle
        const sorted = points.filter(p => p !== start)
            .sort((a, b) => {
                const angleA = Math.atan2(a.lat - start.lat, a.lng - start.lng);
                const angleB = Math.atan2(b.lat - start.lat, b.lng - start.lng);
                return angleA - angleB;
            });

        const hull = [start];
        
        for (const point of sorted) {
            while (hull.length > 1 && this.crossProduct(
                hull[hull.length - 2], 
                hull[hull.length - 1], 
                point
            ) <= 0) {
                hull.pop();
            }
            hull.push(point);
        }

        return hull;
    }

    crossProduct(o, a, b) {
        return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
    }

    // 2-Opt Algorithm
    async twoOpt() {
        if (this.points.length < 4) return;

        this.isRunning = true;
        this.currentAlgorithm = '2-Opt';
        this.startTime = Date.now();

        // Use existing best path if available, otherwise start with current points
        let path = this.bestPath && this.bestPath.length > 0 ? [...this.bestPath] : [...this.points];
        
        // Initialize best distance if not set
        if (this.bestDistance === Infinity) {
            this.bestDistance = this.calculateTotalDistance(path);
            this.bestPath = [...path];
        }
        
        let improved = true;

        while (improved && this.isRunning) {
            await this.waitIfPaused();
            if (!this.isRunning) break;

            improved = false;
            
            for (let i = 1; i < path.length - 2 && this.isRunning; i++) {
                for (let j = i + 1; j < path.length && this.isRunning; j++) {
                    if (j - i === 1) continue; // Skip adjacent edges
                    
                    const newPath = [...path];
                    // Reverse the segment between i and j
                    const segment = newPath.slice(i, j + 1).reverse();
                    newPath.splice(i, j - i + 1, ...segment);
                    
                    const newDistance = this.calculateTotalDistance(newPath);
                    
                    if (newDistance < this.bestDistance) {
                        this.bestDistance = newDistance;
                        this.bestPath = [...newPath];
                        path = [...newPath];
                        improved = true;

                        if (this.onUpdate) {
                            this.onUpdate({
                                currentPath: [...path],
                                bestPath: [...this.bestPath],
                                currentDistance: newDistance,
                                bestDistance: this.bestDistance,
                                algorithm: this.currentAlgorithm
                            });
                        }

                        await this.sleep();
                    }
                }
            }
        }

        this.isRunning = false;
    }

    // Genetic Algorithm (simplified)
    async genetic() {
        if (this.points.length < 4) return;

        this.isRunning = true;
        this.currentAlgorithm = 'Genetic Algorithm';
        this.startTime = Date.now();

        const populationSize = Math.min(50, this.factorial(this.points.length - 1));
        const generations = 100;
        let population = this.generateInitialPopulation(populationSize);

        for (let gen = 0; gen < generations && this.isRunning; gen++) {
            await this.waitIfPaused();
            if (!this.isRunning) break;

            // Evaluate fitness
            const fitness = population.map(individual => ({
                path: individual,
                distance: this.calculateTotalDistance(individual)
            }));

            // Sort by fitness (lower distance is better)
            fitness.sort((a, b) => a.distance - b.distance);

            // Update best if improved
            if (fitness[0].distance < this.bestDistance) {
                this.bestDistance = fitness[0].distance;
                this.bestPath = [...fitness[0].path];
            }

            if (this.onUpdate) {
                this.onUpdate({
                    currentPath: [...fitness[0].path],
                    bestPath: [...this.bestPath],
                    currentDistance: fitness[0].distance,
                    bestDistance: this.bestDistance,
                    algorithm: this.currentAlgorithm
                });
            }

            // Create next generation
            const newPopulation = [];
            
            // Keep best individuals (elitism)
            for (let i = 0; i < populationSize * 0.2; i++) {
                newPopulation.push([...fitness[i].path]);
            }

            // Generate offspring
            while (newPopulation.length < populationSize) {
                const parent1 = this.tournamentSelection(fitness);
                const parent2 = this.tournamentSelection(fitness);
                const offspring = this.crossover(parent1, parent2);
                this.mutate(offspring);
                newPopulation.push(offspring);
            }

            population = newPopulation;
            await this.sleep();
        }

        this.isRunning = false;
    }

    generateInitialPopulation(size) {
        const population = [];
        for (let i = 0; i < size; i++) {
            const individual = [...this.points];
            // Shuffle array
            for (let j = individual.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [individual[j], individual[k]] = [individual[k], individual[j]];
            }
            population.push(individual);
        }
        return population;
    }

    tournamentSelection(fitness) {
        const tournamentSize = 3;
        let best = fitness[Math.floor(Math.random() * fitness.length)];
        
        for (let i = 1; i < tournamentSize; i++) {
            const candidate = fitness[Math.floor(Math.random() * fitness.length)];
            if (candidate.distance < best.distance) {
                best = candidate;
            }
        }
        
        return [...best.path];
    }

    crossover(parent1, parent2) {
        // Order crossover (OX)
        const start = Math.floor(Math.random() * parent1.length);
        const end = Math.floor(Math.random() * (parent1.length - start)) + start;
        
        const offspring = new Array(parent1.length);
        
        // Copy segment from parent1
        for (let i = start; i <= end; i++) {
            offspring[i] = parent1[i];
        }
        
        // Fill remaining positions with parent2's order
        let p2Index = 0;
        for (let i = 0; i < offspring.length; i++) {
            if (offspring[i] === undefined) {
                while (offspring.includes(parent2[p2Index])) {
                    p2Index++;
                }
                offspring[i] = parent2[p2Index];
                p2Index++;
            }
        }
        
        return offspring;
    }

    mutate(individual) {
        const mutationRate = 0.02;
        
        if (Math.random() < mutationRate) {
            // Swap mutation
            const i = Math.floor(Math.random() * individual.length);
            const j = Math.floor(Math.random() * individual.length);
            [individual[i], individual[j]] = [individual[j], individual[i]];
        }
    }

    // Simulated Annealing
    async simulatedAnnealing() {
        if (this.points.length < 2) return;

        this.isRunning = true;
        this.currentAlgorithm = 'Simulated Annealing';
        this.startTime = Date.now();

        let currentPath = [...this.points];
        let currentDistance = this.calculateTotalDistance(currentPath);
        
        const maxIterations = 10000;
        const initialTemp = 1000;
        const finalTemp = 0.01;
        const coolingRate = Math.pow(finalTemp / initialTemp, 1 / maxIterations);

        let temperature = initialTemp;

        for (let iteration = 0; iteration < maxIterations && this.isRunning; iteration++) {
            await this.waitIfPaused();
            if (!this.isRunning) break;

            // Generate neighbor solution by swapping two random cities
            const newPath = [...currentPath];
            const i = Math.floor(Math.random() * newPath.length);
            const j = Math.floor(Math.random() * newPath.length);
            [newPath[i], newPath[j]] = [newPath[j], newPath[i]];

            const newDistance = this.calculateTotalDistance(newPath);
            const deltaDistance = newDistance - currentDistance;

            // Accept or reject the new solution
            if (deltaDistance < 0 || Math.random() < Math.exp(-deltaDistance / temperature)) {
                currentPath = newPath;
                currentDistance = newDistance;

                if (currentDistance < this.bestDistance) {
                    this.bestDistance = currentDistance;
                    this.bestPath = [...currentPath];
                }

                if (this.onUpdate) {
                    this.onUpdate({
                        currentPath: [...currentPath],
                        bestPath: [...this.bestPath],
                        currentDistance: currentDistance,
                        bestDistance: this.bestDistance,
                        algorithm: this.currentAlgorithm
                    });
                }
            }

            temperature *= coolingRate;
            
            if (iteration % 100 === 0) {
                await this.sleep();
            }
        }

        this.isRunning = false;
    }
}