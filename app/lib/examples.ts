import type { RobloxProject, ScriptType, VisualScript } from "./model";
import { uid } from "./model";

type Block = Record<string, unknown>;
const block = (type: string, fields: Record<string, unknown> = {}, next?: Block, inputs?: Record<string, unknown>): Block => ({ type, id: uid("block"), fields, ...(inputs ? { inputs } : {}), ...(next ? { next: { block: next } } : {}) });
const script = (name: string, type: ScriptType, root: Block): VisualScript => ({ id: uid("script"), name, type, workspace: { blocks: { languageVersion: 0, blocks: [{ ...root, x: 70, y: 70 }] } } });

function project(name: string, gameScript: VisualScript): RobloxProject {
  const now = new Date().toISOString();
  return { formatVersion: 1, id: uid("project"), name, createdAt: now, updatedAt: now, scripts: [gameScript] };
}

export const EXAMPLE_PROJECTS = [
  project("Kill Brick", script("KillBrick", "server",
    block("roblox_part_touched", { PART: "Lava" }, block("roblox_set_health", { VALUE: 0 }))
  )),
  project("Speed Pad", script("SpeedPad", "server",
    block("roblox_part_touched", { PART: "SpeedPad" },
      block("roblox_set_walkspeed", { VALUE: 32 },
        block("controls_wait", { SECONDS: 3 }, block("roblox_set_walkspeed", { VALUE: 16 }))))
  )),
  project("Welcome Player", script("WelcomePlayer", "server",
    block("roblox_player_joined", {}, block("roblox_print", {}, undefined, {
      VALUE: { block: block("text_join_simple", {}, undefined, {
        A: { shadow: block("text", { TEXT: "Welcome, " }) },
        B: { block: block("roblox_player_name") },
      }) },
    }))
  )),
];

export function freshExample(index: number) {
  const value = structuredClone(EXAMPLE_PROJECTS[index]);
  const now = new Date().toISOString();
  value.id = uid("project"); value.createdAt = now; value.updatedAt = now;
  value.scripts.forEach((item) => { item.id = uid("script"); });
  return value;
}
