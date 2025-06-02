export type Waypoint = {
  x: number;
  y: number;
  theta: number;
};

export type UniversalWaypoint = { 
  canvasX: number; 
  canvasY: number; 
  rosX: number; 
  rosY: number 
};

export type CursorPosition = {
  canvasX: number;
  canvasY: number;
  rosX: number;
  rosY: number;
  clientX: number;
  clientY: number;
};

export type OptimizedWaypoint = {
  x: number;
  y: number;
  theta: number;
  idx: number;
};

export type Point = {
  x: number;
  y: number;
}

export type Marker = {
  x: number,
  y: number,
  color: {
    r: number,
    g: number,
    b: number,
    a: number
  }
  ns: string,
  text: string
}
