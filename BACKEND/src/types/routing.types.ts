export interface GraphEdge {
  node: number;
  weight: number; // travel time (seconds) ya distance (meters)
}

export interface RoadNetworkGraph {
  [nodeId: number]: GraphEdge[];
}

export interface RouteCalculationInput {
  startNode: number;
  endNode: number;
  graph: RoadNetworkGraph;
}

export interface RouteCalculationOutput {
  path: number[];
  distance: number;
  etaSeconds: number;
}