import { parentPort, workerData } from 'worker_threads';
import type { RouteCalculationInput, RouteCalculationOutput, RoadNetworkGraph } from '../types/routing.types.js';

// Simple Priority Queue implementation for Dijkstra
class MinPriorityQueue {
  private heap: Array<{ node: number; priority: number }> = [];

  enqueue(node: number, priority: number) {
    this.heap.push({ node, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): { node: number; priority: number } | null {
    if (this.heap.length === 0) return null;
    const min = this.heap[0];
    const end = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = end;
      this.sinkDown(0);
    }
    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (element.priority >= parent.priority) break;
      this.heap[index] = parent;
      index = parentIndex;
    }
    this.heap[index] = element;
  }

  private sinkDown(index: number) {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      let leftChildIndex = 2 * index + 1;
      let rightChildIndex = 2 * index + 2;
      let swapIndex: number | null = null;

      if (leftChildIndex < length) {
        if (this.heap[leftChildIndex].priority < element.priority) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        if (
          (swapIndex === null && this.heap[rightChildIndex].priority < element.priority) ||
          (swapIndex !== null && this.heap[rightChildIndex].priority < this.heap[leftChildIndex].priority)
        ) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === null) break;
      this.heap[index] = this.heap[swapIndex];
      index = swapIndex;
    }
    this.heap[index] = element;
  }
}

function calculateDijkstra(graph: RoadNetworkGraph, start: number, end: number): RouteCalculationOutput {
  const distances: Record<number, number> = {};
  const previous: Record<number, number | null> = {};
  const pq = new MinPriorityQueue();

  for (const nodeKey in graph) {
    const node = Number(nodeKey);
    distances[node] = Infinity;
    previous[node] = null;
  }

  distances[start] = 0;
  pq.enqueue(start, 0);

  while (!pq.isEmpty()) {
    const current = pq.dequeue();
    if (!current) break;

    const u = current.node;

    if (u === end) break; // Destination reached
    if (current.priority > distances[u]) continue;

    const neighbors = graph[u] || [];
    for (const edge of neighbors) {
      const v = edge.node;
      const weight = edge.weight;
      const alt = distances[u] + weight;

      if (alt < (distances[v] ?? Infinity)) {
        distances[v] = alt;
        previous[v] = u;
        pq.enqueue(v, alt);
      }
    }
  }

  // Path reconstruction
  const path: number[] = [];
  let curr: number | null = end;

  if (distances[end] !== Infinity && distances[end] !== undefined) {
    while (curr !== null) {
      path.unshift(curr);
      curr = previous[curr] ?? null;
    }
  }

  const totalCost = distances[end] === Infinity || distances[end] === undefined ? -1 : distances[end];

  // Realistic city transit ETA: 28 km/h average traffic speed -> seconds = (km / 28) * 3600
  const etaSeconds = totalCost > 0 ? Math.round((totalCost / 28) * 3600) : 0;

  return {
    path,
    distance: totalCost,
    etaSeconds,
  };
}

// Worker message handling
if (parentPort && workerData) {
  const { graph, startNode, endNode } = workerData as RouteCalculationInput;
  const result = calculateDijkstra(graph, startNode, endNode);
  parentPort.postMessage(result);
}