import { characterHasColonyOnPlanet, nextOpenSlot } from "../src/lib/characters.js";
import type { Assignment } from "../src/types.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function testNextOpenSlotSelection(): void {
  const assignments: Assignment[] = [
    {
      id: "a1",
      Character: "Pilot A",
      Slot: 1,
      Region: "Delve",
      Constellation: "X",
      System: "1DQ",
      Planet: "P1",
      PlanetType: "Temperate",
      Resource: "Aqueous Liquids",
      Active: true,
    },
    {
      id: "a2",
      Character: "Pilot A",
      Slot: 3,
      Region: "Delve",
      Constellation: "X",
      System: "1DQ",
      Planet: "P2",
      PlanetType: "Storm",
      Resource: "Ionic Solutions",
      Active: true,
    },
  ];

  assertEqual(nextOpenSlot(assignments, "Pilot A", 4), 2, "nextOpenSlot should return first gap");
  assertEqual(nextOpenSlot(assignments, "Pilot A", 2), 2, "nextOpenSlot should ignore out-of-range used slots");
  assertEqual(nextOpenSlot(assignments, "Pilot B", 2), 1, "nextOpenSlot should start at slot 1 for new character");
}

function testDuplicatePlanetPerCharacterPrevention(): void {
  const assignments: Assignment[] = [
    {
      id: "a1",
      Character: "Pilot A",
      Slot: 1,
      Region: "Delve",
      Constellation: "X",
      System: "1DQ1-A",
      Planet: "P1",
      PlanetType: "Temperate",
      Resource: "Aqueous Liquids",
      Active: true,
    },
  ];

  assertEqual(
    characterHasColonyOnPlanet(assignments, "Pilot A", "1DQ1-A", "P1"),
    true,
    "exact duplicate should be detected"
  );
  assertEqual(
    characterHasColonyOnPlanet(assignments, " pilot a ", " 1dq1-a", "p1 "),
    true,
    "duplicate check should be case-insensitive and trim whitespace"
  );
  assertEqual(
    characterHasColonyOnPlanet(assignments, "Pilot B", "1DQ1-A", "P1"),
    false,
    "different character should not conflict"
  );
}

function run(): void {
  testNextOpenSlotSelection();
  testDuplicatePlanetPerCharacterPrevention();
  console.log("All assignment rule tests passed.");
}

run();
