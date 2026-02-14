import { z } from 'zod';
export declare const characterSchema: any;
export declare const assignmentSchema: any;
export declare const scanSchema: any;
export declare const yieldSchema: any;
export declare const marketSettingsSchema: any;
export declare const importPayloadSchema: any;
export type Character = z.infer<typeof characterSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type Scan = z.infer<typeof scanSchema>;
export type YieldEntry = z.infer<typeof yieldSchema>;
export declare const normalizeHeatmapPayload: (payload: unknown) => {
    ok: false;
    errors: any;
    data?: undefined;
} | {
    ok: true;
    data: any;
    errors?: undefined;
};
export declare const getNextOpenSlot: (slotsTotal: number, assignments: Pick<Assignment, "slot" | "active">[]) => number | null;
export declare const hasDuplicatePlanetForCharacter: (assignments: Pick<Assignment, "characterId" | "system" | "planet" | "active">[], characterId: string, system: string, planet: string) => boolean;
export declare const parseYieldPaste: (input: string) => {
    parsed: {
        date: string;
        product: string;
        amount: number;
    }[];
    errors: string[];
};
