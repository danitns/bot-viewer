from pydantic import BaseModel
from typing import List, Tuple

class Point(BaseModel):
    x: float
    y: float
    z: float

class MapMetaData(BaseModel):
    resolution: float
    width: int
    height: int
    origin: Point

class WaypointsRequest(BaseModel):
    info: MapMetaData
    start_heading: float
    waypoints: List[Tuple[int, int]]

class WaypointModel(BaseModel):
    x: float
    y: float
    z: float = 0.0
    yaw: float = 0.0  # in radians
    
class FollowWaypointsRequest(BaseModel):
    waypoints: List[WaypointModel]
    frame_id: str = "map"

class NavigationResponse(BaseModel):
    success: bool
    message: str
    waypoints_accepted: int
