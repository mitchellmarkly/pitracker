export type Assignment = {
  id: string;
  Character: string;
  Slot?: number | null;
  Region: string;
  Constellation: string;
  System: string;
  Planet: string;
  PlanetType: string;
  Resource: string;
  Active: boolean;
  Notes?: string;
};

export type ScanCell = {
  id: string;
  Region: string;
  Constellation: string;
  System: string;
  Planet: string;
  PlanetType: string;
  Resource: string;
  Value: number;
};

export type YieldLog = {
  id: string;
  Date: string;
  Product: string;
  Amount: number;
  Notes?: string;
};

export type CharacterProfile = {
  id: string;
  name: string;
  slotsTotal: number;
};

export type AppState = {
  version: 1;
  characters: CharacterProfile[];
  assignments: Assignment[];
  scans: ScanCell[];
  yields: YieldLog[];
};

export type HeatmapJsonV1 = {
  schemaVersion: 1;
  kind: "pi-heatmap";
  region: string;
  generatedAt?: string;
  resources?: string[];
  scans: Array<{
    Region?: string;
    Constellation?: string;
    System?: string;
    Planet?: string;
    PlanetType?: string;
    Resource?: string;
    Value?: number;
  }>;
};
