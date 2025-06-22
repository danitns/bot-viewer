import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
from typing import List, Optional
import rclpy
import time
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult
import threading
from geometry_msgs.msg import PoseStamped
from .utils.utils import quaternion_from_euler

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

from server.models.precompute_request import PrecomputeRequest
from .models.waypoints_request import WaypointsRequest, FollowWaypointsRequest, NavigationResponse
from .services.optimizer import optimize_waypoints, precompute_graph
from .services.progress_checker import ProcessProgress
from fastapi.middleware.cors import CORSMiddleware

async def broadcast_to_websockets(process_type: str, progress_val: int, message: str, error: Optional[str] = None):
    """Async function to broadcast to all WebSocket connections"""
    if not active_connections:
        return
        
    status_message = {
        "type": "progress",
        "process": process_type,
        "progress": progress_val,
        "message": message,
        "timestamp": time.time()
    }
    
    if error:
        status_message["error"] = error
    
    # Send to all connected clients
    disconnected = []
    for connection in active_connections:
        try:
            await connection.send_text(json.dumps(status_message))
        except:
            disconnected.append(connection)
    
    # Remove disconnected clients
    for conn in disconnected:
        active_connections.remove(conn)

def schedule_broadcast(process_type: str, progress_val: int, message: str, error: Optional[str] = None):
    """Schedule a broadcast from a synchronous context"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(broadcast_to_websockets(process_type, progress_val, message, error))
    finally:
        loop.close()

ros_initialized = False
navigator = None
ros_thread = None
G = None
grid = None
optimized_order = None

current_process = None  # 'precomputation', 'optimization', 'navigation', or None
process_lock = threading.Lock()


# WebSocket connections
active_connections: List[WebSocket] = []

# Thread pool for blocking operations
executor = ThreadPoolExecutor(max_workers=2)

progress = ProcessProgress()
progress.add_callback(schedule_broadcast)

def init_ros():
    global ros_initialized, navigator
    
    rclpy.init()
    navigator = BasicNavigator()
    
    # Wait for Nav2 to be ready
    navigator.waitUntilNav2Active()
    
    ros_initialized = True
    
    # Keep ROS2 running
    while ros_initialized:
        rclpy.spin_once(navigator, timeout_sec=0.1)
        time.sleep(0.01)
    
    # Clean up when done
    navigator.destroy_node()
    rclpy.shutdown()

def start_ros_thread():
    global ros_thread
    ros_thread = threading.Thread(target=init_ros)
    ros_thread.daemon = True
    ros_thread.start()

def shutdown_ros():
    global ros_initialized
    ros_initialized = False
    if ros_thread:
        ros_thread.join(timeout=1.0)

# Start the ROS thread when the module is imported
start_ros_thread()

def run_precomputation(req: PrecomputeRequest):
    """Blocking precomputation function - runs in thread"""
    global current_process, G, grid
    
    try:        
        progress.update("precomputation", 0, "Starting precomputation...")
        
        grid, G = precompute_graph(req, progress)

        progress.update("precomputation", 100, "Finished precomputation...")
        
    except Exception as e:
        #progress.update("precomputation", 0, "Precomputation failed", str(e))
        raise
    finally:
        with process_lock:
            current_process = None

def run_optimization(req: WaypointsRequest):
    """Blocking optimization function - runs in thread"""
    global grid, G, optimized_order, current_process
    
    try:
        progress.update("optimization", 0, "Starting optimizitation...")
        optimized_order = optimize_waypoints(grid, G, req)
        progress.update("optimization", 100, "Optimization finished...")
    except Exception as e:
        progress.update("optimization", 0, "Optimization failed", str(e))
        raise
    finally:
        with process_lock:
            current_process = None

def run_navigation(req: FollowWaypointsRequest):
    """Blocking navigation function - runs in thread"""
    global navigator, ros_initialized, current_process
    
    try:        
        if not ros_initialized or navigator is None:
            raise Exception("ROS2 navigation system not initialized")
        
        if len(req.waypoints) == 0:
            raise Exception("No waypoints provided")
        
        progress.update("navigation", 0, "Starting navigation...")

        # Convert waypoints to PoseStamped messages
        pose_goals = []
        for i, wp in enumerate(req.waypoints):
            
            goal_pose = PoseStamped()
            goal_pose.header.frame_id = req.frame_id
            goal_pose.header.stamp = navigator.get_clock().now().to_msg()
            
            # Set position
            goal_pose.pose.position.x = wp.x
            goal_pose.pose.position.y = wp.y
            goal_pose.pose.position.z = wp.z
            
            # Set orientation from yaw
            q = quaternion_from_euler(0, 0, wp.yaw)
            goal_pose.pose.orientation.x = q[0]
            goal_pose.pose.orientation.y = q[1]
            goal_pose.pose.orientation.z = q[2]
            goal_pose.pose.orientation.w = q[3]
            
            pose_goals.append(goal_pose)

        navigator.followWaypoints(pose_goals)

        progress.update("navigation", 10, 
            f"Successfully sent {len(pose_goals)} waypoints to navigator")

        while not navigator.isTaskComplete():
            feedback = navigator.getFeedback()

        result = navigator.getResult()
        
        if result == TaskResult.SUCCEEDED:
            progress.update("navigation", 100, f"Navigation succeeded")
        elif result == TaskResult.CANCELED:
            progress.update("navigation", 100, f"Navigation cancelled")
        elif result == TaskResult.FAILED:
            progress.update("navigation", 100, f"Navigation failed")

        
    except Exception as e:
        raise
    finally:
        with process_lock:
            current_process = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws/progress")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    
    # Send current status on connection
    if progress.current:
        status_message = {
            "type": "progress",
            "process": progress.current,
            "progress": progress.progress,
            "message": progress.message,
            "timestamp": time.time()
        }
        if progress.error:
            status_message["error"] = progress.error
        
        await websocket.send_text(json.dumps(status_message))
    
    try:
        while True:
            # Keep connection alive with ping/pong
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

@app.get("/")
async def read_root():
    return {"Hello": "World"}

@app.post("/precompute")
async def precompute(req: PrecomputeRequest):
    global current_process

    with process_lock:
        if current_process is not None:
            raise HTTPException(status_code=409, 
                              detail=f"Another process is running: {current_process}")
        current_process = "precomputation"

    # Submit to thread pool
    executor.submit(run_precomputation, req)
    
    return {"success": True, "message": "Precomputation started"}

@app.post("/optimize")
async def optimize(req: WaypointsRequest):
    global current_process

    with process_lock:
        if current_process is not None:
            raise HTTPException(status_code=409, 
                              detail=f"Another process is running: {current_process}")
        current_process = "optimization"
        
    # Submit to thread pool
    executor.submit(run_optimization, req)

    return {"success": True, "message": "Optimization started"}

@app.get("/route")
async def route():
    return optimized_order


@app.post("/waypoints", response_model=NavigationResponse)
async def follow_waypoints(req: FollowWaypointsRequest):
    global current_process
    
    with process_lock:
        if current_process is not None:
            raise HTTPException(status_code=409, 
                              detail=f"Another process is running: {current_process}")
        current_process = "navigation"
    
    # Submit to thread pool
    executor.submit(run_navigation, req)
    
    return NavigationResponse(
        success=True,
        message="Navigation started",
        waypoints_accepted=len(req.waypoints)
    )

@app.get("/status")
async def get_status():
    """Get current process status"""
    return {
        "current_process": current_process,
        "progress": progress.progress,
        "message": progress.message,
        "error": progress.error
    }

@app.on_event("shutdown")
def shutdown_event():
    shutdown_ros()