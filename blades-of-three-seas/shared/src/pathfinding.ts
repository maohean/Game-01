import { MAP_COLS, MAP_ROWS, TILE_SIZE } from "./constants.js";
import { isTileSolid } from "./collision.js";

export interface GridPoint {
  col: number;
  row: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

interface AStarNode {
  col: number;
  row: number;
  g: number;
  f: number;
  parent: AStarNode | null;
}

export function worldToTile(x: number, y: number): GridPoint {
  return {
    col: Math.max(0, Math.min(MAP_COLS - 1, Math.floor(x / TILE_SIZE))),
    row: Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(y / TILE_SIZE))),
  };
}

export function tileToWorld(col: number, row: number): WorldPoint {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

function findNearestWalkableTile(origin: GridPoint): GridPoint {
  if (!isTileSolid(origin.col, origin.row)) return origin;
  for (let radius = 1; radius <= 4; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const c = origin.col + dc;
        const r = origin.row + dr;
        if (!isTileSolid(c, r)) return { col: c, row: r };
      }
    }
  }
  return origin;
}

const DIRS: ReadonlyArray<{ dc: number; dr: number; cost: number }> = [
  { dc: 1, dr: 0, cost: 1 },
  { dc: -1, dr: 0, cost: 1 },
  { dc: 0, dr: 1, cost: 1 },
  { dc: 0, dr: -1, cost: 1 },
  { dc: 1, dr: 1, cost: 1.414 },
  { dc: 1, dr: -1, cost: 1.414 },
  { dc: -1, dr: 1, cost: 1.414 },
  { dc: -1, dr: -1, cost: 1.414 },
];

export function findPathAStar(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  maxExpandedNodes = 260
): WorldPoint[] {
  const start = findNearestWalkableTile(worldToTile(startX, startY));
  const goal = findNearestWalkableTile(worldToTile(goalX, goalY));

  if (start.col === goal.col && start.row === goal.row) {
    return [{ x: goalX, y: goalY }];
  }

  const open: AStarNode[] = [
    {
      col: start.col,
      row: start.row,
      g: 0,
      f: Math.hypot(goal.col - start.col, goal.row - start.row),
      parent: null,
    },
  ];

  const closed = new Set<number>();
  const bestG = new Map<number, number>();
  const keyOf = (c: number, r: number) => r * MAP_COLS + c;
  bestG.set(keyOf(start.col, start.row), 0);

  let bestNode = open[0];
  let expanded = 0;

  while (open.length > 0 && expanded < maxExpandedNodes) {
    let lowestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[lowestIdx].f) lowestIdx = i;
    }

    const current = open.splice(lowestIdx, 1)[0];
    const currKey = keyOf(current.col, current.row);
    if (closed.has(currKey)) continue;
    closed.add(currKey);
    expanded += 1;

    if (
      Math.hypot(goal.col - current.col, goal.row - current.row) <
      Math.hypot(goal.col - bestNode.col, goal.row - bestNode.row)
    ) {
      bestNode = current;
    }

    if (current.col === goal.col && current.row === goal.row) {
      bestNode = current;
      break;
    }

    for (const d of DIRS) {
      const nc = current.col + d.dc;
      const nr = current.row + d.dr;
      if (isTileSolid(nc, nr)) continue;

      if (d.dc !== 0 && d.dr !== 0) {
        if (
          isTileSolid(current.col + d.dc, current.row) ||
          isTileSolid(current.col, current.row + d.dr)
        ) {
          continue;
        }
      }

      const nKey = keyOf(nc, nr);
      if (closed.has(nKey)) continue;

      const tentativeG = current.g + d.cost;
      const prevG = bestG.get(nKey);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      bestG.set(nKey, tentativeG);
      open.push({
        col: nc,
        row: nr,
        g: tentativeG,
        f: tentativeG + Math.hypot(goal.col - nc, goal.row - nr),
        parent: current,
      });
    }
  }

  const waypoints: WorldPoint[] = [];
  let trace: AStarNode | null = bestNode;
  while (trace && trace.parent !== null) {
    waypoints.push(tileToWorld(trace.col, trace.row));
    trace = trace.parent;
  }
  waypoints.reverse();
  return waypoints.length > 0 ? waypoints : [{ x: goalX, y: goalY }];
}
