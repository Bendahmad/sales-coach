import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ScenarioFileSchema, type ScenarioFile } from "./scenario-schema";

/** Reads and validates content/scenarios/*.json (used by the seed script and tests). */
export function loadScenarioFiles(dir = join(process.cwd(), "content/scenarios")): ScenarioFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = JSON.parse(readFileSync(join(dir, f), "utf8"));
      const parsed = ScenarioFileSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(`${f}: ${parsed.error.message}`);
      }
      if (`${parsed.data.id}.json` !== f) throw new Error(`${f}: id ${parsed.data.id} does not match file name`);
      return parsed.data;
    });
}
