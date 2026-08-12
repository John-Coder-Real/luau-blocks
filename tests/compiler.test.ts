import assert from "node:assert/strict";
import test from "node:test";
import { compileWorkspace } from "../app/lib/compiler";

type B = Record<string, unknown>;
let serial = 0;
const b = (type: string, fields: Record<string, unknown> = {}, next?: B, inputs?: Record<string, unknown>): B => ({ type, id: `b${++serial}`, fields, ...(next ? { next: { block: next } } : {}), ...(inputs ? { inputs } : {}) });
const ws = (...roots: B[]) => ({ blocks: { languageVersion: 0, blocks: roots } });

test("player joined generates PlayerAdded and scoped player", () => {
  const result = compileWorkspace(ws(b("roblox_player_joined", {}, b("roblox_print", {}, undefined, { VALUE: { block: b("roblox_player_name") } }))), "server");
  assert.match(result.code, /Players\.PlayerAdded:Connect\(function\(player\)/);
  assert.match(result.code, /print\(player\.Name\)/);
});

test("kill brick generates guarded touch code", () => {
  const result = compileWorkspace(ws(b("roblox_part_touched", { PART: "Lava" }, b("roblox_set_health", { VALUE: 0 }))), "server");
  assert.match(result.code, /workspace:WaitForChild\("Lava"\)/);
  assert.match(result.code, /if player and humanoid then/);
  assert.match(result.code, /humanoid\.Health = 0/);
});

test("speed pad is deterministic and readable", () => {
  const root = b("roblox_part_touched", { PART: "SpeedPad" }, b("roblox_set_walkspeed", { VALUE: 32 }, b("controls_wait", { SECONDS: 3 }, b("roblox_set_walkspeed", { VALUE: 16 }))));
  const first = compileWorkspace(ws(root), "server").code;
  assert.equal(first, compileWorkspace(ws(root), "server").code);
  assert.match(first, /WalkSpeed = 32[\s\S]*task\.wait\(3\)[\s\S]*WalkSpeed = 16/);
});

test("if statement compiles its nested body", () => {
  const condition = b("logic_boolean", { BOOL: "TRUE" });
  const root = b("controls_if", {}, undefined, { IF0: { block: condition }, DO0: { block: b("roblox_print", {}, undefined, { VALUE: { shadow: b("text", { TEXT: "yes" }) } }) } });
  assert.match(compileWorkspace(ws(root), "server").code, /if true then[\s\S]*print\("yes"\)[\s\S]*end/);
});

test("repeat loop uses a bounded Luau for loop", () => {
  const root = b("controls_repeat_ext", {}, undefined, { TIMES: { shadow: b("math_number", { NUM: 5 }) }, DO: { block: b("controls_wait", { SECONDS: 0.1 }) } });
  assert.match(compileWorkspace(ws(root), "server").code, /for _ = 1, 5 do[\s\S]*task\.wait\(0\.1\)/);
});

test("variables are sanitized", () => {
  const root = b("variables_set", { VAR: "coin count" }, undefined, { VALUE: { shadow: b("math_number", { NUM: 0 }) } });
  assert.match(compileWorkspace(ws(root), "server").code, /local coin_count = 0/);
});

test("function definition and call compile", () => {
  const call = b("roblox_function_call", { NAME: "announce win" });
  const def = b("roblox_function_def", { NAME: "announce win" }, call, { BODY: { block: b("roblox_print", {}, undefined, { VALUE: { shadow: b("text", { TEXT: "Winner!" }) } }) } });
  assert.match(compileWorkspace(ws(def), "server").code, /local function announce_win\(\)[\s\S]*print\("Winner!"\)[\s\S]*announce_win\(\)/);
});

test("GUI button click generates local PlayerGui lookup", () => {
  const result = compileWorkspace(ws(b("roblox_button_clicked", { BUTTON: "PlayButton" }, b("roblox_print", {}, undefined, { VALUE: { shadow: b("text", { TEXT: "clicked" }) } }))), "client");
  assert.match(result.code, /Players\.LocalPlayer/);
  assert.match(result.code, /button\.Activated:Connect/);
});

test("tool activated produces an Activated event", () => {
  const result = compileWorkspace(ws(b("roblox_tool_activated", { TOOL: "Sword" }, b("roblox_print"))), "client");
  assert.match(result.code, /Backpack:WaitForChild\("Sword"\)/);
  assert.match(result.code, /tool\.Activated:Connect/);
});

test("data abstraction uses protected DataStore calls", () => {
  const root = b("roblox_player_joined", {}, b("roblox_load_data", { STORE: "PlayerData" }, b("roblox_save_data")));
  const code = compileWorkspace(ws(root), "server").code;
  assert.match(code, /DataStoreService:GetDataStore\("PlayerData"\)/);
  assert.match(code, /pcall\(function\(\)/);
  assert.match(code, /UpdateAsync/);
});

test("required services are sorted and deduplicated", () => {
  const roots = [b("roblox_player_joined"), b("roblox_player_joined"), b("roblox_give_tool", { TOOL: "Sword" })];
  const code = compileWorkspace(ws(...roots), "server").code;
  assert.equal((code.match(/GetService\("Players"\)/g) ?? []).length, 1);
  assert.equal((code.match(/GetService\("ServerStorage"\)/g) ?? []).length, 1);
});

test("server/client validation explains context mismatch", () => {
  const clientInServer = compileWorkspace(ws(b("roblox_show_gui", { GUI: "Shop" })), "server");
  assert.equal(clientInServer.diagnostics[0]?.severity, "warning");
  assert.match(clientInServer.diagnostics[0]?.message ?? "", /Local Script/);
  const serverInClient = compileWorkspace(ws(b("roblox_load_data", { STORE: "Data" })), "client");
  assert.match(serverInClient.diagnostics[0]?.message ?? "", /Server Script/);
});

test("expanded Boolean logic and if else compile", () => {
  const condition = b("logic_and", {}, undefined, { A: { block: b("logic_boolean", { BOOL: "TRUE" }) }, B: { block: b("logic_not", {}, undefined, { VALUE: { block: b("logic_boolean", { BOOL: "FALSE" }) } }) } });
  const root = b("logic_if_else", {}, undefined, { CONDITION: { block: condition }, THEN: { block: b("roblox_print", {}, undefined, { VALUE: { shadow: b("text", { TEXT: "yes" }) } }) }, ELSE: { block: b("roblox_print", {}, undefined, { VALUE: { shadow: b("text", { TEXT: "no" }) } }) } });
  assert.match(compileWorkspace(ws(root), "server").code, /if \(true and \(not false\)\) then[\s\S]*else[\s\S]*print\("no"\)/);
});

test("while, foreach, return, break and continue emit Luau control flow", () => {
  const loop = b("control_while", {}, b("control_for_each", { ITEM: "enemy" }, undefined, { COLLECTION: { block: b("table_from_text", { VALUES: "A, B" }) }, BODY: { block: b("control_continue") } }), { CONDITION: { block: b("logic_boolean", { BOOL: "TRUE" }) }, BODY: { block: b("control_break") } });
  const code = compileWorkspace(ws(loop, b("control_return", {}, undefined, { VALUE: { shadow: b("math_number", { NUM: 1 }) } })), "module").code;
  assert.match(code, /while true do[\s\S]*break[\s\S]*for _, enemy in ipairs\(\{ "A", "B" \}\) do[\s\S]*continue[\s\S]*return 1/);
});

test("expanded math and text values compile deterministically", () => {
  const clamp = b("math_clamp", {}, undefined, { VALUE: { block: b("math_round", {}, undefined, { VALUE: { block: b("math_random", {}, undefined, { MIN: { shadow: b("math_number", { NUM: 1 }) }, MAX: { shadow: b("math_number", { NUM: 10 }) } }) } }) }, MIN: { shadow: b("math_number", { NUM: 2 }) }, MAX: { shadow: b("math_number", { NUM: 8 }) } });
  const root = b("roblox_print", {}, b("roblox_print", {}, undefined, { VALUE: { block: b("text_upper", {}, undefined, { VALUE: { shadow: b("text", { TEXT: "hello" }) } }) } }), { VALUE: { block: clamp } });
  const code = compileWorkspace(ws(root), "server").code;
  assert.match(code, /math\.clamp\(math\.round\(math\.random\(1, 10\)\), 2, 8\)/);
  assert.match(code, /string\.upper\(tostring\("hello"\)\)/);
});

test("typed variables and parameterized functions compile", () => {
  const def = b("function_with_params", { NAME: "heal player", PARAMS: "player: Player, amount: number" }, undefined, { BODY: { block: b("variable_create", { TYPE: "number", NAME: "result" }, b("control_return", {}, undefined, { VALUE: { block: b("variables_get", { VAR: "result" }) } }), { VALUE: { shadow: b("math_number", { NUM: 10 }) } }) } });
  const code = compileWorkspace(ws(def), "server").code;
  assert.match(code, /local function heal_player\(player: Player, amount: number\)/);
  assert.match(code, /local result: number = 10[\s\S]*return result/);
});

test("object graph blocks generate safe references and mutations", () => {
  const object = b("world_workspace_object", { PATH: "Map.Spawn" });
  const root = b("world_set_position", { X: 1, Y: 2, Z: 3 }, b("world_set_material", { MATERIAL: "Neon" }, undefined, { OBJECT: { block: object } }), { OBJECT: { block: object } });
  const code = compileWorkspace(ws(root), "server").code;
  assert.match(code, /workspace:WaitForChild\("Map"\):WaitForChild\("Spawn"\)\.Position = Vector3\.new\(1, 2, 3\)/);
  assert.match(code, /\.Material = Enum\.Material\.Neon/);
});

test("character helpers and teams compile with required services", () => {
  const player = b("player_current");
  const character = b("player_character", {}, undefined, { PLAYER: { block: player } });
  const humanoid = b("character_humanoid", {}, undefined, { CHARACTER: { block: character } });
  const root = b("character_heal", {}, b("player_set_team", { TEAM: "Blue" }, undefined, { PLAYER: { block: player } }), { HUMANOID: { block: humanoid }, AMOUNT: { shadow: b("math_number", { NUM: 25 }) } });
  const code = compileWorkspace(ws(root), "server").code;
  assert.match(code, /local Players = game:GetService\("Players"\)/);
  assert.match(code, /local Teams = game:GetService\("Teams"\)/);
  assert.match(code, /math\.min\(.+MaxHealth/);
});

test("tween and raycasting add services and reusable ray state", () => {
  const object = b("world_workspace_object", { PATH: "Door" });
  const tween = b("tween_object", { PROPERTY: "Transparency", SECONDS: 1, STYLE: "Quad", DIRECTION: "Out" }, b("raycast_cast", { X: 0, Y: 0, Z: -1, DISTANCE: 100 }, undefined, { ORIGIN: { block: object } }), { OBJECT: { block: object }, VALUE: { shadow: b("math_number", { NUM: 1 }) } });
  const code = compileWorkspace(ws(tween), "server").code;
  assert.match(code, /TweenService/);
  assert.match(code, /local raycastParams = RaycastParams\.new\(\)/);
  assert.match(code, /workspace:Raycast/);
});

test("client input events compile and warn in server scripts", () => {
  const root = b("input_key_pressed", { KEY: "E" }, b("roblox_print", {}, undefined, { VALUE: { shadow: b("text", { TEXT: "pressed" }) } }));
  const client = compileWorkspace(ws(root), "client");
  assert.match(client.code, /UserInputService\.InputBegan/);
  assert.match(client.code, /Enum\.KeyCode\.E/);
  assert.equal(compileWorkspace(ws(root), "server").diagnostics[0]?.severity, "warning");
});

test("animation load, play, priority and finish event compile", () => {
  const animator = b("animation_animator", {}, undefined, { HUMANOID: { block: b("character_humanoid", {}, undefined, { CHARACTER: { block: b("player_character", {}, undefined, { PLAYER: { block: b("player_current") } }) } }) } });
  const root = b("animation_load", { ASSET: "123", VAR: "runTrack" }, b("animation_priority", { TRACK: "runTrack", PRIORITY: "Action" }, b("animation_play", { TRACK: "runTrack" })), { ANIMATOR: { block: animator } });
  const eventRoot = b("animation_finished", { TRACK: "runTrack" }, b("roblox_print"));
  const code = compileWorkspace(ws(root, eventRoot), "client").code;
  assert.match(code, /AnimationId = "rbxassetid:\/\/123"/);
  assert.match(code, /runTrack\.Priority = Enum\.AnimationPriority\.Action/);
  assert.match(code, /runTrack\.Stopped:Connect/);
});

test("networking generates explicit client and server APIs", () => {
  const client = compileWorkspace(ws(b("network_send_server", { REMOTE: "Attack" }, undefined, { VALUE: { shadow: b("math_number", { NUM: 5 }) } })), "client");
  assert.match(client.code, /ReplicatedStorage:WaitForChild\("Attack"\):FireServer\(5\)/);
  const server = compileWorkspace(ws(b("network_receive_server", { REMOTE: "Attack" }, b("network_send_all", { REMOTE: "Update" }, undefined, { VALUE: { block: b("variables_get", { VAR: "remoteValue" }) } }))), "server");
  assert.match(server.code, /OnServerEvent:Connect\(function\(player, remoteValue\)/);
  assert.match(server.code, /FireAllClients\(remoteValue\)/);
  assert.match(compileWorkspace(ws(b("network_send_server")), "server").diagnostics[0]?.message ?? "", /Local Script/);
});

test("expanded sound, GUI and tags compile", () => {
  const roots = [b("sound_pause", { SOUND: "Music" }), b("gui_set_visible", { OBJECT: "Panel", VALUE: "FALSE" }), b("tag_add", { TAG: "Enemy" }, undefined, { OBJECT: { block: b("world_workspace_object", { PATH: "Zombie" }) } })];
  const code = compileWorkspace(ws(...roots), "client").code;
  assert.match(code, /:Pause\(\)/);
  assert.match(code, /\.Visible = false/);
  assert.match(code, /CollectionService:AddTag/);
});

test("cooldowns, timers and list utilities include only required helpers", () => {
  const list = b("table_from_text", { VALUES: "Sword, Shield" });
  const root = b("utility_cooldown_start", { NAME: "Attack", SECONDS: 2 }, b("utility_timer_start", { NAME: "Round" }, b("roblox_print", {}, undefined, { VALUE: { block: b("table_count", {}, undefined, { TABLE: { block: list } }) } })));
  const code = compileWorkspace(ws(root), "server").code;
  assert.match(code, /local cooldowns = \{\}/);
  assert.match(code, /local timers = \{\}/);
  assert.match(code, /cooldowns\["Attack"\] = os\.clock\(\) \+ 2/);
  assert.match(code, /#\{ "Sword", "Shield" \}/);
});
