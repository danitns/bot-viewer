from networkx import DiGraph
from server.models.precompute_request import PrecomputeRequest
from server.services.progress_checker import ProcessProgress
from ..models.waypoints_request import WaypointsRequest
import numpy as np
import math
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import matplotlib.pyplot as plt
from scipy.spatial import KDTree
import networkx as nx
import pickle
from collections import defaultdict, namedtuple
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

State = namedtuple('State', ['x', 'y', 'theta'])

def load_map(map, width, height):
    arr = np.array(map, dtype=np.uint8).reshape((height, width))
    arr = np.flipud(arr)

    print(arr.shape)

    return arr

def normalize_angle_to_minus_pi_pi(angle):
    """Convert angle from [0, 2π] to [-π, π]"""
    # normalize to [0, 2π]
    angle = angle % (2 * math.pi)
    # shift to [-π, π]
    if angle > math.pi:
        angle -= 2 * math.pi
    return angle

def create_response(    
    tour: List[int],
    total_cost: float,
    waypoints: List[Tuple[float,float]],
    headings: List[float],
    index_map: Dict[Tuple[int,int],int],
    path_points):
    """create response"""
    inv_map = {v: k for k, v in index_map.items()}

    waypoint_order = []
    solution_array = []

    for node_idx in tour:
        wp_idx, heading_idx = inv_map[node_idx]
        x, y = waypoints[wp_idx]
        theta = headings[heading_idx]
        
        # record the raw state
        solution_array.append({
            "x": x,
            "y": y,
            "theta": theta
        })
        # record only the waypoint index (skip repeats if you like)
        waypoint_order.append(wp_idx)

    return {
        "distance": total_cost,
        "waypoint_order": waypoint_order,
        "solution_array": solution_array,
        "path_points": path_points
    }

def find_best_snap(
    end_x: float,
    end_y: float,
    end_theta: float,
    node_kdtree: KDTree,
    xy_coords: np.ndarray,
    position_to_nodes: Dict[Tuple[float,float], List[State]],
    node_spacing: float,
    turning_radius: float,
    k: int = 10
) -> Optional[State]:
    """
    Snap to the nearest even-positioned node with minimal combined (positional+heading) cost.
    Only considers nodes at even coordinate positions (x, y).
    """
    # 1) Round to nearest even position
    snapped_x = round(end_x / 2) * 2
    snapped_y = round(end_y / 2) * 2
    
    # 2) Check if this position exists in our graph
    if (snapped_x, snapped_y) not in position_to_nodes:
        # If not available, we could check other nearby even positions
        # But for simplicity, let's return None if exact snap point doesn't exist
        return None
    
    # 3) Find best heading at this position
    best, bestd = None, float('inf')
    for candidate in position_to_nodes[(snapped_x, snapped_y)]:
        # Calculate positional distance
        dist = math.hypot(candidate.x - end_x, candidate.y - end_y)
        
        # Calculate angular distance (shortest path)
        dth = abs(candidate.theta - end_theta)
        dth = min(dth, 2*math.pi - dth)
        
        # Combined cost
        cost = dist + turning_radius * dth
        if cost < bestd:
            best, bestd = candidate, cost
    
    return best

def build_lattice_graph_from_pgm(
    map: str,
    node_spacing: float,
    n_headings: int,
    turning_radius: float,
    primitive_length: float,
    progress_logger: ProcessProgress,
    nb_points: int = 20,
    reverse_penalty_factor: float = 1.9
) -> nx.DiGraph:
    """
    build a state lattice graph from a PGM occupancy map.
    """
    occ = (map > 0)
    h, w = occ.shape
    headings = [
        ((2 * math.pi * i / n_headings) + math.pi) % (2*math.pi) - math.pi
        for i in range(n_headings)
    ]

    @lru_cache(maxsize=1024)
    def is_collision(x, y):
        ix = int(round(x))
        iy = int(round(y))
        return ix < 0 or ix >= w or iy < 0 or iy >= h or occ[iy, ix]

    def collision(path):
        step = max(1, len(path) // 5)  # Check  5 points along path
        for i in range(0, len(path), step):
            x, y = path[i]
            if is_collision(x, y):
                return True
        # Always check endpoint
        x, y = path[-1]
        return is_collision(x, y)

    def make_backward_primitive(forward_path, forward_end, end_heading):
        """generate backward primitive from forward primitive"""
        # reverse the sampling, then shift so that the first point is (0,0)
        bx = [ x - forward_end[0] for x, _ in reversed(forward_path) ]
        by = [ y - forward_end[1] for _, y in reversed(forward_path) ]
        return State(bx[-1], by[-1], end_heading), list(zip(bx, by))

    def generate_primitives():
        prim_templates = {}
        for th0 in headings:
            # straight
            xs = np.linspace(0, primitive_length * math.cos(th0), nb_points)
            ys = np.linspace(0, primitive_length * math.sin(th0), nb_points)
            straight_path = list(zip(xs, ys))
            straight_end = State(xs[-1], ys[-1], th0)
            
            # left
            dth = primitive_length / turning_radius
            thetas = np.linspace(0, dth, nb_points)
            cx = -turning_radius * math.sin(th0)
            cy = turning_radius * math.cos(th0)
            left_path = [(cx + turning_radius * math.sin(th0 + t), cy - turning_radius * math.cos(th0 + t)) for t in thetas]
            left_end = State(left_path[-1][0], left_path[-1][1], (th0 + dth) % (2*math.pi))
            
            # right
            thetas = np.linspace(0, dth, nb_points)
            cx = turning_radius * math.sin(th0)
            cy = -turning_radius * math.cos(th0)
            right_path = [(cx - turning_radius * math.sin(th0 - t), cy + turning_radius * math.cos(th0 - t)) for t in thetas]
            right_end = State(right_path[-1][0], right_path[-1][1], (th0 - dth) % (2*math.pi))

             # backward straight
            b_end,  b_path  = make_backward_primitive(straight_path,
                                            (straight_end.x, straight_end.y),
                                            th0)

            # backward left
            lb_end, lb_path = make_backward_primitive(
                right_path,
                (right_end.x, right_end.y),
                (th0 + dth) % (2*math.pi)
            )

            # backward right
            rb_end, rb_path = make_backward_primitive(
                left_path,
                (left_end.x, left_end.y),
                (th0 - dth) % (2*math.pi)
            )
            
            prim_templates[th0] = {
                'S': (straight_end, straight_path),
                'L': (left_end, left_path),
                'R': (right_end, right_path),
                'B' : (b_end,  b_path),
                'LB': (lb_end, lb_path),
                'RB': (rb_end, rb_path),
            }
        return prim_templates
    
    def get_valid_positions():
        """generate valid (x, y) positions"""
        xs = np.arange(0, w, node_spacing)
        ys = np.arange(0, h, node_spacing)

        xv, yv = np.meshgrid(xs, ys)
        xv = xv.flatten()
        yv = yv.flatten()

        ixs = np.round(xv).astype(int)
        iys = np.round(yv).astype(int)

        mask = (
            (0 <= ixs) & (ixs < w) &
            (0 <= iys) & (iys < h) &
            (~occ[iys, ixs])
        )
        return list(zip(xv[mask], yv[mask]))

    valid_positions = get_valid_positions()

    # create nodes for valid positions
    all_nodes = [State(x, y, th) for x, y in valid_positions for th in headings]

    # add nodes in graph
    G = nx.DiGraph()
    G.add_nodes_from(all_nodes)

    xy_coords = np.array([(node.x, node.y) for node in all_nodes])
    node_kdtree = KDTree(xy_coords)

    position_to_nodes = defaultdict(list)
    for node in all_nodes:
        position_to_nodes[(node.x, node.y)].append(node)

    progress_logger.update("precomputation", 50, f"Applying primitives...")

    prim_templates = generate_primitives()
    
    # apply primitives to create edges
    # process in batches to improve locality
    batch_size = 100
    for i in range(0, len(all_nodes), batch_size):
        batch_nodes = all_nodes[i:i+batch_size]
        
        for s in batch_nodes:
            th0 = s.theta
            templates = prim_templates[th0]
            
            for name, (template_end, template_path) in templates.items():
                # apply primitive
                actual_path = [(s.x + x, s.y + y) for x, y in template_path]
                end_x = s.x + template_end.x
                end_y = s.y + template_end.y
                end_theta = template_end.theta
                
                # skip collision
                if collision(actual_path):
                    continue
                
                # search nearest node for snapping
                best = find_best_snap(
                    end_x, end_y, end_theta,
                    node_kdtree, xy_coords, position_to_nodes,
                    node_spacing, turning_radius, k=10
                )
                
                # add edge if found valid snap target
                if best is not None and math.hypot(best.x - end_x, best.y - end_y) <= node_spacing * 0.6:
                    # calculate edge cost (distance along path)
                    cost = sum(math.hypot(actual_path[i+1][0]-actual_path[i][0], 
                                         actual_path[i+1][1]-actual_path[i][1])
                              for i in range(len(actual_path)-1))
                    
                    # apply penalty for reverse motions
                    if name in ['B', 'LB', 'RB']:  # reverse primitives
                        cost *= reverse_penalty_factor

                    G.add_edge(s, best, primitive=name, cost=cost)
    return G

def build_state_list(waypoints, headings, start_heading_idx = None):
    """
    Generate ordered list of all (waypoint_index, heading_index).
    If start_heading_idx is provided, only include that specific heading for the first waypoint.
    """
    state_list = []
    
    if start_heading_idx is not None:
        state_list.append((0, start_heading_idx))
    else:
        for hi in range(len(headings)):
            state_list.append((0, hi))
    
    for i in range(1, len(waypoints)):
        for hi in range(len(headings)):
            state_list.append((i, hi))
    
    return state_list

def compute_cost_matrix(G, waypoints, headings, start_heading_idx = None, scale=1000, unreachable_cost=1e9):
    """
    Compute an MxM cost matrix of Reeds-Shepp (or Dubins) distances between all state pairs.
    Uses single-source Dijkstra per origin state for efficiency.
    """
    VERY_LARGE = int(1e9)
    N = len(waypoints)
    H = len(headings)
    state_list = build_state_list(waypoints, headings, start_heading_idx)
    M = len(state_list)
    index_map = {state_list[k]: k for k in range(M)}

    # Initialize matrix with unreachable costs
    cost_matrix = [[int(unreachable_cost)] * M for _ in range(M)]

    # For each origin state, run single-source Dijkstra
    for idx, (i, hi) in enumerate(state_list):
        # origin State
        x0, y0 = waypoints[i]
        th0 = headings[hi]
        s0 = State(x0, y0, th0)
        # Compute lengths to all reachable nodes
        lengths = nx.single_source_dijkstra_path_length(G, s0, weight='cost')
        # Fill row idx
        for jdx, (j, hj) in enumerate(state_list):
            x1, y1 = waypoints[j]
            th1 = headings[hj]
            s1 = State(x1, y1, th1)
            d = lengths.get(s1, math.inf)
            cost_matrix[idx][jdx] = int(d * scale) if d < math.inf else int(unreachable_cost)
            if i == j:
                cost_matrix[idx][jdx] = VERY_LARGE

    return cost_matrix, index_map

def run_or_tools(cost_matrix, index_map, N, H, depot_index):
    """Set up and solve the TSP on the provided cost_matrix with OR-Tools, enforcing one state per waypoint."""
    modified_cost_matrix = modify_cost_matrix_for_open_tour(cost_matrix, index_map, start_waypoint_idx=0)

    M = len(modified_cost_matrix)
    manager = pywrapcp.RoutingIndexManager(M, 1, depot_index)
    routing = pywrapcp.RoutingModel(manager)

    # Transit callback
    def cost_cb(from_index, to_index):
        i = manager.IndexToNode(from_index)
        j = manager.IndexToNode(to_index)
        return modified_cost_matrix[i][j]

    cb_idx = routing.RegisterTransitCallback(cost_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(cb_idx)

    # Enforce at most one state per waypoint, and force visiting each waypoint once via large penalty
    PENALTY = int(1e8)
    VERY_LARGE = int(1e9)
    for wp in range(1, N):  # Skip first waypoint as it has a fixed heading
        state_idxs = []
        for (i, _), idx in index_map.items():
            if i == wp:
                state_idxs.append(manager.NodeToIndex(idx))
        routing.AddDisjunction(state_idxs, PENALTY)

    for wp in range(1, N):  # Skip first waypoint as it has fixed heading
        state_idxs = [manager.NodeToIndex(index_map[(wp, h)]) 
                     for h in range(H) if (wp, h) in index_map]
        routing.AddDisjunction(state_idxs, VERY_LARGE)

    # # Prevent return to depot (open tour)
    # routing.AddVariableMinimizedByFinalizer(routing.End(0))

    # Search parameters
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)

    solution = routing.SolveWithParameters(params)
    if not solution:
        return None, None

    # Extract tour
    idx = routing.Start(0)
    tour = []
    cost = 0
    while not routing.IsEnd(idx):
        node = manager.IndexToNode(idx)
        tour.append(node)
        next_idx = solution.Value(routing.NextVar(idx))
        
        # nly add cost if we're not at the end
        if not routing.IsEnd(next_idx):
            next_node = manager.IndexToNode(next_idx)
            cost += cost_matrix[node][next_node]  # use original costs for reporting
        
        idx = next_idx
    return tour, cost

def modify_cost_matrix_for_open_tour(cost_matrix, index_map, start_waypoint_idx=0):
    """
    Modify the cost matrix to eliminate return costs to the starting waypoint.
    Sets all costs TO the starting waypoint states to zero, effectively making
    the return "free" so OR-Tools ignores it in optimization.
    """
    modified_matrix = [row[:] for row in cost_matrix]
    
    start_state_indices = []
    for (wp_idx, _), matrix_idx in index_map.items():
        if wp_idx == start_waypoint_idx:
            start_state_indices.append(matrix_idx)
    
    for i in range(len(modified_matrix)):
        for start_idx in start_state_indices:
            modified_matrix[i][start_idx] = 0  
    
    return modified_matrix

def plot_or_tools_path(G, waypoints, headings, tour, grid, turning_radius, start_heading_idx = None, save_path=None):
    """
    Plot the final path from OR-Tools TSP solution.
    
    Args:
        G: The lattice graph
        waypoints: List of [x,y] waypoint coordinates
        headings: List of heading angles
        tour: The tour returned by OR-Tools as indices
        grid: np array with map
        turning_radius: Minimum turning radius (used for finding nearest nodes)
        save_path: Optional path to save the plot
    """
    
    # Create state list mapping
    state_list = build_state_list(waypoints, headings, start_heading_idx)
    
    # Create inverse mapping from index to (waypoint, heading) pair
    inv_map = {idx: state_list[idx] for idx in range(len(state_list))}
    
    # Convert tour indices to (waypoint, heading) pairs
    state_tour = [inv_map[idx] for idx in tour]
    
    # Convert state tour to actual State objects
    states = []
    for wp_idx, heading_idx in state_tour:
        x, y = waypoints[wp_idx]
        theta = headings[heading_idx]
        states.append(State(x, y, theta))

    # Find paths between consecutive nodes
    paths = []
    for i in range(len(states) - 1):
        try:
            path = nx.shortest_path(G, states[i], states[i+1], weight='cost')
            paths.append(path)
            print(f"Found path from waypoint {state_tour[i][0]} to waypoint {state_tour[i+1][0]}")
        except nx.NetworkXNoPath:
            print(f"No path found between states {i} and {i+1}")
    
    # Plot the paths
    plt.figure(figsize=(12, 12))
    plt.imshow(grid, cmap='gray_r', origin='upper')
    
    # Plot waypoints
    wp_x = [wp[0] for wp in waypoints]
    wp_y = [wp[1] for wp in waypoints]
    plt.scatter(wp_x, wp_y, c='blue', s=80, marker='o', label='Waypoints')
    
    # Plot all path segments as one connected path
    all_x = []
    all_y = []
    for path in paths:
        xs = [s.x for s in path]
        ys = [s.y for s in path]
        all_x.extend(xs)
        all_y.extend(ys)
    
    plt.plot(all_x, all_y, '-r', linewidth=2, label='Complete Path')
    
    # Mark start and end of the complete path
    if paths:
        plt.scatter([paths[0][0].x], [paths[0][0].y], c='green', s=80, marker='o', label='Start')
        plt.scatter([paths[-1][-1].x], [paths[-1][-1].y], c='red', s=80, marker='x', label='End')
    
    # Show orientations at waypoints
    for state, (wp_idx, heading_idx) in zip(states, state_tour):
        # Draw orientation arrows
        arrow_length = 0.3 
        dx = arrow_length * math.cos(state.theta)
        dy = arrow_length * math.sin(state.theta)
        plt.arrow(state.x, state.y, dx, dy, head_width=0.1, head_length=0.1, 
                  fc='orange', ec='orange', alpha=0.7)
    
    plt.legend()
    plt.title('TSP Solution Path')
    plt.axis('equal')
    
    if save_path:
        plt.savefig(save_path, dpi=300)
        print(f"Plot saved to {save_path}")


    path_points = [{"x": float(x), "y": float(y)} for x, y in zip(all_x, all_y)]
    
    return paths, path_points

def process_waypoints(raw_waypoints):
    return raw_waypoints

def precompute_graph(req: PrecomputeRequest, progress: ProcessProgress):
    node_spacing = 2
    theta_bins = 16
    min_turning_radius = 12
    primitive_length = 4

    # construct map
    h = req.info.height
    w = req.info.width
    grid = load_map(req.map, w, h)
    print(f"Loaded map ({h}x{w})")
    progress.update("precomputation", 25, f"Loaded map ({h}x{w})")

    G = build_lattice_graph_from_pgm(
        grid,
        node_spacing,
        theta_bins,
        min_turning_radius,
        primitive_length,
        progress
    )

    with open("map.pkl", 'wb') as f:
        pickle.dump(G, f, pickle.HIGHEST_PROTOCOL)

    return grid, G

def optimize_waypoints(grid, G: DiGraph, req: WaypointsRequest):
    # const variables
    resolution = req.info.resolution
    theta_bins = 16
    min_turning_radius = 12


    ros_yaw = req.start_heading

    # 2) shift it into [0,2π):
    yaw_0_2pi = ros_yaw % (2.0 * math.pi)

    # compute headings and find the start heading index
    headings = [
        ((2 * math.pi * i / theta_bins) + math.pi) % (2*math.pi) - math.pi
        for i in range(theta_bins)
    ]
    start_heading_idx = min(range(len(headings)), 
        key = lambda i: min(abs(headings[i] - ros_yaw), 
        2*math.pi - abs(headings[i] - ros_yaw)))
    
    print(headings[start_heading_idx])

    waypoints = process_waypoints(req.waypoints)

    cost_matrix, index_map = compute_cost_matrix(
        G, 
        waypoints, 
        headings, 
        start_heading_idx=start_heading_idx
    )

    print(f"Lattice stored with {G.number_of_nodes()} nodes to maps folder")

    tour, raw_cost = run_or_tools(cost_matrix, index_map, len(waypoints), theta_bins, 0)
    
    if not tour:
        return {"error": "No solution found"}
    

    inv_map = {v: k for k, v in index_map.items()}
    state_tour = [inv_map[idx] for idx in tour]
    print(f'Tour in state-list indices: {tour}')
    print(f'Tour as (waypoint,heading) pairs: {state_tour}')
    print(f'Total scaled cost: {raw_cost}')
    print(f'Total distance: ${raw_cost * resolution}')
    paths, path_points = plot_or_tools_path(
        G, 
        waypoints, 
        headings, 
        tour, 
        grid,
        min_turning_radius,
        start_heading_idx=start_heading_idx,
        save_path="tsp_solution_path.png"
    )

    total_distance = 0
    for path in paths:
        for i in range(len(path) - 1):
            edge_data = G.get_edge_data(path[i], path[i+1])
            if edge_data:
                total_distance += edge_data.get('cost', 0)
    
    return_object = create_response(tour, total_distance, waypoints, headings, index_map, path_points)
    
    return return_object