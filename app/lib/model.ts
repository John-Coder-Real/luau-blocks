export type ScriptType = "server" | "client" | "module";
export type BlockContext = "server" | "client" | "both";

export interface VisualScript {
  id: string;
  name: string;
  type: ScriptType;
  workspace: Record<string, unknown>;
}

export interface RobloxProject {
  formatVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  scripts: VisualScript[];
}

export interface Diagnostic {
  severity: "info" | "warning" | "error";
  blockId?: string;
  message: string;
}

export interface SourceRange {
  blockId: string;
  startLine: number;
  endLine: number;
}

export interface CompileResult {
  code: string;
  diagnostics: Diagnostic[];
  sourceMap: SourceRange[];
  explanations: string[];
}

export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function createScript(name = "GameLogic", type: ScriptType = "server"): VisualScript {
  return { id: uid("script"), name, type, workspace: { blocks: { languageVersion: 0, blocks: [] } } };
}

export function createProject(name = "My Roblox Game"): RobloxProject {
  const now = new Date().toISOString();
  return { formatVersion: 1, id: uid("project"), name, createdAt: now, updatedAt: now, scripts: [createScript()] };
}

export function migrateProject(value: unknown): RobloxProject {
  if (!value || typeof value !== "object") throw new Error("This file does not contain a project.");
  const project = value as Partial<RobloxProject>;
  if (project.formatVersion !== 1 || !Array.isArray(project.scripts)) {
    throw new Error("This project uses an unsupported format.");
  }
  return project as RobloxProject;
}

export function safeName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "Script";
}
