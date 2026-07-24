/**
 * Shared types for the streaming course chunks (PROJECT.md §6). Kept three-free
 * where possible so obstacle logic stays testable. Obstacles live in (s, lateral)
 * space — the same curated-volume space the hero controller evades in (§3), NOT
 * the Rapier debris world.
 */
import type { Group } from 'three';

export type ObstacleKind = 'block' | 'vehicle' | 'jump' | 'slide' | 'gap' | 'rubble';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  sMin: number;
  sMax: number;
  latCenter: number;
  latHalf: number;
  yClear: number; // jump clearance / slide bar height
  resolved: boolean; // once the hero passes, don't retrigger
  promoted?: boolean; // rubble promoted from a warden-felled building
}

export interface BuildingInfo {
  id: number;
  center: [number, number, number]; // footprint center, base at y=0
  size: [number, number, number]; // w,h,d
  color: number;
  alive: boolean;
  lateral: number; // signed lateral of the building (for road-debris promotion)
  s: number; // arc-length of the building
}

export interface Chunk {
  index: number;
  s0: number;
  s1: number;
  group: Group;
  obstacles: Obstacle[];
  buildings: BuildingInfo[];
  destroyBuilding: (id: number) => void;
  dispose: () => void;
}
