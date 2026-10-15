export interface GraphEdge {
  node: number;
  weight: number; // travel distance (km) or duration
}

export interface RoadNetworkGraph {
  [nodeId: number]: GraphEdge[];
}

export interface RoadNodeInfo {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
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
  coordinates?: [number, number][];
  waypoints?: RoadNodeInfo[];
}