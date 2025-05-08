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
    map: List[int]
    waypoints: List[Tuple[int, int]]
