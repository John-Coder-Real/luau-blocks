import { BLOCK_MAP } from "./blocks";
import type { CompileResult, Diagnostic, ScriptType, SourceRange } from "./model";

type JsonBlock = {
  id?: string; type: string; fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: JsonBlock; shadow?: JsonBlock }>;
  next?: { block?: JsonBlock };
};

type Generator = (block: JsonBlock, ctx: CompilerContext) => string;

class CompilerContext {
  services = new Set<string>();
  helpers = new Set<"cooldowns" | "timers" | "raycast">();
  diagnostics: Diagnostic[] = [];
  sourceMap: SourceRange[] = [];
  explanations = new Set<string>();
  indent = 0;
  line = 1;
  loopDepth = 0;
  functionDepth = 0;
  scope: "global" | "player" | "touch" = "global";
  constructor(public scriptType: ScriptType) {}
  pad(text: string) { return `${"    ".repeat(this.indent)}${text}`; }
  service(name: string) { this.services.add(name); return name; }
  warn(message: string, block?: JsonBlock, severity: Diagnostic["severity"] = "warning") { this.diagnostics.push({ severity, blockId: block?.id, message }); }
  name(value: unknown, fallback = "value") {
    const cleaned = String(value ?? fallback).replace(/[^a-zA-Z0-9_]/g, "_").replace(/^\d/, "_$&");
    return cleaned || fallback;
  }
  field(block: JsonBlock, key: string, fallback = "") { return String(block.fields?.[key] ?? fallback); }
  input(block: JsonBlock, key: string) { return block.inputs?.[key]?.block ?? block.inputs?.[key]?.shadow; }
}

const registry = new Map<string, Generator>();
const register = (type: string, generator: Generator) => registry.set(type, generator);
const q = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
const bool = (value: string) => value === "TRUE" ? "true" : "false";
const pathExpression = (path: string) => path.split(".").filter(Boolean).reduce((expr, part) => `${expr}:WaitForChild(${q(part)})`, "workspace");

function value(block: JsonBlock | undefined, ctx: CompilerContext): string {
  if (!block) return "nil --[[ missing value ]]";
  validateBlock(block, ctx);
  const f = ctx.field.bind(ctx, block);
  switch (block.type) {
    case "math_number": return f("NUM", "0");
    case "text": return q(f("TEXT"));
    case "logic_boolean": return f("BOOL", "TRUE") === "TRUE" ? "true" : "false";
    case "roblox_player_name": return ctx.scope === "global" ? '"Player"' : "player.Name";
    case "roblox_player_userid": return ctx.scope === "global" ? "0" : "player.UserId";
    case "player_current": ctx.service("Players"); return ctx.scope === "global" ? "Players.LocalPlayer" : "player";
    case "player_character": return `${value(ctx.input(block, "PLAYER"), ctx)}.Character`;
    case "player_from_character": ctx.service("Players"); return `Players:GetPlayerFromCharacter(${value(ctx.input(block, "CHARACTER"), ctx)})`;
    case "player_team": return `${value(ctx.input(block, "PLAYER"), ctx)}.Team`;
    case "character_humanoid": return `${value(ctx.input(block, "CHARACTER"), ctx)}:FindFirstChildOfClass("Humanoid")`;
    case "character_root": return `${value(ctx.input(block, "CHARACTER"), ctx)}:FindFirstChild("HumanoidRootPart")`;
    case "character_health": return `${value(ctx.input(block, "HUMANOID"), ctx)}.Health`;
    case "character_walkspeed": return `${value(ctx.input(block, "HUMANOID"), ctx)}.WalkSpeed`;
    case "variables_get": return ctx.name(f("VAR", "score"));
    case "text_join_simple": return `${value(ctx.input(block, "A"), ctx)} .. ${value(ctx.input(block, "B"), ctx)}`;
    case "logic_and": return `(${value(ctx.input(block, "A"), ctx)} and ${value(ctx.input(block, "B"), ctx)})`;
    case "logic_or": return `(${value(ctx.input(block, "A"), ctx)} or ${value(ctx.input(block, "B"), ctx)})`;
    case "logic_not": return `(not ${value(ctx.input(block, "VALUE"), ctx)})`;
    case "math_random": return `math.random(${value(ctx.input(block, "MIN"), ctx)}, ${value(ctx.input(block, "MAX"), ctx)})`;
    case "math_round": return `math.round(${value(ctx.input(block, "VALUE"), ctx)})`;
    case "math_floor": return `math.floor(${value(ctx.input(block, "VALUE"), ctx)})`;
    case "math_ceil": return `math.ceil(${value(ctx.input(block, "VALUE"), ctx)})`;
    case "math_clamp": return `math.clamp(${value(ctx.input(block, "VALUE"), ctx)}, ${value(ctx.input(block, "MIN"), ctx)}, ${value(ctx.input(block, "MAX"), ctx)})`;
    case "math_minmax": return `math.${f("MODE", "MIN") === "MAX" ? "max" : "min"}(${value(ctx.input(block, "A"), ctx)}, ${value(ctx.input(block, "B"), ctx)})`;
    case "math_abs": return `math.abs(${value(ctx.input(block, "VALUE"), ctx)})`;
    case "text_length": return `utf8.len(${value(ctx.input(block, "VALUE"), ctx)})`;
    case "text_contains": return `(string.find(${value(ctx.input(block, "TEXT"), ctx)}, ${value(ctx.input(block, "SEARCH"), ctx)}, 1, true) ~= nil)`;
    case "text_upper": return `string.upper(tostring(${value(ctx.input(block, "VALUE"), ctx)}))`;
    case "text_lower": return `string.lower(tostring(${value(ctx.input(block, "VALUE"), ctx)}))`;
    case "text_tostring": return `tostring(${value(ctx.input(block, "VALUE"), ctx)})`;
    case "function_call_args": return `${ctx.name(f("NAME", "calculate"))}(${f("ARGS", "")})`;
    case "world_workspace_object": return pathExpression(f("PATH", "Object"));
    case "world_find_child": return `${value(ctx.input(block, "OBJECT"), ctx)}:FindFirstChild(${q(f("NAME", "Child"))})`;
    case "world_wait_child": return `${value(ctx.input(block, "OBJECT"), ctx)}:WaitForChild(${q(f("NAME", "Child"))})`;
    case "world_get_parent": return `${value(ctx.input(block, "OBJECT"), ctx)}.Parent`;
    case "world_get_children": return `${value(ctx.input(block, "OBJECT"), ctx)}:GetChildren()`;
    case "world_get_property": return `${value(ctx.input(block, "OBJECT"), ctx)}.${ctx.name(f("PROPERTY", "Name"))}`;
    case "world_get_attribute": return `${value(ctx.input(block, "OBJECT"), ctx)}:GetAttribute(${q(f("NAME", "Level"))})`;
    case "animation_animator": return `${value(ctx.input(block, "HUMANOID"), ctx)}:FindFirstChildOfClass("Animator")`;
    case "raycast_hit": ctx.helpers.add("raycast"); return "lastRaycastResult and lastRaycastResult.Instance";
    case "raycast_position": ctx.helpers.add("raycast"); return "lastRaycastResult and lastRaycastResult.Position";
    case "raycast_normal": ctx.helpers.add("raycast"); return "lastRaycastResult and lastRaycastResult.Normal";
    case "raycast_did_hit": ctx.helpers.add("raycast"); return "lastRaycastResult ~= nil";
    case "input_key_down": ctx.service("UserInputService"); return `UserInputService:IsKeyDown(Enum.KeyCode.${ctx.name(f("KEY", "LeftShift"))})`;
    case "input_mouse_x": ctx.service("UserInputService"); return "UserInputService:GetMouseLocation().X";
    case "input_mouse_y": ctx.service("UserInputService"); return "UserInputService:GetMouseLocation().Y";
    case "input_touch_position": return "touchPosition";
    case "input_last_type": ctx.service("UserInputService"); return "UserInputService:GetLastInputType().Name";
    case "input_mouse_delta_x": ctx.service("UserInputService"); return "UserInputService:GetMouseDelta().X";
    case "input_mouse_delta_y": ctx.service("UserInputService"); return "UserInputService:GetMouseDelta().Y";
    case "input_preferred": ctx.service("UserInputService"); return "(UserInputService.TouchEnabled and \"Touch\" or (UserInputService.GamepadEnabled and \"Gamepad\" or \"KeyboardAndMouse\"))";
    case "animation_is_playing": return `${ctx.name(f("TRACK", "animationTrack"))}.IsPlaying`;
    case "animation_length": return `${ctx.name(f("TRACK", "animationTrack"))}.Length`;
    case "network_request_server": ctx.service("ReplicatedStorage"); return `ReplicatedStorage:WaitForChild(${q(f("REMOTE", "GetData"))}):InvokeServer(${value(ctx.input(block, "VALUE"), ctx)})`;
    case "gui_get_text": ctx.service("Players"); return `Players.LocalPlayer.PlayerGui:FindFirstChild(${q(f("OBJECT", "StatusLabel"))}, true).Text`;
    case "tag_has": ctx.service("CollectionService"); return `CollectionService:HasTag(${value(ctx.input(block, "OBJECT"), ctx)}, ${q(f("TAG", "Enemy"))})`;
    case "tag_get_objects": ctx.service("CollectionService"); return `CollectionService:GetTagged(${q(f("TAG", "Enemy"))})`;
    case "utility_cooldown_ready": ctx.helpers.add("cooldowns"); return `(os.clock() >= (cooldowns[${q(f("NAME", "Attack"))}] or 0))`;
    case "utility_cooldown_left": ctx.helpers.add("cooldowns"); return `math.max(0, (cooldowns[${q(f("NAME", "Attack"))}] or 0) - os.clock())`;
    case "utility_timer_elapsed": ctx.helpers.add("timers"); return `(os.clock() - (timers[${q(f("NAME", "Round"))}] or os.clock()))`;
    case "utility_chance": return `(math.random() * 100 <= ${value(ctx.input(block, "PERCENT"), ctx)})`;
    case "utility_format_time": { const seconds = value(ctx.input(block, "SECONDS"), ctx); return `string.format("%02d:%02d", math.floor(${seconds} / 60), math.floor(${seconds} % 60))`; }
    case "table_from_text": return `{ ${f("VALUES", "").split(",").map((item) => q(item.trim())).filter((item) => item !== '""').join(", ")} }`;
    case "table_count": return `#${value(ctx.input(block, "TABLE"), ctx)}`;
    case "table_random_item": { const table = value(ctx.input(block, "TABLE"), ctx); return `${table}[math.random(1, #${table})]`; }
    case "math_vector3": return `Vector3.new(${f("X", "0")}, ${f("Y", "0")}, ${f("Z", "0")})`;
    case "math_color3": { const rgb = f("RGB", "255,255,255").split(",").map((part) => Number(part.trim()) || 0); return `Color3.fromRGB(${rgb.join(", ")})`; }
    case "math_cframe": return `CFrame.new(${f("X", "0")}, ${f("Y", "0")}, ${f("Z", "0")})`;
    case "math_arithmetic": {
      const ops: Record<string, string> = { ADD: "+", MINUS: "-", MULTIPLY: "*", DIVIDE: "/" };
      return `(${value(ctx.input(block, "A"), ctx)} ${ops[f("OP", "ADD")] ?? "+"} ${value(ctx.input(block, "B"), ctx)})`;
    }
    case "logic_compare": {
      const ops: Record<string, string> = { EQ: "==", NEQ: "~=", LT: "<", LTE: "<=", GT: ">", GTE: ">=" };
      return `${value(ctx.input(block, "A"), ctx)} ${ops[f("OP", "EQ")] ?? "=="} ${value(ctx.input(block, "B"), ctx)}`;
    }
    default: return "nil --[[ unsupported value ]]";
  }
}

function body(block: JsonBlock | undefined, ctx: CompilerContext): string {
  if (!block) return ctx.pad("-- Add blocks here");
  return chain(block, ctx);
}

function nextBody(block: JsonBlock, ctx: CompilerContext) {
  ctx.functionDepth++;
  ctx.indent++;
  const inside = body(block.next?.block, ctx);
  ctx.indent--;
  ctx.functionDepth--;
  return inside;
}

register("roblox_player_joined", (b, c) => {
  c.service("Players"); c.explanations.add("PlayerAdded runs this code whenever a player joins the server.");
  const old = c.scope; c.scope = "player"; c.indent++;
  const inside = body(b.next?.block, c); c.indent--; c.scope = old;
  return `Players.PlayerAdded:Connect(function(player)\n${inside}\nend)`;
});
register("roblox_player_leaves", (b, c) => {
  c.service("Players"); const old = c.scope; c.scope = "player"; c.indent++;
  const inside = body(b.next?.block, c); c.indent--; c.scope = old;
  return `Players.PlayerRemoving:Connect(function(player)\n${inside}\nend)`;
});
register("roblox_part_touched", (b, c) => {
  c.service("Players"); const part = c.field(b, "PART", "Lava");
  if (!part.trim()) c.warn("Choose the Workspace part that should detect touches.", b, "error");
  const local = c.name(part, "part").replace(/^./, (x) => x.toLowerCase());
  const old = c.scope; c.scope = "touch"; c.indent++;
  const guard = c.indent; c.indent++;
  const inside = body(b.next?.block, c); c.indent = guard;
  const wrapped = `${local}.Touched:Connect(function(hit)\n${c.pad("local character = hit.Parent")}\n${c.pad('local humanoid = character and character:FindFirstChildOfClass("Humanoid")')}\n${c.pad("local player = character and Players:GetPlayerFromCharacter(character)")}\n\n${c.pad("if player and humanoid then")}\n${inside}\n${c.pad("end")}\nend)`;
  c.indent--; c.scope = old;
  return `local ${local} = workspace:WaitForChild(${q(part || "Part")})\n\n${wrapped}`;
});
register("roblox_character_spawned", (b, c) => {
  c.service("Players"); c.indent++; const inside = body(b.next?.block, c); c.indent--;
  return `local player = Players.LocalPlayer\n\nplayer.CharacterAdded:Connect(function(character)\n${c.pad("local humanoid = character:WaitForChild(\"Humanoid\")")}\n${inside}\nend)`;
});
register("roblox_button_clicked", (b, c) => {
  c.service("Players"); const name = c.field(b, "BUTTON", "PlayButton"); c.indent++;
  const inside = body(b.next?.block, c); c.indent--;
  return `local player = Players.LocalPlayer\nlocal button = player.PlayerGui:WaitForChild(${q(name)}, true)\n\nbutton.Activated:Connect(function()\n${inside}\nend)`;
});
register("roblox_tool_activated", (b, c) => {
  c.service("Players"); const name = c.field(b, "TOOL", "Sword"); c.indent++;
  const inside = body(b.next?.block, c); c.indent--;
  return `local player = Players.LocalPlayer\nlocal tool = player.Backpack:WaitForChild(${q(name)})\n\ntool.Activated:Connect(function()\n${inside}\nend)`;
});
register("roblox_prompt_triggered", (b, c) => {
  const name = c.field(b, "PROMPT", "DoorPrompt"); const old = c.scope; c.scope = "player"; c.indent++;
  const inside = body(b.next?.block, c); c.indent--; c.scope = old;
  return `local prompt = workspace:WaitForChild(${q(name)}, true)\n\nprompt.Triggered:Connect(function(player)\n${inside}\nend)`;
});

register("event_attribute_changed", (b, c) => { const object = pathExpression(c.field(b, "PATH", "Object")); const inside = nextBody(b, c); return `${object}:GetAttributeChangedSignal(${q(c.field(b, "NAME", "Level"))}):Connect(function()\n${inside}\nend)`; });
register("event_touch_ended", (b, c) => { c.service("Players"); const part = pathExpression(c.field(b, "PART", "Pad")); const old = c.scope; c.scope = "touch"; c.indent++; const guardIndent = c.indent; c.indent++; const inside = body(b.next?.block, c); c.indent = guardIndent; const code = `${part}.TouchEnded:Connect(function(hit)\n${c.pad("local character = hit.Parent")}\n${c.pad('local humanoid = character and character:FindFirstChildOfClass("Humanoid")')}\n${c.pad("local player = character and Players:GetPlayerFromCharacter(character)")}\n${c.pad("if player and humanoid then")}\n${inside}\n${c.pad("end")}\nend)`; c.indent--; c.scope = old; return code; });
register("event_character_died", (b, c) => {
  c.service("Players");
  if (c.scriptType === "client") { const inside = nextBody(b, c); return `local player = Players.LocalPlayer\nlocal character = player.Character or player.CharacterAdded:Wait()\nlocal humanoid = character:WaitForChild("Humanoid")\n\nhumanoid.Died:Connect(function()\n${inside}\nend)`; }
  c.indent += 3; const inside = body(b.next?.block, c); c.indent -= 3;
  return `Players.PlayerAdded:Connect(function(player)\n    player.CharacterAdded:Connect(function(character)\n        local humanoid = character:WaitForChild("Humanoid")\n        humanoid.Died:Connect(function()\n${inside}\n        end)\n    end)\nend)`;
});
for (const [type, signal] of [["event_tool_equipped", "Equipped"], ["event_tool_unequipped", "Unequipped"]] as const) register(type, (b, c) => { c.service("Players"); const inside = nextBody(b, c); return `local player = Players.LocalPlayer\nlocal tool = player.Backpack:WaitForChild(${q(c.field(b, "TOOL", "Sword"))})\n\ntool.${signal}:Connect(function()\n${inside}\nend)`; });
register("event_property_changed", (b, c) => { const object = pathExpression(c.field(b, "PATH", "Object")); const inside = nextBody(b, c); return `${object}:GetPropertyChangedSignal(${q(c.field(b, "PROPERTY", "Value"))}):Connect(function()\n${inside}\nend)`; });
register("event_object_event", (b, c) => { const object = pathExpression(c.field(b, "PATH", "Door")); const inside = nextBody(b, c); return `${object}.${c.field(b, "EVENT", "Touched")}:Connect(function(eventValue)\n${inside}\nend)`; });
register("event_player_chatted", (b, c) => { c.service("Players"); const old = c.scope; c.scope = "player"; c.indent += 2; const inside = body(b.next?.block, c); c.indent -= 2; c.scope = old; return `Players.PlayerAdded:Connect(function(player)\n    player.Chatted:Connect(function(message)\n${inside}\n    end)\nend)`; });
for (const [type, signal] of [["event_input_began", "InputBegan"], ["event_input_ended", "InputEnded"]] as const) register(type, (b, c) => { c.service("UserInputService"); const inside = nextBody(b, c); return `UserInputService.${signal}:Connect(function(input, gameProcessed)\n${inside}\nend)`; });

for (const [type, signal] of [["input_key_pressed", "InputBegan"], ["input_key_released", "InputEnded"]] as const) register(type, (b, c) => { c.service("UserInputService"); c.indent += 2; const inside = body(b.next?.block, c); c.indent -= 2; const key = c.name(c.field(b, "KEY", "E")); return `UserInputService.${signal}:Connect(function(input, gameProcessed)\n    if not gameProcessed and input.KeyCode == Enum.KeyCode.${key} then\n${inside}\n    end\nend)`; });
register("input_mouse_clicked", (b, c) => { c.service("UserInputService"); c.indent += 2; const inside = body(b.next?.block, c); c.indent -= 2; return `UserInputService.InputBegan:Connect(function(input, gameProcessed)\n    if not gameProcessed and input.UserInputType == Enum.UserInputType.${c.field(b, "BUTTON", "MouseButton1")} then\n${inside}\n    end\nend)`; });
register("input_gamepad_pressed", (b, c) => { c.service("UserInputService"); c.indent += 2; const inside = body(b.next?.block, c); c.indent -= 2; return `UserInputService.InputBegan:Connect(function(input, gameProcessed)\n    if not gameProcessed and input.KeyCode == Enum.KeyCode.${c.name(c.field(b, "BUTTON", "ButtonA"))} then\n${inside}\n    end\nend)`; });
register("input_touch_began", (b, c) => { c.service("UserInputService"); c.indent += 2; const inside = body(b.next?.block, c); c.indent -= 2; return `UserInputService.TouchStarted:Connect(function(touch, gameProcessed)\n    if not gameProcessed then\n        local touchPosition = touch.Position\n${inside}\n    end\nend)`; });

register("animation_finished", (b, c) => { const inside = nextBody(b, c); return `${c.name(c.field(b, "TRACK", "animationTrack"))}.Stopped:Connect(function()\n${inside}\nend)`; });
register("network_receive_server", (b, c) => { c.service("ReplicatedStorage"); const old = c.scope; c.scope = "player"; const inside = nextBody(b, c); c.scope = old; return `ReplicatedStorage:WaitForChild(${q(c.field(b, "REMOTE", "Action"))}).OnServerEvent:Connect(function(player, remoteValue)\n${inside}\nend)`; });
register("network_receive_client", (b, c) => { c.service("ReplicatedStorage"); const inside = nextBody(b, c); return `ReplicatedStorage:WaitForChild(${q(c.field(b, "REMOTE", "Update"))}).OnClientEvent:Connect(function(remoteValue)\n${inside}\nend)`; });
register("network_function_server", (b, c) => { c.service("ReplicatedStorage"); const old = c.scope; c.scope = "player"; const inside = nextBody(b, c); c.scope = old; return `ReplicatedStorage:WaitForChild(${q(c.field(b, "REMOTE", "GetData"))}).OnServerInvoke = function(player, requestValue)\n${inside}\nend`; });
register("sound_finished", (b, c) => { const inside = nextBody(b, c); return `workspace:WaitForChild(${q(c.field(b, "SOUND", "Music"))}).Ended:Connect(function()\n${inside}\nend)`; });
register("gui_hovered", (b, c) => { c.service("Players"); const inside = nextBody(b, c); return `local player = Players.LocalPlayer\nlocal button = player.PlayerGui:FindFirstChild(${q(c.field(b, "OBJECT", "Button"))}, true)\n\nbutton.MouseEnter:Connect(function()\n${inside}\nend)`; });
register("gui_text_submitted", (b, c) => { c.service("Players"); const inside = nextBody(b, c); return `local player = Players.LocalPlayer\nlocal textBox = player.PlayerGui:FindFirstChild(${q(c.field(b, "OBJECT", "ChatBox"))}, true)\n\ntextBox.FocusLost:Connect(function(enterPressed)\n    if enterPressed then\n${inside.split("\n").map((line) => `    ${line}`).join("\n")}\n    end\nend)`; });
for (const [type, method] of [["tag_added", "GetInstanceAddedSignal"], ["tag_removed", "GetInstanceRemovedSignal"]] as const) register(type, (b, c) => { c.service("CollectionService"); const inside = nextBody(b, c); return `CollectionService:${method}(${q(c.field(b, "TAG", "Enemy"))}):Connect(function(taggedObject)\n${inside}\nend)`; });

register("roblox_set_health", (b, c) => c.pad(`humanoid.Health = ${c.field(b, "VALUE", "0")}`));
register("roblox_change_health", (b, c) => c.pad(`humanoid:TakeDamage(${c.field(b, "VALUE", "25")})`));
register("roblox_set_walkspeed", (b, c) => c.pad(`humanoid.WalkSpeed = ${c.field(b, "VALUE", "32")}`));
register("roblox_set_jumppower", (b, c) => c.pad(`humanoid.JumpPower = ${c.field(b, "VALUE", "50")}`));
register("controls_wait", (b, c) => c.pad(`task.wait(${c.field(b, "SECONDS", "1")})`));
register("roblox_print", (b, c) => c.pad(`print(${value(c.input(b, "VALUE"), c)})`));
register("variables_set", (b, c) => c.pad(`local ${c.name(c.field(b, "VAR", "score"))} = ${value(c.input(b, "VALUE"), c)}`));
register("math_change", (b, c) => { const n = c.name(c.field(b, "VAR", "score")); return c.pad(`${n} += ${value(c.input(b, "DELTA"), c)}`); });
register("roblox_function_def", (b, c) => { const name = c.name(c.field(b, "NAME", "doSomething")); c.functionDepth++; c.indent++; const inside = body(c.input(b, "BODY"), c); c.indent--; c.functionDepth--; return `${c.pad(`local function ${name}()`)}\n${inside}\n${c.pad("end")}`; });
register("roblox_function_call", (b, c) => c.pad(`${c.name(c.field(b, "NAME", "doSomething"))}()`));
register("controls_if", (b, c) => { const condition = value(c.input(b, "IF0"), c); c.indent++; const inside = body(c.input(b, "DO0"), c); c.indent--; return `${c.pad(`if ${condition} then`)}\n${inside}\n${c.pad("end")}`; });
register("controls_repeat_ext", (b, c) => { const times = value(c.input(b, "TIMES"), c); c.loopDepth++; c.indent++; const inside = body(c.input(b, "DO"), c); c.indent--; c.loopDepth--; return `${c.pad(`for _ = 1, ${times} do`)}\n${inside}\n${c.pad("end")}`; });
register("roblox_kick_player", (b, c) => c.pad(`player:Kick(${q(c.field(b, "REASON", "Removed from game"))})`));
register("roblox_set_player_attribute", (b, c) => c.pad(`player:SetAttribute(${q(c.field(b, "NAME", "Level"))}, ${q(c.field(b, "VALUE", "1"))})`));
register("roblox_teleport", (b, c) => c.pad(`character:PivotTo(workspace:WaitForChild(${q(c.field(b, "PART", "Spawn"))}).CFrame)`));
register("roblox_create_part", (b, c) => c.pad(`do\n${"    ".repeat(c.indent + 1)}local part = Instance.new("Part")\n${"    ".repeat(c.indent + 1)}part.Name = ${q(c.field(b, "NAME", "NewPart"))}\n${"    ".repeat(c.indent + 1)}part.Anchored = true\n${"    ".repeat(c.indent + 1)}part.Parent = workspace\n${c.pad("end")}`));
register("roblox_destroy_object", (b, c) => c.pad(`local object = workspace:FindFirstChild(${q(c.field(b, "PATH", "OldPart"))})\n${c.pad("if object then object:Destroy() end")}`));
register("roblox_set_transparency", (b, c) => c.pad(`workspace:WaitForChild(${q(c.field(b, "PART", "Part"))}).Transparency = ${c.field(b, "VALUE", "0.5")}`));
register("roblox_set_anchored", (b, c) => c.pad(`workspace:WaitForChild(${q(c.field(b, "PART", "Part"))}).Anchored = ${c.field(b, "VALUE", "TRUE") === "TRUE" ? "true" : "false"}`));
register("roblox_apply_impulse", (b, c) => c.pad(`character.HumanoidRootPart:ApplyImpulse(Vector3.new(0, ${c.field(b, "VALUE", "50")}, 0) * character.HumanoidRootPart.AssemblyMass)`));
register("roblox_play_sound", (b, c) => c.pad(`workspace:WaitForChild(${q(c.field(b, "SOUND", "WinSound"))}):Play()`));
register("roblox_play_asset_sound", (b, c) => c.pad(`do\n${"    ".repeat(c.indent + 1)}local sound = Instance.new("Sound")\n${"    ".repeat(c.indent + 1)}sound.SoundId = "rbxassetid://${c.field(b, "ASSET", "1843529605")}"\n${"    ".repeat(c.indent + 1)}sound.Parent = workspace\n${"    ".repeat(c.indent + 1)}sound:Play()\n${c.pad("end")}`));
register("roblox_give_tool", (b, c) => { c.service("ServerStorage"); return c.pad(`ServerStorage:WaitForChild(${q(c.field(b, "TOOL", "Sword"))}):Clone().Parent = player.Backpack`); });
register("roblox_show_gui", (b, c) => c.pad(`player.PlayerGui:WaitForChild(${q(c.field(b, "GUI", "ShopGui"))}).Enabled = true`));
register("roblox_hide_gui", (b, c) => c.pad(`player.PlayerGui:WaitForChild(${q(c.field(b, "GUI", "ShopGui"))}).Enabled = false`));
register("roblox_set_text", (b, c) => c.pad(`player.PlayerGui:WaitForChild(${q(c.field(b, "LABEL", "StatusLabel"))}, true).Text = ${q(c.field(b, "TEXT", "Ready!"))}`));
register("roblox_set_camera", (b, c) => c.pad(`workspace.CurrentCamera.CameraSubject = ${c.field(b, "TARGET", "Humanoid")}`));
register("roblox_load_data", (b, c) => { c.service("DataStoreService"); const store = c.field(b, "STORE", "PlayerData"); return c.pad(`local dataStore = DataStoreService:GetDataStore(${q(store)})\n${c.pad("local success, savedData = pcall(function()") }\n${"    ".repeat(c.indent + 1)}return dataStore:GetAsync(tostring(player.UserId))\n${c.pad("end)")}\n${c.pad("local playerData = success and savedData or {}")}`); });
register("roblox_save_data", (_b, c) => c.pad(`local success, saveError = pcall(function()\n${"    ".repeat(c.indent + 1)}dataStore:UpdateAsync(tostring(player.UserId), function()\n${"    ".repeat(c.indent + 2)}return playerData\n${"    ".repeat(c.indent + 1)}end)\n${c.pad("end)")}\n${c.pad('if not success then warn("Could not save player data:", saveError) end')}`));

// Core language
register("logic_if_else", (b, c) => { const condition = value(c.input(b, "CONDITION"), c); c.indent++; const yes = body(c.input(b, "THEN"), c); const no = body(c.input(b, "ELSE"), c); c.indent--; return `${c.pad(`if ${condition} then`)}\n${yes}\n${c.pad("else")}\n${no}\n${c.pad("end")}`; });
register("control_while", (b, c) => { const condition = value(c.input(b, "CONDITION"), c); c.loopDepth++; c.indent++; const inside = body(c.input(b, "BODY"), c); const yieldLine = c.pad("task.wait()"); c.indent--; c.loopDepth--; return `${c.pad(`while ${condition} do`)}\n${inside}\n${yieldLine}\n${c.pad("end")}`; });
register("control_forever", (b, c) => { c.loopDepth++; c.indent++; const inside = body(c.input(b, "BODY"), c); const yieldLine = c.pad("task.wait()"); c.indent--; c.loopDepth--; return `${c.pad("while true do")}\n${inside}\n${yieldLine}\n${c.pad("end")}`; });
register("control_for_each", (b, c) => { const item = c.name(c.field(b, "ITEM", "item")); const collection = value(c.input(b, "COLLECTION"), c); c.loopDepth++; c.indent++; const inside = body(c.input(b, "BODY"), c); c.indent--; c.loopDepth--; return `${c.pad(`for _, ${item} in ipairs(${collection}) do`)}\n${inside}\n${c.pad("end")}`; });
register("control_return", (b, c) => { if (c.functionDepth === 0) c.warn("Return should be placed inside a function or event callback.", b); return c.pad(`return${c.input(b, "VALUE") ? ` ${value(c.input(b, "VALUE"), c)}` : ""}`); });
register("control_break", (b, c) => { if (c.loopDepth === 0) c.warn("Stop this loop must be placed inside a loop.", b); return c.pad("break"); });
register("control_continue", (b, c) => { if (c.loopDepth === 0) c.warn("Skip iteration must be placed inside a loop.", b); return c.pad("continue"); });
register("variable_create", (b, c) => { const annotation = c.field(b, "TYPE", "any"); return c.pad(`local ${c.name(c.field(b, "NAME", "score"))}: ${annotation} = ${value(c.input(b, "VALUE"), c)}`); });
register("function_with_params", (b, c) => { const name = c.name(c.field(b, "NAME", "calculate")); const params = c.field(b, "PARAMS", "").split(",").map((part) => part.trim()).filter(Boolean).map((part) => { const [rawName, rawType] = part.split(":").map((piece) => piece.trim()); return `${c.name(rawName)}${rawType ? `: ${c.name(rawType, "any")}` : ""}`; }).join(", "); c.functionDepth++; c.indent++; const inside = body(c.input(b, "BODY"), c); c.indent--; c.functionDepth--; return `${c.pad(`local function ${name}(${params})`)}\n${inside}\n${c.pad("end")}`; });

// World and object model
register("roblox_set_part_color", (b, c) => { const [r, g, blue] = c.field(b, "RGB", "255,80,80").split(",").map((part) => Number(part.trim()) || 0); return c.pad(`workspace:WaitForChild(${q(c.field(b, "PART", "Part"))}).Color = Color3.fromRGB(${r}, ${g}, ${blue})`); });
register("world_clone", (b, c) => c.pad(`local ${c.name(c.field(b, "NAME", "copy"))} = ${value(c.input(b, "OBJECT"), c)}:Clone()`));
register("world_create_object", (b, c) => { const variable = c.name(c.field(b, "VAR", "object")); return `${c.pad(`local ${variable} = Instance.new(${q(c.field(b, "CLASS", "Part"))})`)}\n${c.pad(`${variable}.Name = ${q(c.field(b, "OBJECT_NAME", "Object"))}`)}`; });
register("world_set_parent", (b, c) => c.pad(`${value(c.input(b, "OBJECT"), c)}.Parent = ${value(c.input(b, "PARENT"), c)}`));
register("world_set_position", (b, c) => c.pad(`${value(c.input(b, "OBJECT"), c)}.Position = Vector3.new(${c.field(b, "X", "0")}, ${c.field(b, "Y", "5")}, ${c.field(b, "Z", "0")})`));
register("world_change_position", (b, c) => { const object = value(c.input(b, "OBJECT"), c); return c.pad(`${object}.Position += Vector3.new(${c.field(b, "X", "0")}, ${c.field(b, "Y", "1")}, ${c.field(b, "Z", "0")})`); });
register("world_set_size", (b, c) => c.pad(`${value(c.input(b, "OBJECT"), c)}.Size = Vector3.new(${c.field(b, "X", "4")}, ${c.field(b, "Y", "1")}, ${c.field(b, "Z", "4")})`));
register("world_set_material", (b, c) => c.pad(`${value(c.input(b, "OBJECT"), c)}.Material = Enum.Material.${c.field(b, "MATERIAL", "Plastic")}`));
register("world_set_collide", (b, c) => c.pad(`${value(c.input(b, "OBJECT"), c)}.CanCollide = ${bool(c.field(b, "VALUE", "TRUE"))}`));
register("world_set_property", (b, c) => c.pad(`${value(c.input(b, "OBJECT"), c)}.${c.name(c.field(b, "PROPERTY", "Name"))} = ${value(c.input(b, "VALUE"), c)}`));
register("world_call_method", (b, c) => c.pad(`${value(c.input(b, "OBJECT"), c)}:${c.name(c.field(b, "METHOD", "PivotTo"))}(${c.field(b, "ARGS", "")})`));
register("world_set_attribute", (b, c) => c.pad(`${value(c.input(b, "OBJECT"), c)}:SetAttribute(${q(c.field(b, "NAME", "Level"))}, ${value(c.input(b, "VALUE"), c)})`));

// Player and character
register("character_heal", (b, c) => { const humanoid = value(c.input(b, "HUMANOID"), c); return c.pad(`${humanoid}.Health = math.min(${humanoid}.MaxHealth, ${humanoid}.Health + ${value(c.input(b, "AMOUNT"), c)})`); });
register("character_kill", (b, c) => c.pad(`${value(c.input(b, "HUMANOID"), c)}.Health = 0`));
register("character_move_position", (b, c) => c.pad(`${value(c.input(b, "CHARACTER"), c)}:PivotTo(CFrame.new(${c.field(b, "X", "0")}, ${c.field(b, "Y", "5")}, ${c.field(b, "Z", "0")}))`));
register("character_move_object", (b, c) => { const object = value(c.input(b, "OBJECT"), c); return c.pad(`${value(c.input(b, "CHARACTER"), c)}:PivotTo(${object}:IsA("Model") and ${object}:GetPivot() or ${object}.CFrame)`); });
register("player_respawn", (b, c) => c.pad(`${value(c.input(b, "PLAYER"), c)}:LoadCharacter()`));
register("player_set_team", (b, c) => { c.service("Teams"); return c.pad(`${value(c.input(b, "PLAYER"), c)}.Team = Teams:FindFirstChild(${q(c.field(b, "TEAM", "Blue"))})`); });

// Tweening and raycasting
register("tween_object", (b, c) => { c.service("TweenService"); const object = value(c.input(b, "OBJECT"), c); const property = c.name(c.field(b, "PROPERTY", "Transparency")); return `${c.pad(`local tweenInfo = TweenInfo.new(${c.field(b, "SECONDS", "1")}, Enum.EasingStyle.${c.field(b, "STYLE", "Quad")}, Enum.EasingDirection.${c.field(b, "DIRECTION", "Out")})`)}\n${c.pad(`local currentTween = TweenService:Create(${object}, tweenInfo, { ${property} = ${value(c.input(b, "VALUE"), c)} })`)}\n${c.pad("currentTween:Play()")}`; });
register("tween_wait", (_b, c) => c.pad("if currentTween then currentTween.Completed:Wait() end"));
register("raycast_exclude", (b, c) => { c.helpers.add("raycast"); return c.pad(`table.insert(raycastExclusions, ${value(c.input(b, "OBJECT"), c)})`); });
register("raycast_clear_filter", (_b, c) => { c.helpers.add("raycast"); return c.pad("table.clear(raycastExclusions)"); });
register("raycast_cast", (b, c) => { c.helpers.add("raycast"); const origin = value(c.input(b, "ORIGIN"), c); return `${c.pad("raycastParams.FilterDescendantsInstances = raycastExclusions")}\n${c.pad(`lastRaycastResult = workspace:Raycast(${origin}.Position, Vector3.new(${c.field(b, "X", "0")}, ${c.field(b, "Y", "0")}, ${c.field(b, "Z", "-1")}).Unit * ${c.field(b, "DISTANCE", "500")}, raycastParams)`)}`; });
register("raycast_screen", (b, c) => { c.helpers.add("raycast"); c.service("Players"); c.service("UserInputService"); return `${c.pad("local camera = workspace.CurrentCamera")}\n${c.pad("local mouseLocation = UserInputService:GetMouseLocation()")}\n${c.pad("local screenRay = camera:ViewportPointToRay(mouseLocation.X, mouseLocation.Y)")}\n${c.pad(`lastRaycastResult = workspace:Raycast(screenRay.Origin, screenRay.Direction * ${c.field(b, "DISTANCE", "1000")}, raycastParams)`)}`; });

// Animation
register("animation_load", (b, c) => { const track = c.name(c.field(b, "VAR", "animationTrack")); return `${c.pad("local animation = Instance.new(\"Animation\")")}\n${c.pad(`animation.AnimationId = "rbxassetid://${c.field(b, "ASSET", "507771019")}"`)}\n${c.pad(`local ${track} = ${value(c.input(b, "ANIMATOR"), c)}:LoadAnimation(animation)`)}`; });
register("animation_play", (b, c) => c.pad(`${c.name(c.field(b, "TRACK", "animationTrack"))}:Play()`));
register("animation_stop", (b, c) => c.pad(`${c.name(c.field(b, "TRACK", "animationTrack"))}:Stop(${c.field(b, "FADE", "0.2")})`));
register("animation_speed", (b, c) => c.pad(`${c.name(c.field(b, "TRACK", "animationTrack"))}:AdjustSpeed(${c.field(b, "SPEED", "1")})`));
register("animation_priority", (b, c) => c.pad(`${c.name(c.field(b, "TRACK", "animationTrack"))}.Priority = Enum.AnimationPriority.${c.field(b, "PRIORITY", "Action")}`));
register("animation_looped", (b, c) => c.pad(`${c.name(c.field(b, "TRACK", "animationTrack"))}.Looped = ${bool(c.field(b, "VALUE", "TRUE"))}`));

// Networking
register("network_send_server", (b, c) => { c.service("ReplicatedStorage"); return c.pad(`ReplicatedStorage:WaitForChild(${q(c.field(b, "REMOTE", "Action"))}):FireServer(${value(c.input(b, "VALUE"), c)})`); });
register("network_send_player", (b, c) => { c.service("ReplicatedStorage"); return c.pad(`ReplicatedStorage:WaitForChild(${q(c.field(b, "REMOTE", "Update"))}):FireClient(${value(c.input(b, "PLAYER"), c)}, ${value(c.input(b, "VALUE"), c)})`); });
register("network_send_all", (b, c) => { c.service("ReplicatedStorage"); return c.pad(`ReplicatedStorage:WaitForChild(${q(c.field(b, "REMOTE", "Update"))}):FireAllClients(${value(c.input(b, "VALUE"), c)})`); });

// Sound and GUI
for (const [type, method] of [["sound_stop", "Stop"], ["sound_pause", "Pause"], ["sound_resume", "Resume"]] as const) register(type, (b, c) => c.pad(`workspace:WaitForChild(${q(c.field(b, "SOUND", "Music"))}):${method}()`));
register("sound_volume", (b, c) => c.pad(`workspace:WaitForChild(${q(c.field(b, "SOUND", "Music"))}).Volume = ${c.field(b, "VALUE", "0.5")}`));
register("sound_speed", (b, c) => c.pad(`workspace:WaitForChild(${q(c.field(b, "SOUND", "Music"))}).PlaybackSpeed = ${c.field(b, "VALUE", "1")}`));
register("sound_looped", (b, c) => c.pad(`workspace:WaitForChild(${q(c.field(b, "SOUND", "Music"))}).Looped = ${bool(c.field(b, "VALUE", "TRUE"))}`));
const gui = (c: CompilerContext, name: string) => { c.service("Players"); return `Players.LocalPlayer.PlayerGui:FindFirstChild(${q(name)}, true)`; };
register("gui_set_image", (b, c) => c.pad(`${gui(c, c.field(b, "OBJECT", "Icon"))}.Image = "rbxassetid://${c.field(b, "ASSET", "0")}"`));
register("gui_set_visible", (b, c) => c.pad(`${gui(c, c.field(b, "OBJECT", "Panel"))}.Visible = ${bool(c.field(b, "VALUE", "TRUE"))}`));
register("gui_toggle_visible", (b, c) => { const object = gui(c, c.field(b, "OBJECT", "Panel")); return c.pad(`${object}.Visible = not ${object}.Visible`); });
register("gui_set_position", (b, c) => c.pad(`${gui(c, c.field(b, "OBJECT", "Panel"))}.Position = UDim2.fromScale(${c.field(b, "X", "0.5")}, ${c.field(b, "Y", "0.5")})`));
register("gui_set_size", (b, c) => c.pad(`${gui(c, c.field(b, "OBJECT", "Panel"))}.Size = UDim2.fromScale(${c.field(b, "X", "0.5")}, ${c.field(b, "Y", "0.5")})`));
register("gui_text_color", (b, c) => { const rgb = c.field(b, "RGB", "255,255,255").split(",").map((part) => Number(part.trim()) || 0); return c.pad(`${gui(c, c.field(b, "OBJECT", "Label"))}.TextColor3 = Color3.fromRGB(${rgb.join(", ")})`); });
register("gui_background_color", (b, c) => { const rgb = c.field(b, "RGB", "30,30,40").split(",").map((part) => Number(part.trim()) || 0); return c.pad(`${gui(c, c.field(b, "OBJECT", "Panel"))}.BackgroundColor3 = Color3.fromRGB(${rgb.join(", ")})`); });
register("gui_transparency", (b, c) => c.pad(`${gui(c, c.field(b, "OBJECT", "Panel"))}.BackgroundTransparency = ${c.field(b, "VALUE", "0.5")}`));

// Tags and utilities
register("tag_add", (b, c) => { c.service("CollectionService"); return c.pad(`CollectionService:AddTag(${value(c.input(b, "OBJECT"), c)}, ${q(c.field(b, "TAG", "Enemy"))})`); });
register("tag_remove", (b, c) => { c.service("CollectionService"); return c.pad(`CollectionService:RemoveTag(${value(c.input(b, "OBJECT"), c)}, ${q(c.field(b, "TAG", "Enemy"))})`); });
register("utility_cooldown_start", (b, c) => { c.helpers.add("cooldowns"); return c.pad(`cooldowns[${q(c.field(b, "NAME", "Attack"))}] = os.clock() + ${c.field(b, "SECONDS", "2")}`); });
register("utility_timer_start", (b, c) => { c.helpers.add("timers"); return c.pad(`timers[${q(c.field(b, "NAME", "Round"))}] = os.clock()`); });
register("utility_timer_reset", (b, c) => { c.helpers.add("timers"); return c.pad(`timers[${q(c.field(b, "NAME", "Round"))}] = os.clock()`); });
register("utility_countdown", (b, c) => { const name = c.name(c.field(b, "NAME", "Round")); const seconds = c.field(b, "SECONDS", "60"); c.loopDepth++; c.indent++; const inside = body(c.input(b, "BODY"), c); const wait = c.pad("task.wait(1)"); c.indent--; c.loopDepth--; return `${c.pad(`for countdownValue = ${seconds}, 0, -1 do -- ${name}`)}\n${inside}\n${wait}\n${c.pad("end")}`; });
register("table_add", (b, c) => c.pad(`table.insert(${value(c.input(b, "TABLE"), c)}, ${value(c.input(b, "VALUE"), c)})`));
register("table_remove", (b, c) => c.pad(`table.remove(${value(c.input(b, "TABLE"), c)}, ${value(c.input(b, "INDEX"), c)})`));
register("roblox_custom_luau", (b, c) => c.field(b, "CODE", "-- advanced code").split("\n").map((line) => c.pad(line)).join("\n"));

function validateBlock(block: JsonBlock, ctx: CompilerContext) {
  const def = BLOCK_MAP.get(block.type);
  if (def && !def.allowedContexts.includes("both") && !def.allowedContexts.includes(ctx.scriptType === "module" ? "both" : ctx.scriptType)) {
    const needed = def.allowedContexts[0] === "client" ? "Local Script" : "Server Script";
    ctx.warn(`“${def.label}” needs to run inside a ${needed}.`, block);
  }
}

function chain(first: JsonBlock, ctx: CompilerContext): string {
  const chunks: string[] = []; let block: JsonBlock | undefined = first;
  while (block) {
    validateBlock(block, ctx);
    const start = chunks.join("\n").split("\n").length + ctx.line;
    const generator = registry.get(block.type);
    const generated = generator ? generator(block, ctx) : ctx.pad(`-- TODO: ${BLOCK_MAP.get(block.type)?.label ?? block.type}`);
    chunks.push(generated);
    if (block.id) ctx.sourceMap.push({ blockId: block.id, startLine: start, endLine: start + generated.split("\n").length - 1 });
    if (BLOCK_MAP.get(block.type)?.kind === "event") break;
    block = block.next?.block;
  }
  return chunks.join("\n");
}

export function compileWorkspace(workspace: Record<string, unknown>, scriptType: ScriptType): CompileResult {
  const ctx = new CompilerContext(scriptType);
  const root = workspace.blocks as { blocks?: JsonBlock[] } | undefined;
  const roots = root?.blocks ?? [];
  if (!roots.length) ctx.diagnostics.push({ severity: "info", message: "Drag an event block into the workspace to begin." });
  const bodies = roots.map((block) => chain(block, ctx));
  const helperLines: string[] = [];
  if (ctx.helpers.has("cooldowns")) helperLines.push("local cooldowns = {}");
  if (ctx.helpers.has("timers")) helperLines.push("local timers = {}");
  if (ctx.helpers.has("raycast")) helperLines.push("local raycastExclusions = {}", "local raycastParams = RaycastParams.new()", "raycastParams.FilterType = Enum.RaycastFilterType.Exclude", "local lastRaycastResult = nil");
  const header = [[...ctx.services].sort().map((service) => `local ${service} = game:GetService("${service}")`).join("\n"), helperLines.join("\n")].filter(Boolean).join("\n\n");
  const code = [header, ...bodies].filter(Boolean).join("\n\n") || "-- Drag blocks into the workspace to generate Luau.";
  const offset = header ? header.split("\n").length + 2 : 0;
  const sourceMap: SourceRange[] = ctx.sourceMap.map((range) => ({ ...range, startLine: range.startLine + offset, endLine: range.endLine + offset }));
  return { code: `${code.trim()}\n`, diagnostics: ctx.diagnostics, sourceMap, explanations: [...ctx.explanations] };
}
