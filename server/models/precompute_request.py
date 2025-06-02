from pydantic import BaseModel
from typing import List
from server.models.waypoints_request import MapMetaData

class PrecomputeRequest(BaseModel):
    info: MapMetaData
    map: List[int]
