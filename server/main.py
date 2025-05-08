from typing import Union

from fastapi import FastAPI
from .models.waypoints_request import WaypointsRequest
from .services.optimizer import optimize_waypoints
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
async def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}

@app.post("/optimize")
async def optimize(req: WaypointsRequest):
    correct_order = optimize_waypoints(req)
    return correct_order