from ..models.waypoints_request import WaypointsRequest
import numpy as np
import heapq
from itertools import product
import math
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import matplotlib.pyplot as plt

def load_map(map, width, height, threshold=99):
    arr = np.array(map, dtype=np.uint8).reshape((height, width))
    arr = np.flipud(arr)

    print(arr.shape)

    free_grid = (arr == 0).astype(np.uint8)
    return free_grid

def dijkstra(grid, start, goal):
    """
    dijkstra on a 8-connected grid.
    grid: 2D array with 1=free, 0=obstacle
    start, goal: (row, col) tuples
    Returns list of (row, col) path coordinates.
    """
    h, w = grid.shape

    def row_col_to_index(r, c): return r * w + c
    def index_to_row_col(i): return divmod(i, w)

    start_index = row_col_to_index(*start)
    goal_index = row_col_to_index(*goal)

    distances = np.full(h * w, np.inf)
    prev_node = np.full(h * w, -1, dtype=int)
    distances[start_index] = 0
    priority_queue = [(0, start_index)]

    neighbors = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1),
                (-1, -1, math.sqrt(2)), (-1, 1, math.sqrt(2)),
                (1, -1, math.sqrt(2)), (1, 1, math.sqrt(2))]

    while priority_queue:
        dist, idx = heapq.heappop(priority_queue)
        if idx == goal_index:
            break
        if dist > distances[idx]:
            continue
        row, col = index_to_row_col(idx)
        for dr, dc, cost in neighbors:
            neighbor_row, neighbor_col = row + dr, col + dc
            if 0 <= neighbor_row < h and 0 <= neighbor_col < w and grid[neighbor_row, neighbor_col] == 1:
                v = row_col_to_index(neighbor_row, neighbor_col)
                alt = dist + cost
                if alt < distances[v]:
                    distances[v] = alt
                    prev_node[v] = idx
                    heapq.heappush(priority_queue, (alt, v))

    path = []
    idx = goal_index
    if (prev_node[idx] != -1) or (idx == start_index):
        while idx != -1:
            path.append(index_to_row_col(idx))
            idx = prev_node[idx]
        path.reverse()
    return path

def compute_distance_matrix(grid, points):
    """
    Compute all-pairs shortest path distances and store paths.
    Returns D (n x n) and paths (nested list of coordinate lists).
    """
    n = len(points)
    D = np.zeros((n, n), dtype=float)
    paths = [[[] for _ in range(n)] for _ in range(n)]
    for i, j in product(range(n), range(n)):
        if i == j:
            D[i, j] = 0
            paths[i][j] = [points[i]]
        else:
            path_ij = dijkstra(grid, points[i], points[j])
            D[i, j] = len(path_ij) - 1 if path_ij else np.inf
            paths[i][j] = path_ij
    return D, paths

def create_data_model(matrix):
    data = {}
    data["distance_matrix"] = matrix
    data["num_vehicles"] = 1
    data["depot"] = 0
    return data

def create_response(manager, routing, solution):
    """create response"""
    print(f"Objective: {solution.ObjectiveValue()} nodes")
    index = routing.Start(0)
    plan_output = "Route for vehicle 0:\n"
    route_distance = 0
    solution_array = []

    while not routing.IsEnd(index):
        idx_to_node = manager.IndexToNode(index)
        plan_output += f" {idx_to_node} ->"
        previous_index = index
        index = solution.Value(routing.NextVar(index))
        route_distance += routing.GetArcCostForVehicle(previous_index, index, 0)
        solution_array.append(idx_to_node)
    idx_to_node = manager.IndexToNode(index)
    plan_output += f" {idx_to_node}\n"
    solution_array.append(idx_to_node)
    plan_output += f"Route distance: {route_distance}nodes\n"
    obj = {}
    obj["distance"] = route_distance
    obj["index"] = index
    obj["plan_output"] = plan_output
    obj["solution_array"] = solution_array
    return obj


def optimize_waypoints(req: WaypointsRequest):
    # construct map
    h = req.info.height
    w = req.info.width
    grid = load_map(req.map, w, h)
    print(f"Loaded map ({h}x{w})")
    # construct dijkstra matrix
    points = req.waypoints

    D, paths = compute_distance_matrix(grid, points)
    print("Distance matrix D (rows->start, cols->goal):")
    print(D)

    # use google OR-Tools for tsp
    data = create_data_model(D)

    print(points)

    manager = pywrapcp.RoutingIndexManager(
        len(data["distance_matrix"]), data["num_vehicles"], data["depot"]
    )
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        """Returns the distance between the two nodes."""
        # Convert from routing variable Index to distance matrix NodeIndex.
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data["distance_matrix"][from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)

    # Define cost of each arc.
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Setting first solution heuristic.
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )

    # Solve the problem.
    solution = routing.SolveWithParameters(search_parameters)

    # Print solution on console.
    
    if not solution:
        return {"error": "No solution found"}
    
    return_object = create_response(manager, routing, solution)

    fig, ax = plt.subplots(figsize=(10, 10))
    ax.imshow(grid, cmap="gray")  # Show map: white=free, black=obstacle

    # Plot waypoints
    for idx, (y, x) in enumerate(points):
        ax.plot(x, y, 'bo') 
        ax.text(x + 0.5, y + 0.5, str(idx), color='blue', fontsize=8)

    # Draw the path following solution_array
    solution_path = return_object["solution_array"]
    for i in range(len(solution_path) - 1):
        from_idx = solution_path[i]
        to_idx = solution_path[i + 1]
        path_segment = paths[from_idx][to_idx]
        if path_segment:
            path_y, path_x = zip(*path_segment)
            ax.plot(path_x, path_y, 'r-')  # Red line for path

    ax.set_title("Optimized Path Through Waypoints")
    ax.set_axis_off()
    plt.savefig("optimized_path.png")
    plt.close()


    return return_object