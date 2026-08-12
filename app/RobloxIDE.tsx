"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Blockly from "blockly";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import {
  Blocks, Box, Check, ChevronDown, ChevronRight, Clipboard, Code2, Download,
  FileCode2, GraduationCap, Moon, MoreHorizontal, Plus, Redo2, Save,
  Search, Settings2, Sun, Trash2, Undo2, Upload, X, Zap,
} from "lucide-react";
import { BLOCKS, toolbox } from "./lib/blocks";
import { compileWorkspace } from "./lib/compiler";
import { EXAMPLE_PROJECTS, freshExample } from "./lib/examples";
import { createProject, createScript, migrateProject, safeName, uid, type RobloxProject, type ScriptType } from "./lib/model";

const STORAGE_KEY = "roblocks-projects-v1";
const PREF_KEY = "roblocks-preferences-v1";

function loadProjects(): RobloxProject[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return (JSON.parse(saved) as unknown[]).map(migrateProject);
  } catch { /* a malformed local save should not block the app */ }
  return EXAMPLE_PROJECTS.map((item) => structuredClone(item));
}

function fileSuffix(type: ScriptType) { return type === "server" ? ".server.luau" : type === "client" ? ".client.luau" : ".luau"; }
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500);
}

function Logo() {
  return <div className="brand"><span className="brand-mark"><Blocks size={18} /></span><span>RoBlocks</span><em>STUDIO</em></div>;
}

function NameDialog({ title, value, danger, onChange, onCancel, onConfirm }: { title: string; value: string; danger?: boolean; onChange: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h3 id="dialog-title">{title}</h3>{danger ? <p>This action cannot be undone.</p> : <input aria-label={title} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onConfirm(); if (event.key === "Escape") onCancel(); }}/>}<div><button className="secondary" onClick={onCancel}>Cancel</button><button className={danger ? "danger-button" : "primary"} onClick={onConfirm}>{danger ? "Delete" : "Continue"}</button></div></div></div>;
}

function Home({ projects, onOpen, onCreate, onImport, dark, toggleDark }: { projects: RobloxProject[]; onOpen: (p: RobloxProject) => void; onCreate: () => void; onImport: () => void; dark: boolean; toggleDark: () => void }) {
  return <main className="home-shell">
    <header className="home-header"><Logo /><div><button className="icon-button" onClick={toggleDark} aria-label="Toggle color theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="avatar">RB</button></div></header>
    <section className="hero">
      <div className="eyebrow"><Zap size={14}/> VISUAL ROBLOX CODING</div>
      <h1>Build Roblox games.<br/><span>One block at a time.</span></h1>
      <p>Snap together real game mechanics and learn from the clean Luau generated beside your blocks.</p>
      <div className="hero-actions"><button className="primary large" onClick={onCreate}><Plus size={18}/> Create project</button><button className="secondary large" onClick={onImport}><Upload size={18}/> Import project</button></div>
    </section>
    <section className="projects-section">
      <div className="section-heading"><div><h2>Your projects</h2><p>Pick up where you left off</p></div><button className="text-button" onClick={onCreate}>New project <Plus size={15}/></button></div>
      <div className="project-grid">
        {projects.map((project, index) => <button className="project-card" key={project.id} onClick={() => onOpen(project)}>
          <div className={`project-preview preview-${index % 3}`}><span className="mini-block event-mini">when player {index % 3 === 0 ? "touches Lava" : index % 3 === 1 ? "touches SpeedPad" : "joins"}</span><span className="mini-block action-mini">{index % 3 === 0 ? "set health to 0" : index % 3 === 1 ? "set WalkSpeed to 32" : "print Welcome"}</span></div>
          <div className="project-meta"><span className="project-icon"><Box size={18}/></span><span><strong>{project.name}</strong><small>{project.scripts.length} script{project.scripts.length === 1 ? "" : "s"} · Edited {project.updatedAt.slice(0, 10)}</small></span><MoreHorizontal size={18}/></div>
        </button>)}
      </div>
    </section>
    <section className="starter-strip"><div><GraduationCap size={22}/><span><strong>New to visual coding?</strong><small>Start with a working mechanic, then remix it.</small></span></div>{["Kill Brick", "Speed Pad", "Welcome Player"].map((name, i) => <button key={name} onClick={() => onOpen(freshExample(i))}>{name}<ChevronRight size={15}/></button>)}</section>
  </main>;
}

function BlockWorkspace({ script, search, beginner, onChange, onSelect, workspaceRef }: { script: RobloxProject["scripts"][number]; search: string; beginner: boolean; onChange: (state: Record<string, unknown>) => void; onSelect: (id?: string) => void; workspaceRef: React.MutableRefObject<Blockly.WorkspaceSvg | null> }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const changeRef = useRef(onChange);
  const selectRef = useRef(onSelect);
  useEffect(() => { changeRef.current = onChange; selectRef.current = onSelect; }, [onChange, onSelect]);

  useEffect(() => {
    for (const def of BLOCKS) if (!Blockly.Blocks[def.id]) Blockly.defineBlocksWithJsonArray([def.block as unknown as Blockly.JsonBlockDefinition]);
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const workspace = Blockly.inject(mountRef.current, {
      toolbox: toolbox(search, beginner), renderer: "zelos", trashcan: true, sounds: false,
      grid: { spacing: 24, length: 2, colour: "#cbd5e1", snap: true },
      zoom: { controls: true, wheel: true, startScale: .84, maxScale: 1.4, minScale: .45, scaleSpeed: 1.12 },
      move: { scrollbars: true, drag: true, wheel: true },
      theme: Blockly.Theme.defineTheme("roblocks", { name: "roblocks", base: Blockly.Themes.Classic, componentStyles: { workspaceBackgroundColour: "#f8fafc", toolboxBackgroundColour: "#ffffff", toolboxForegroundColour: "#334155", flyoutBackgroundColour: "#f1f5f9", flyoutForegroundColour: "#334155", scrollbarColour: "#94a3b8", insertionMarkerColour: "#4f46e5", insertionMarkerOpacity: .35 } }),
    });
    workspaceRef.current = workspace;
    try { Blockly.serialization.workspaces.load(script.workspace as Parameters<typeof Blockly.serialization.workspaces.load>[0], workspace); } catch { workspace.clear(); }
    const listener = (event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.SELECTED) selectRef.current((event as Blockly.Events.Selected).newElementId ?? undefined);
      if (!event.isUiEvent) changeRef.current(Blockly.serialization.workspaces.save(workspace) as Record<string, unknown>);
    };
    workspace.addChangeListener(listener);
    return () => { workspace.dispose(); workspaceRef.current = null; };
    // The workspace is intentionally recreated only when switching scripts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.id]);

  useEffect(() => { workspaceRef.current?.updateToolbox(toolbox(search, beginner)); }, [search, beginner, workspaceRef]);
  return <div className="blockly-mount" ref={mountRef} />;
}

function IDE({ initial, onBack, onProjectChange, dark, toggleDark }: { initial: RobloxProject; onBack: () => void; onProjectChange: (p: RobloxProject) => void; dark: boolean; toggleDark: () => void }) {
  const [project, setProject] = useState(initial);
  const [scriptId, setScriptId] = useState(initial.scripts[0]?.id);
  const [search, setSearch] = useState("");
  const [beginner, setBeginner] = useState(true);
  const [codeOpen, setCodeOpen] = useState(true);
  const [explain, setExplain] = useState(false);
  const [saved, setSaved] = useState<"Saving…" | "Saved">("Saved");
  const [toast, setToast] = useState("");
  const [dialog, setDialog] = useState<{ mode: "add" | "rename" | "delete"; value: string }>();
  const [selectedBlock, setSelectedBlock] = useState<string>();
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const current = project.scripts.find((s) => s.id === scriptId) ?? project.scripts[0];
  const compiled = useMemo(() => current ? compileWorkspace(current.workspace, current.type) : null, [current]);

  const updateProject = useCallback((fn: (p: RobloxProject) => RobloxProject) => {
    setSaved("Saving…");
    setProject((previous) => ({ ...fn(previous), updatedAt: new Date().toISOString() }));
    window.setTimeout(() => setSaved("Saved"), 350);
  }, []);

  useEffect(() => { onProjectChange(project); }, [project, onProjectChange]);

  const updateWorkspace = useCallback((workspace: Record<string, unknown>) => updateProject((p) => ({ ...p, scripts: p.scripts.map((s) => s.id === scriptId ? { ...s, workspace } : s) })), [scriptId, updateProject]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 1800); };
  const copyCode = async () => { if (!compiled) return; await navigator.clipboard.writeText(compiled.code); notify("Luau copied to clipboard"); };
  const downloadScript = () => { if (!compiled || !current) return; downloadBlob(new Blob([compiled.code], { type: "text/plain" }), `${safeName(current.name)}${fileSuffix(current.type)}`); };
  const exportProject = async () => {
    const zip = new JSZip(); const root = zip.folder(safeName(project.name))!;
    for (const item of project.scripts) {
      const folder = item.type === "server" ? root.folder("ServerScriptService") : item.type === "client" ? root.folder("StarterPlayer/StarterPlayerScripts") : root.folder("ReplicatedStorage/Modules");
      folder!.file(`${safeName(item.name)}${fileSuffix(item.type)}`, compileWorkspace(item.workspace, item.type).code);
    }
    root.file("project.json", JSON.stringify(project, null, 2));
    downloadBlob(await zip.generateAsync({ type: "blob" }), `${safeName(project.name)}.zip`); notify("Project export ready");
  };
  const addScript = () => setDialog({ mode: "add", value: "NewScript" });
  const renameScript = () => setDialog({ mode: "rename", value: current.name });
  const deleteScript = () => { if (project.scripts.length === 1) return notify("A project needs at least one script"); setDialog({ mode: "delete", value: current.name }); };
  const confirmDialog = () => {
    if (!dialog) return;
    if (dialog.mode === "add" && dialog.value.trim()) { const next = createScript(dialog.value.trim(), "server"); updateProject((p) => ({ ...p, scripts: [...p.scripts, next] })); setScriptId(next.id); }
    if (dialog.mode === "rename" && dialog.value.trim()) updateProject((p) => ({ ...p, scripts: p.scripts.map((s) => s.id === current.id ? { ...s, name: dialog.value.trim() } : s) }));
    if (dialog.mode === "delete") { const next = project.scripts.find((s) => s.id !== current.id)!; updateProject((p) => ({ ...p, scripts: p.scripts.filter((s) => s.id !== current.id) })); setScriptId(next.id); }
    setDialog(undefined);
  };
  const setType = (type: ScriptType) => current && updateProject((p) => ({ ...p, scripts: p.scripts.map((s) => s.id === current.id ? { ...s, type } : s) }));

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); onProjectChange(project); notify("Project saved"); }
      if (mod && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
      if (mod && event.shiftKey && event.key.toLowerCase() === "c") { event.preventDefault(); void copyCode(); }
      if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) workspaceRef.current?.redo(); else workspaceRef.current?.undo(); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
    // Keyboard handlers intentionally refresh with the current project/compiler output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, compiled]);

  if (!current || !compiled) return null;
  const selectedRange = compiled.sourceMap.find((range) => range.blockId === selectedBlock);
  return <main className="ide-shell">
    <header className="ide-header">
      <button className="logo-button" onClick={onBack} aria-label="Back to projects"><Logo/></button><div className="divider"/>
      <div className="project-title"><input aria-label="Project name" value={project.name} onChange={(e) => updateProject((p) => ({ ...p, name: e.target.value }))}/><span><span className="online-dot"/> Local project</span></div>
      <div className="header-actions"><button className="icon-button" onClick={() => workspaceRef.current?.undo()} title="Undo (Ctrl/⌘ Z)"><Undo2 size={17}/></button><button className="icon-button" onClick={() => workspaceRef.current?.redo()} title="Redo (Ctrl/⌘ Shift Z)"><Redo2 size={17}/></button><div className="divider"/><button className="icon-button" onClick={toggleDark} aria-label="Toggle color theme">{dark ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="secondary compact" onClick={() => { onProjectChange(project); notify("Project saved"); }}><Save size={16}/>{saved}</button><button className="primary compact" onClick={() => void exportProject()}><Download size={16}/> Export</button></div>
    </header>
    <div className={`ide-body ${codeOpen ? "" : "code-closed"}`}>
      <aside className="scripts-panel">
        <div className="panel-label"><span>PROJECT</span><button onClick={addScript} aria-label="Add script"><Plus size={15}/></button></div>
        <div className="tree-root"><ChevronDown size={14}/><Box size={15}/><strong>{project.name}</strong></div>
        <div className="scripts-list">{project.scripts.map((item) => <button key={item.id} className={item.id === current.id ? "active" : ""} onClick={() => setScriptId(item.id)}><FileCode2 size={16}/><span>{item.name}<small>{item.type === "client" ? "Local Script · Client" : item.type === "module" ? "Module Script · Shared" : "Server Script · Server"}</small></span>{item.id === current.id && <span className={`context-dot ${item.type}`}/>}</button>)}</div>
        <button className="add-script" onClick={addScript}><Plus size={15}/> New script</button>
        <div className="script-settings"><label>Script type<select value={current.type} onChange={(e) => setType(e.target.value as ScriptType)}><option value="server">Server Script</option><option value="client">Local Script</option><option value="module">Module Script</option></select></label><div><button onClick={renameScript}>Rename</button><button onClick={deleteScript} aria-label="Delete script"><Trash2 size={14}/></button></div></div>
        <div className="studio-card"><span><span className="pulse-dot"/> EXPERIMENTAL</span><strong>Connect Studio</strong><p>Direct sync is coming later. Export works now.</p><button disabled><Settings2 size={14}/> Not available yet</button></div>
      </aside>
      <section className="workspace-panel">
        <div className="workspace-toolbar"><div className="search-wrap"><Search size={16}/><input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search blocks…" aria-label="Search blocks"/><kbd>⌘K</kbd></div><button className={`mode-chip ${beginner ? "active" : ""}`} onClick={() => setBeginner(!beginner)}><GraduationCap size={15}/> Beginner mode</button><button className="code-toggle" onClick={() => setCodeOpen(!codeOpen)}><Code2 size={15}/>{codeOpen ? "Hide code" : "Show code"}</button></div>
        <div className="canvas-wrap"><BlockWorkspace key={current.id} script={current} search={search} beginner={beginner} onChange={updateWorkspace} onSelect={setSelectedBlock} workspaceRef={workspaceRef}/><div className="canvas-hint"><span>1</span> Drag an event block here, then snap actions underneath.</div></div>
      </section>
      {codeOpen && <aside className="code-panel">
        <div className="code-header"><div><Code2 size={16}/><strong>GENERATED LUAU</strong><span className={current.type}>{current.type === "client" ? "CLIENT" : current.type === "module" ? "SHARED" : "SERVER"}</span></div><button className="icon-button" onClick={() => setCodeOpen(false)} aria-label="Close code"><X size={16}/></button></div>
        <div className="file-tab"><FileCode2 size={15}/>{safeName(current.name)}{fileSuffix(current.type)}<span className="dirty-dot"/></div>
        <div className="editor-wrap"><Editor height="100%" defaultLanguage="lua" value={compiled.code} theme={dark ? "vs-dark" : "light"} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, lineHeight: 21, fontFamily: "var(--font-geist-mono)", wordWrap: "on", scrollBeyondLastLine: false, padding: { top: 14 }, renderLineHighlight: "none" }} onMount={(editor) => { if (selectedRange) editor.revealLinesInCenter(selectedRange.startLine, selectedRange.endLine); }}/></div>
        {explain && <div className="explain-box"><strong><GraduationCap size={15}/> What this code does</strong><p>{compiled.explanations[0] ?? "Each connected block becomes readable Luau. Roblox services are added only when needed."}</p></div>}
        <div className="code-actions"><button className="primary" onClick={() => void copyCode()}><Clipboard size={15}/> Copy Luau</button><button className="secondary" onClick={downloadScript}><Download size={15}/> .luau</button><button className={`icon-button ${explain ? "active" : ""}`} onClick={() => setExplain(!explain)} title="Explain code"><GraduationCap size={16}/></button></div>
      </aside>}
    </div>
    <footer className="status-bar"><div><span className="ok"><Check size={13}/> {compiled.diagnostics.filter((d) => d.severity === "error").length} errors</span><button className={compiled.diagnostics.some((d) => d.severity === "warning") ? "warn" : ""} title={compiled.diagnostics.map((d) => d.message).join("\n")}><span>△</span> {compiled.diagnostics.filter((d) => d.severity === "warning").length} warnings</button><span>{current.type === "client" ? "Runs on each player's device" : current.type === "module" ? "Reusable module" : "Runs securely on the server"}</span></div><div><span>{saved}</span><span>Luau</span><span>UTF-8</span></div></footer>
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    {dialog && <NameDialog title={dialog.mode === "add" ? "Name your new script" : dialog.mode === "rename" ? "Rename script" : `Delete ${current.name}?`} value={dialog.value} danger={dialog.mode === "delete"} onChange={(value) => setDialog({ ...dialog, value })} onCancel={() => setDialog(undefined)} onConfirm={confirmDialog}/>} 
  </main>;
}

export default function RobloxIDE() {
  const [projects, setProjects] = useState<RobloxProject[]>(() => EXAMPLE_PROJECTS.map((item) => structuredClone(item)));
  const [active, setActive] = useState<RobloxProject>();
  const [dark, setDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [createName, setCreateName] = useState<string>();
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => { queueMicrotask(() => { setProjects(loadProjects()); try { setDark(Boolean(JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}").dark)); } catch { setDark(false); } setHydrated(true); }); }, []);
  useEffect(() => { if (hydrated) { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); localStorage.setItem(PREF_KEY, JSON.stringify({ dark })); } }, [projects, dark, hydrated]);
  const save = useCallback((project: RobloxProject) => setProjects((all) => all.some((p) => p.id === project.id) ? all.map((p) => p.id === project.id ? project : p) : [project, ...all]), []);
  const create = () => setCreateName("My Roblox Game");
  const confirmCreate = () => { if (!createName?.trim()) return; const project = createProject(createName.trim()); save(project); setActive(project); setCreateName(undefined); };
  const open = (project: RobloxProject) => { save(project); setActive(project); };
  const importProject = () => importRef.current?.click();
  const handleImport = async (file?: File) => { if (!file) return; try { const project = migrateProject(JSON.parse(await file.text())); project.id = uid("project"); project.updatedAt = new Date().toISOString(); save(project); setActive(project); } catch (error) { window.alert(error instanceof Error ? error.message : "Could not import that project."); } };
  return <div className={dark ? "theme-dark" : ""}>{active ? <IDE initial={active} onBack={() => setActive(undefined)} onProjectChange={save} dark={dark} toggleDark={() => setDark(!dark)}/> : <Home projects={projects} onOpen={open} onCreate={create} onImport={importProject} dark={dark} toggleDark={() => setDark(!dark)}/>}<input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(e) => void handleImport(e.target.files?.[0])}/>{createName !== undefined && <NameDialog title="Name your Roblox project" value={createName} onChange={setCreateName} onCancel={() => setCreateName(undefined)} onConfirm={confirmCreate}/>}</div>;
}
