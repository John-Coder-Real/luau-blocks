import type { BlockContext } from "./model";

export interface BlockMeta {
  id: string;
  category: string;
  label: string;
  description: string;
  keywords: string[];
  allowedContexts: BlockContext[];
  kind: "event" | "action" | "value" | "control";
  colour: string;
  block: Record<string, unknown>;
}

const colours: Record<string, string> = {
  Events: "#f59e0b", Player: "#3b82f6", Character: "#8b5cf6", World: "#10b981",
  GUI: "#ec4899", Sound: "#06b6d4", Tools: "#f97316", Camera: "#6366f1",
  Data: "#0f766e", Logic: "#14b8a6", Control: "#fb7185", Math: "#4f46e5",
  Text: "#7c3aed", Variables: "#2563eb", Functions: "#db2777", Input: "#0ea5e9",
  Networking: "#e11d48", Tween: "#a855f7", Raycasting: "#0891b2", Animation: "#d946ef",
  Tags: "#059669", Utilities: "#64748b", Advanced: "#475569",
};

const field = (name: string, text: string) => ({ type: "field_input", name, text });
const number = (name: string, value: number) => ({ type: "field_number", name, value });
const dropdown = (name: string, options: [string, string][]) => ({ type: "field_dropdown", name, options });

function meta(id: string, category: string, label: string, description: string, args0: unknown[] = [], extra: Record<string, unknown> = {}, context: BlockContext[] = ["both"], kind: BlockMeta["kind"] = "action", keywords: string[] = []): BlockMeta {
  return {
    id, category, label, description, keywords: [...keywords, ...label.toLowerCase().split(/\W+/)], allowedContexts: context,
    kind, colour: colours[category],
    block: { type: id, message0: label, args0, colour: colours[category], tooltip: description, helpUrl: "", ...extra },
  };
}

const statement = { previousStatement: null, nextStatement: null };
const event = { nextStatement: null, hat: "cap" };
const value = (output: string | null = null) => ({ output });

export const BLOCKS: BlockMeta[] = [
  meta("roblox_player_joined", "Events", "when player joins", "Runs once whenever a player enters the server.", [], event, ["server"], "event", ["added", "welcome"]),
  meta("roblox_player_leaves", "Events", "when player leaves", "Runs when a player leaves the server.", [], event, ["server"], "event"),
  meta("roblox_part_touched", "Events", "when player touches part %1", "Runs when a character touches the named Workspace part.", [field("PART", "Lava")], event, ["server", "client"], "event", ["hit", "brick", "pad"]),
  meta("roblox_character_spawned", "Events", "when character spawns", "Runs whenever the current player's character appears.", [], event, ["client"], "event"),
  meta("roblox_button_clicked", "Events", "when GUI button %1 clicked", "Runs when a TextButton or ImageButton is clicked.", [field("BUTTON", "PlayButton")], event, ["client"], "event", ["gui", "ui"]),
  meta("roblox_tool_activated", "Events", "when tool %1 activated", "Runs when the named tool is used.", [field("TOOL", "Sword")], event, ["both"], "event"),
  meta("roblox_prompt_triggered", "Events", "when prompt %1 triggered", "Runs when a ProximityPrompt is triggered.", [field("PROMPT", "DoorPrompt")], event, ["server"], "event"),

  meta("roblox_player_name", "Player", "player name", "The current player's display name.", [], value("String"), ["both"], "value", ["username"]),
  meta("roblox_player_userid", "Player", "player UserId", "The current player's numeric Roblox user ID.", [], value("Number"), ["both"], "value"),
  meta("roblox_kick_player", "Player", "kick player because %1", "Disconnects the current player with a friendly reason.", [field("REASON", "Removed from game")], statement, ["server"], "action"),
  meta("roblox_set_player_attribute", "Player", "set player attribute %1 to %2", "Stores a value on the current Player instance.", [field("NAME", "Level"), field("VALUE", "1")], statement),

  meta("roblox_set_health", "Character", "set player health to %1", "Sets the touched or current character's health.", [number("VALUE", 0)], statement, ["both"], "action", ["humanoid", "kill"]),
  meta("roblox_change_health", "Character", "damage player by %1", "Safely damages the current character.", [number("VALUE", 25)], statement, ["both"], "action", ["health", "take damage"]),
  meta("roblox_set_walkspeed", "Character", "set player WalkSpeed to %1", "Changes how fast the character walks.", [number("VALUE", 32)], statement, ["both"], "action", ["speed", "humanoid"]),
  meta("roblox_set_jumppower", "Character", "set player JumpPower to %1", "Changes how high the character jumps.", [number("VALUE", 50)], statement),
  meta("roblox_teleport", "Character", "teleport player to %1", "Moves the character to a named part in Workspace.", [field("PART", "Spawn")], statement, ["server"], "action", ["move", "position"]),

  meta("roblox_create_part", "World", "create part named %1", "Creates an anchored Part in Workspace.", [field("NAME", "NewPart")], statement, ["server"], "action", ["workspace", "brick"]),
  meta("roblox_destroy_object", "World", "destroy Workspace object %1", "Safely destroys a named Workspace object.", [field("PATH", "OldPart")], statement),
  meta("roblox_set_part_color", "World", "set %1 color to %2", "Changes a part to an RGB color.", [field("PART", "Part"), field("RGB", "255, 80, 80")], statement),
  meta("roblox_set_transparency", "World", "set %1 transparency to %2", "Changes part transparency from 0 to 1.", [field("PART", "Part"), number("VALUE", 0.5)], statement),
  meta("roblox_set_anchored", "World", "set %1 anchored %2", "Controls whether a part moves with physics.", [field("PART", "Part"), dropdown("VALUE", [["true", "TRUE"], ["false", "FALSE"]])], statement),
  meta("roblox_apply_impulse", "World", "apply upward impulse %1", "Pushes the current character upward.", [number("VALUE", 50)], statement, ["server"], "action", ["physics", "velocity"]),

  meta("roblox_show_gui", "GUI", "show GUI %1", "Shows a ScreenGui for the current player.", [field("GUI", "ShopGui")], statement, ["client"], "action", ["interface"]),
  meta("roblox_hide_gui", "GUI", "hide GUI %1", "Hides a ScreenGui for the current player.", [field("GUI", "ShopGui")], statement, ["client"], "action"),
  meta("roblox_set_text", "GUI", "set label %1 text to %2", "Changes a TextLabel or TextButton's text.", [field("LABEL", "StatusLabel"), field("TEXT", "Ready!")], statement, ["client"], "action"),
  meta("roblox_play_sound", "Sound", "play sound %1", "Plays a named Sound under Workspace.", [field("SOUND", "WinSound")], statement),
  meta("roblox_play_asset_sound", "Sound", "play sound asset %1", "Creates and plays a Roblox audio asset.", [field("ASSET", "1843529605")], statement),
  meta("roblox_give_tool", "Tools", "give player tool %1", "Clones a tool from ServerStorage into the player's Backpack.", [field("TOOL", "Sword")], statement, ["server"], "action"),
  meta("roblox_set_camera", "Camera", "set camera to follow %1", "Changes the local camera subject.", [field("TARGET", "Humanoid")], statement, ["client"], "action"),

  meta("roblox_load_data", "Data", "load player data store %1", "Loads player data with protected DataStore calls.", [field("STORE", "PlayerData")], statement, ["server"], "action", ["save", "persistent"]),
  meta("roblox_save_data", "Data", "save player data", "Saves the current data with a protected update.", [], statement, ["server"], "action", ["persistent"]),

  meta("controls_if", "Logic", "if %1 do %2", "Runs blocks only when a condition is true.", [{ type: "input_value", name: "IF0", check: "Boolean" }, { type: "input_statement", name: "DO0" }], statement, ["both"], "control"),
  meta("logic_boolean", "Logic", "%1", "A true or false value.", [dropdown("BOOL", [["true", "TRUE"], ["false", "FALSE"]])], value("Boolean"), ["both"], "value"),
  meta("logic_compare", "Logic", "%1 %2 %3", "Compares two values.", [{ type: "input_value", name: "A" }, dropdown("OP", [["=", "EQ"], ["≠", "NEQ"], ["<", "LT"], ["≤", "LTE"], [">", "GT"], ["≥", "GTE"]]), { type: "input_value", name: "B" }], value("Boolean"), ["both"], "value"),
  meta("controls_wait", "Control", "wait %1 seconds", "Pauses this task without freezing the game.", [number("SECONDS", 1)], statement, ["both"], "control", ["delay"]),
  meta("controls_repeat_ext", "Control", "repeat %1 times %2", "Repeats the connected blocks a fixed number of times.", [{ type: "input_value", name: "TIMES", check: "Number" }, { type: "input_statement", name: "DO" }], statement, ["both"], "control", ["loop"]),
  meta("math_number", "Math", "%1", "A number value.", [number("NUM", 0)], value("Number"), ["both"], "value"),
  meta("math_arithmetic", "Math", "%1 %2 %3", "Performs arithmetic.", [{ type: "input_value", name: "A", check: "Number" }, dropdown("OP", [["+", "ADD"], ["−", "MINUS"], ["×", "MULTIPLY"], ["÷", "DIVIDE"]]), { type: "input_value", name: "B", check: "Number" }], value("Number"), ["both"], "value"),
  meta("text", "Text", "text %1", "A text value.", [field("TEXT", "hello")], value("String"), ["both"], "value"),
  meta("text_join_simple", "Text", "join %1 and %2", "Combines two values as text.", [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }], value("String"), ["both"], "value"),
  meta("roblox_print", "Text", "print %1", "Writes a value to Roblox Studio's Output window.", [{ type: "input_value", name: "VALUE" }], statement, ["both"], "action", ["output", "debug"]),
  meta("variables_get", "Variables", "variable %1", "Reads a variable.", [{ type: "field_variable", name: "VAR", variable: "score" }], value(null), ["both"], "value"),
  meta("variables_set", "Variables", "set %1 to %2", "Creates or changes a variable.", [{ type: "field_variable", name: "VAR", variable: "score" }, { type: "input_value", name: "VALUE" }], statement),
  meta("math_change", "Variables", "change %1 by %2", "Adds a number to a variable.", [{ type: "field_variable", name: "VAR", variable: "score" }, { type: "input_value", name: "DELTA", check: "Number" }], statement),
  meta("roblox_function_def", "Functions", "define function %1 %2", "Creates a reusable named function.", [field("NAME", "doSomething"), { type: "input_statement", name: "BODY" }], statement, ["both"], "control", ["procedure", "custom"]),
  meta("roblox_function_call", "Functions", "call function %1", "Runs a function you defined.", [field("NAME", "doSomething")], statement, ["both"], "action", ["procedure"]),

  // Core language
  meta("logic_if_else", "Logic", "if %1 do %2 else %3", "Chooses between two block bodies.", [{ type: "input_value", name: "CONDITION", check: "Boolean" }, { type: "input_statement", name: "THEN" }, { type: "input_statement", name: "ELSE" }], statement, ["both"], "control"),
  meta("logic_and", "Logic", "%1 and %2", "True only when both conditions are true.", [{ type: "input_value", name: "A", check: "Boolean" }, { type: "input_value", name: "B", check: "Boolean" }], value("Boolean"), ["both"], "value"),
  meta("logic_or", "Logic", "%1 or %2", "True when either condition is true.", [{ type: "input_value", name: "A", check: "Boolean" }, { type: "input_value", name: "B", check: "Boolean" }], value("Boolean"), ["both"], "value"),
  meta("logic_not", "Logic", "not %1", "Reverses a Boolean value.", [{ type: "input_value", name: "VALUE", check: "Boolean" }], value("Boolean"), ["both"], "value"),
  meta("control_while", "Control", "while %1 do %2", "Repeats while a condition remains true and yields each cycle.", [{ type: "input_value", name: "CONDITION", check: "Boolean" }, { type: "input_statement", name: "BODY" }], statement, ["both"], "control"),
  meta("control_forever", "Control", "forever %1", "Repeats until its script or callback ends, yielding every cycle.", [{ type: "input_statement", name: "BODY" }], statement, ["both"], "control"),
  meta("control_for_each", "Control", "for each %1 in %2 do %3", "Loops through every item in a table or collection.", [field("ITEM", "item"), { type: "input_value", name: "COLLECTION" }, { type: "input_statement", name: "BODY" }], statement, ["both"], "control"),
  meta("control_return", "Control", "return %1", "Exits the current function and optionally returns a value.", [{ type: "input_value", name: "VALUE" }], { previousStatement: null }, ["both"], "control"),
  meta("control_break", "Control", "stop this loop", "Stops the nearest loop using break.", [], { previousStatement: null }, ["both"], "control"),
  meta("control_continue", "Control", "skip to next iteration", "Skips to the next loop iteration.", [], { previousStatement: null }, ["both"], "control"),
  meta("math_random", "Math", "random number from %1 to %2", "Returns a random number inside a range.", [{ type: "input_value", name: "MIN", check: "Number" }, { type: "input_value", name: "MAX", check: "Number" }], value("Number"), ["both"], "value"),
  meta("math_round", "Math", "round %1", "Rounds to the nearest integer.", [{ type: "input_value", name: "VALUE", check: "Number" }], value("Number"), ["both"], "value"),
  meta("math_floor", "Math", "floor %1", "Rounds a number down.", [{ type: "input_value", name: "VALUE", check: "Number" }], value("Number"), ["both"], "value"),
  meta("math_ceil", "Math", "ceil %1", "Rounds a number up.", [{ type: "input_value", name: "VALUE", check: "Number" }], value("Number"), ["both"], "value"),
  meta("math_clamp", "Math", "clamp %1 between %2 and %3", "Keeps a number between a minimum and maximum.", [{ type: "input_value", name: "VALUE", check: "Number" }, { type: "input_value", name: "MIN", check: "Number" }, { type: "input_value", name: "MAX", check: "Number" }], value("Number"), ["both"], "value"),
  meta("math_minmax", "Math", "%1 of %2 and %3", "Chooses the smaller or larger number.", [dropdown("MODE", [["minimum", "MIN"], ["maximum", "MAX"]]), { type: "input_value", name: "A", check: "Number" }, { type: "input_value", name: "B", check: "Number" }], value("Number"), ["both"], "value"),
  meta("math_abs", "Math", "absolute value of %1", "Removes the sign from a number.", [{ type: "input_value", name: "VALUE", check: "Number" }], value("Number"), ["both"], "value"),
  meta("text_length", "Text", "length of %1", "Returns the number of characters in text.", [{ type: "input_value", name: "VALUE", check: "String" }], value("Number"), ["both"], "value"),
  meta("text_contains", "Text", "%1 contains %2", "Tests whether text contains another string.", [{ type: "input_value", name: "TEXT", check: "String" }, { type: "input_value", name: "SEARCH", check: "String" }], value("Boolean"), ["both"], "value"),
  meta("text_upper", "Text", "uppercase %1", "Converts text to uppercase.", [{ type: "input_value", name: "VALUE" }], value("String"), ["both"], "value"),
  meta("text_lower", "Text", "lowercase %1", "Converts text to lowercase.", [{ type: "input_value", name: "VALUE" }], value("String"), ["both"], "value"),
  meta("text_tostring", "Text", "convert %1 to text", "Converts any value to a string.", [{ type: "input_value", name: "VALUE" }], value("String"), ["both"], "value"),
  meta("variable_create", "Variables", "create %1 variable %2 default %3", "Explicitly creates a typed variable with a default value.", [dropdown("TYPE", [["any", "any"], ["number", "number"], ["text", "string"], ["Boolean", "boolean"], ["Instance", "Instance"]]), field("NAME", "score"), { type: "input_value", name: "VALUE" }], statement),
  meta("function_with_params", "Functions", "define function %1 parameters %2 %3", "Defines a function with comma-separated name: type parameters.", [field("NAME", "calculate"), field("PARAMS", "player: Player, amount: number"), { type: "input_statement", name: "BODY" }], statement, ["both"], "control"),
  meta("function_call_args", "Functions", "result of %1 with arguments %2", "Calls a function with comma-separated Luau arguments and returns its value.", [field("NAME", "calculate"), field("ARGS", "player, 10")], value(null), ["both"], "value"),

  // Object and world model
  meta("world_workspace_object", "World", "Workspace object %1", "Returns an object under Workspace using a safe path.", [field("PATH", "Map.Spawn")], value("Instance"), ["both"], "value", ["object", "path"]),
  meta("world_find_child", "World", "find child %1 named %2", "Finds a direct child and returns nil if missing.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, field("NAME", "Child")], value("Instance"), ["both"], "value"),
  meta("world_wait_child", "World", "wait for child %1 named %2", "Waits for an expected child.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, field("NAME", "Child")], value("Instance"), ["both"], "value"),
  meta("world_get_parent", "World", "parent of %1", "Returns an object's parent.", [{ type: "input_value", name: "OBJECT", check: "Instance" }], value("Instance"), ["both"], "value"),
  meta("world_get_children", "World", "children of %1", "Returns all direct children as a table.", [{ type: "input_value", name: "OBJECT", check: "Instance" }], value("Array"), ["both"], "value"),
  meta("world_clone", "World", "clone %1 as %2", "Copies an Instance into a variable.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, field("NAME", "copy")], statement),
  meta("world_create_object", "World", "create %1 named %2 as %3", "Creates a Roblox Instance with a class dropdown.", [dropdown("CLASS", [["Part", "Part"], ["Model", "Model"], ["Folder", "Folder"], ["Attachment", "Attachment"], ["Sound", "Sound"], ["StringValue", "StringValue"], ["NumberValue", "NumberValue"], ["BoolValue", "BoolValue"]]), field("OBJECT_NAME", "Object"), field("VAR", "object")], statement, ["server", "client"], "action"),
  meta("world_set_parent", "World", "set parent of %1 to %2", "Reparents an object.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, { type: "input_value", name: "PARENT", check: "Instance" }], statement),
  meta("world_set_position", "World", "set position of %1 to X %2 Y %3 Z %4", "Sets a BasePart world position.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, number("X", 0), number("Y", 5), number("Z", 0)], statement),
  meta("world_change_position", "World", "move %1 by X %2 Y %3 Z %4", "Adds a Vector3 offset to a BasePart.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, number("X", 0), number("Y", 1), number("Z", 0)], statement),
  meta("world_set_size", "World", "set size of %1 to X %2 Y %3 Z %4", "Sets a BasePart size.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, number("X", 4), number("Y", 1), number("Z", 4)], statement),
  meta("world_set_material", "World", "set material of %1 to %2", "Sets a BasePart material.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, dropdown("MATERIAL", [["Plastic", "Plastic"], ["SmoothPlastic", "SmoothPlastic"], ["Neon", "Neon"], ["Metal", "Metal"], ["Wood", "Wood"], ["Grass", "Grass"], ["Ice", "Ice"], ["Concrete", "Concrete"]])], statement),
  meta("world_set_collide", "World", "set CanCollide of %1 to %2", "Enables or disables collision.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, dropdown("VALUE", [["true", "TRUE"], ["false", "FALSE"]])], statement),
  meta("world_get_property", "Advanced", "get %1 property %2", "Reads a common Roblox property using a type-aware menu.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, dropdown("PROPERTY", [["Name", "Name"], ["Parent", "Parent"], ["Position", "Position"], ["Size", "Size"], ["Color", "Color"], ["Transparency", "Transparency"], ["Value", "Value"], ["Enabled", "Enabled"], ["Visible", "Visible"], ["Text", "Text"]])], value(null), ["both"], "value"),
  meta("world_set_property", "Advanced", "set %1 property %2 to %3", "Writes a common Roblox property.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, dropdown("PROPERTY", [["Name", "Name"], ["Position", "Position"], ["Size", "Size"], ["Color", "Color"], ["Transparency", "Transparency"], ["Value", "Value"], ["Enabled", "Enabled"], ["Visible", "Visible"], ["Text", "Text"]]), { type: "input_value", name: "VALUE" }], statement),
  meta("world_call_method", "Advanced", "call %1 method %2 arguments %3", "Calls a contextual Roblox method with comma-separated arguments.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, dropdown("METHOD", [["Clone", "Clone"], ["Destroy", "Destroy"], ["PivotTo", "PivotTo"], ["MoveTo", "MoveTo"], ["Play", "Play"], ["Stop", "Stop"], ["Emit", "Emit"]]), field("ARGS", "target.CFrame")], statement),
  meta("world_get_attribute", "World", "get attribute %1 from %2", "Reads an Instance attribute.", [field("NAME", "Level"), { type: "input_value", name: "OBJECT", check: "Instance" }], value(null), ["both"], "value"),
  meta("world_set_attribute", "World", "set attribute %1 on %2 to %3", "Writes an Instance attribute.", [field("NAME", "Level"), { type: "input_value", name: "OBJECT", check: "Instance" }, { type: "input_value", name: "VALUE" }], statement),
  meta("event_attribute_changed", "Events", "when attribute %1 changes on %2", "Runs when an Instance attribute changes.", [field("NAME", "Level"), field("PATH", "Object")], event, ["both"], "event"),

  // Player and character values/actions
  meta("player_current", "Player", "current player", "Returns the player in the current event scope.", [], value("Player"), ["both"], "value"),
  meta("player_character", "Player", "character of %1", "Returns a player's current character.", [{ type: "input_value", name: "PLAYER", check: "Player" }], value("Character"), ["both"], "value"),
  meta("player_from_character", "Player", "player from character %1", "Finds the Player associated with a Character.", [{ type: "input_value", name: "CHARACTER", check: "Character" }], value("Player"), ["both"], "value"),
  meta("character_humanoid", "Character", "Humanoid of %1", "Finds a character's Humanoid.", [{ type: "input_value", name: "CHARACTER", check: "Character" }], value("Humanoid"), ["both"], "value"),
  meta("character_root", "Character", "HumanoidRootPart of %1", "Returns a character's root part.", [{ type: "input_value", name: "CHARACTER", check: "Character" }], value("Instance"), ["both"], "value"),
  meta("character_health", "Character", "health of %1", "Returns current Humanoid health.", [{ type: "input_value", name: "HUMANOID", check: "Humanoid" }], value("Number"), ["both"], "value"),
  meta("character_walkspeed", "Character", "WalkSpeed of %1", "Returns current Humanoid WalkSpeed.", [{ type: "input_value", name: "HUMANOID", check: "Humanoid" }], value("Number"), ["both"], "value"),
  meta("character_heal", "Character", "heal %1 by %2", "Safely adds health without exceeding MaxHealth.", [{ type: "input_value", name: "HUMANOID", check: "Humanoid" }, { type: "input_value", name: "AMOUNT", check: "Number" }], statement),
  meta("character_kill", "Character", "kill %1", "Sets a Humanoid's health to zero.", [{ type: "input_value", name: "HUMANOID", check: "Humanoid" }], statement),
  meta("character_move_position", "Character", "move %1 to X %2 Y %3 Z %4", "Moves a character model to a world position.", [{ type: "input_value", name: "CHARACTER", check: "Character" }, number("X", 0), number("Y", 5), number("Z", 0)], statement),
  meta("character_move_object", "Character", "move %1 to object %2", "Moves a character to a selected part or model.", [{ type: "input_value", name: "CHARACTER", check: "Character" }, { type: "input_value", name: "OBJECT", check: "Instance" }], statement),
  meta("player_respawn", "Player", "respawn %1", "Reloads a player's character.", [{ type: "input_value", name: "PLAYER", check: "Player" }], statement, ["server"], "action"),
  meta("player_team", "Player", "team of %1", "Returns a player's current Team.", [{ type: "input_value", name: "PLAYER", check: "Player" }], value("Instance"), ["both"], "value"),
  meta("player_set_team", "Player", "set team of %1 to %2", "Moves a player to a named Team.", [{ type: "input_value", name: "PLAYER", check: "Player" }, field("TEAM", "Blue")], statement, ["server"], "action"),

  // Expanded events
  meta("event_touch_ended", "Events", "when player stops touching part %1", "Runs when a character stops touching a Workspace part.", [field("PART", "Pad")], event, ["server", "client"], "event"),
  meta("event_character_died", "Events", "when character dies", "Runs when the scoped character's Humanoid dies.", [], event, ["both"], "event"),
  meta("event_tool_equipped", "Events", "when tool %1 equipped", "Runs when a tool is equipped.", [field("TOOL", "Sword")], event, ["client"], "event"),
  meta("event_tool_unequipped", "Events", "when tool %1 unequipped", "Runs when a tool is unequipped.", [field("TOOL", "Sword")], event, ["client"], "event"),
  meta("event_property_changed", "Events", "when property %1 changes on %2", "Runs when a property change signal fires.", [field("PROPERTY", "Value"), field("PATH", "Object")], event, ["both"], "event"),
  meta("event_player_chatted", "Events", "when player chats", "Runs whenever a player sends a chat message.", [], event, ["server"], "event"),
  meta("event_input_began", "Events", "when input begins", "Runs for local keyboard, mouse, touch, or gamepad input.", [], event, ["client"], "event"),
  meta("event_input_ended", "Events", "when input ends", "Runs when local input is released.", [], event, ["client"], "event"),
  meta("event_object_event", "Events", "when object %1 event %2", "Connects a common event on a Workspace object.", [field("PATH", "Door"), dropdown("EVENT", [["Touched", "Touched"], ["TouchEnded", "TouchEnded"], ["ChildAdded", "ChildAdded"], ["ChildRemoved", "ChildRemoved"], ["AncestryChanged", "AncestryChanged"], ["Changed", "Changed"]])], event, ["both"], "event"),

  // Tweening
  meta("tween_object", "Tween", "tween %1 property %2 to %3 over %4 seconds style %5 direction %6", "Animates a numeric, color, position, size, or transparency property.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, field("PROPERTY", "Transparency"), { type: "input_value", name: "VALUE" }, number("SECONDS", 1), dropdown("STYLE", [["Quad", "Quad"], ["Linear", "Linear"], ["Sine", "Sine"], ["Back", "Back"], ["Bounce", "Bounce"], ["Elastic", "Elastic"]]), dropdown("DIRECTION", [["Out", "Out"], ["In", "In"], ["InOut", "InOut"]])], statement),
  meta("tween_wait", "Tween", "wait for tween to finish", "Waits for the most recently created tween.", [], statement),

  // Raycasting
  meta("raycast_cast", "Raycasting", "raycast from %1 direction X %2 Y %3 Z %4 distance %5", "Casts a ray and stores the result for result blocks.", [{ type: "input_value", name: "ORIGIN", check: "Instance" }, number("X", 0), number("Y", 0), number("Z", -1), number("DISTANCE", 500)], statement),
  meta("raycast_hit", "Raycasting", "ray hit object", "Returns the last raycast hit Instance.", [], value("Instance"), ["both"], "value"),
  meta("raycast_position", "Raycasting", "ray hit position", "Returns the last raycast world position.", [], value("Vector3"), ["both"], "value"),
  meta("raycast_normal", "Raycasting", "ray hit normal", "Returns the surface normal from the last raycast.", [], value("Vector3"), ["both"], "value"),
  meta("raycast_did_hit", "Raycasting", "ray hit something?", "True when the last raycast found an object.", [], value("Boolean"), ["both"], "value"),
  meta("raycast_screen", "Raycasting", "ray from mouse position distance %1", "Casts a camera ray from the mouse position.", [number("DISTANCE", 1000)], statement, ["client"], "action"),
  meta("raycast_exclude", "Raycasting", "exclude %1 from raycasts", "Adds an Instance to the raycast exclusion list.", [{ type: "input_value", name: "OBJECT", check: "Instance" }], statement),
  meta("raycast_clear_filter", "Raycasting", "clear raycast exclusions", "Clears the raycast filter list.", [], statement),

  // Input
  meta("input_key_pressed", "Input", "when key %1 pressed", "Runs when a keyboard key is pressed.", [field("KEY", "E")], event, ["client"], "event"),
  meta("input_key_released", "Input", "when key %1 released", "Runs when a keyboard key is released.", [field("KEY", "E")], event, ["client"], "event"),
  meta("input_key_down", "Input", "key %1 is down?", "Checks whether a keyboard key is held.", [field("KEY", "LeftShift")], value("Boolean"), ["client"], "value"),
  meta("input_mouse_clicked", "Input", "when mouse button %1 clicked", "Runs when a mouse button is pressed.", [dropdown("BUTTON", [["left", "MouseButton1"], ["right", "MouseButton2"], ["middle", "MouseButton3"]])], event, ["client"], "event"),
  meta("input_mouse_x", "Input", "mouse X position", "Returns the current mouse X coordinate.", [], value("Number"), ["client"], "value"),
  meta("input_mouse_y", "Input", "mouse Y position", "Returns the current mouse Y coordinate.", [], value("Number"), ["client"], "value"),
  meta("input_gamepad_pressed", "Input", "when gamepad button %1 pressed", "Runs when a gamepad button is pressed.", [field("BUTTON", "ButtonA")], event, ["client"], "event"),
  meta("input_touch_began", "Input", "when touch input begins", "Runs when a touchscreen press begins.", [], event, ["client"], "event"),
  meta("input_touch_position", "Input", "touch position", "Returns the current touch screen position.", [], value("Vector2"), ["client"], "value"),
  meta("input_last_type", "Input", "last input type", "Returns the most recently used input type.", [], value("String"), ["client"], "value"),
  meta("input_mouse_delta_x", "Input", "mouse movement X", "Returns horizontal mouse movement this frame.", [], value("Number"), ["client"], "value"),
  meta("input_mouse_delta_y", "Input", "mouse movement Y", "Returns vertical mouse movement this frame.", [], value("Number"), ["client"], "value"),
  meta("input_preferred", "Input", "preferred input device", "Returns KeyboardAndMouse, Gamepad, or Touch.", [], value("String"), ["client"], "value"),

  // Animation
  meta("animation_animator", "Animation", "Animator of %1", "Finds or creates an Animator under a Humanoid.", [{ type: "input_value", name: "HUMANOID", check: "Humanoid" }], value("Instance"), ["both"], "value"),
  meta("animation_load", "Animation", "load animation asset %1 with %2 as %3", "Loads an animation and stores its AnimationTrack.", [field("ASSET", "507771019"), { type: "input_value", name: "ANIMATOR", check: "Instance" }, field("VAR", "animationTrack")], statement),
  meta("animation_play", "Animation", "play animation %1", "Plays a stored AnimationTrack.", [field("TRACK", "animationTrack")], statement),
  meta("animation_stop", "Animation", "stop animation %1 fade %2", "Stops an AnimationTrack.", [field("TRACK", "animationTrack"), number("FADE", 0.2)], statement),
  meta("animation_speed", "Animation", "set animation %1 speed to %2", "Adjusts AnimationTrack playback speed.", [field("TRACK", "animationTrack"), number("SPEED", 1)], statement),
  meta("animation_priority", "Animation", "set animation %1 priority %2", "Sets AnimationTrack priority.", [field("TRACK", "animationTrack"), dropdown("PRIORITY", [["Idle", "Idle"], ["Movement", "Movement"], ["Action", "Action"], ["Action2", "Action2"], ["Action3", "Action3"], ["Action4", "Action4"]])], statement),
  meta("animation_finished", "Animation", "when animation %1 finishes", "Runs when an AnimationTrack stops.", [field("TRACK", "animationTrack")], event, ["both"], "event"),
  meta("animation_looped", "Animation", "set animation %1 looped %2", "Controls AnimationTrack looping.", [field("TRACK", "animationTrack"), dropdown("VALUE", [["true", "TRUE"], ["false", "FALSE"]])], statement),
  meta("animation_is_playing", "Animation", "animation %1 is playing?", "Checks whether an AnimationTrack is playing.", [field("TRACK", "animationTrack")], value("Boolean"), ["both"], "value"),
  meta("animation_length", "Animation", "length of animation %1", "Returns AnimationTrack length in seconds.", [field("TRACK", "animationTrack")], value("Number"), ["both"], "value"),

  // Networking
  meta("network_send_server", "Networking", "send remote %1 to server with %2", "Fires a RemoteEvent from a LocalScript to the server.", [field("REMOTE", "Action"), { type: "input_value", name: "VALUE" }], statement, ["client"], "action"),
  meta("network_request_server", "Networking", "request remote function %1 with %2", "Invokes a RemoteFunction on the server and returns its result.", [field("REMOTE", "GetData"), { type: "input_value", name: "VALUE" }], value(null), ["client"], "value"),
  meta("network_receive_server", "Networking", "when remote %1 received from player", "Runs on the server when a client fires a RemoteEvent.", [field("REMOTE", "Action")], event, ["server"], "event"),
  meta("network_send_player", "Networking", "send remote %1 to %2 with %3", "Fires a RemoteEvent to one player.", [field("REMOTE", "Update"), { type: "input_value", name: "PLAYER", check: "Player" }, { type: "input_value", name: "VALUE" }], statement, ["server"], "action"),
  meta("network_send_all", "Networking", "send remote %1 to all players with %2", "Broadcasts a RemoteEvent to every player.", [field("REMOTE", "Update"), { type: "input_value", name: "VALUE" }], statement, ["server"], "action"),
  meta("network_function_server", "Networking", "when remote function %1 invoked", "Handles a RemoteFunction request on the server.", [field("REMOTE", "GetData")], event, ["server"], "event"),
  meta("network_receive_client", "Networking", "when remote %1 received from server", "Runs in a LocalScript when the server fires a RemoteEvent.", [field("REMOTE", "Update")], event, ["client"], "event"),

  // Sound breadth
  meta("sound_stop", "Sound", "stop sound %1", "Stops a named Workspace Sound.", [field("SOUND", "Music")], statement),
  meta("sound_pause", "Sound", "pause sound %1", "Pauses a named Sound.", [field("SOUND", "Music")], statement),
  meta("sound_resume", "Sound", "resume sound %1", "Resumes a paused Sound.", [field("SOUND", "Music")], statement),
  meta("sound_volume", "Sound", "set sound %1 volume to %2", "Changes Sound volume.", [field("SOUND", "Music"), number("VALUE", 0.5)], statement),
  meta("sound_speed", "Sound", "set sound %1 playback speed to %2", "Changes playback speed.", [field("SOUND", "Music"), number("VALUE", 1)], statement),
  meta("sound_looped", "Sound", "set sound %1 looped %2", "Enables or disables looping.", [field("SOUND", "Music"), dropdown("VALUE", [["true", "TRUE"], ["false", "FALSE"]])], statement),
  meta("sound_finished", "Sound", "when sound %1 finishes", "Runs when a Sound ends.", [field("SOUND", "Music")], event, ["both"], "event"),

  // GUI breadth
  meta("gui_get_text", "GUI", "text of GUI object %1", "Returns text from a TextLabel, TextButton, or TextBox.", [field("OBJECT", "StatusLabel")], value("String"), ["client"], "value"),
  meta("gui_set_image", "GUI", "set image %1 to asset %2", "Changes an ImageLabel or ImageButton image.", [field("OBJECT", "Icon"), field("ASSET", "0")], statement, ["client"], "action"),
  meta("gui_set_visible", "GUI", "set GUI object %1 visible %2", "Shows or hides a GUI object.", [field("OBJECT", "Panel"), dropdown("VALUE", [["true", "TRUE"], ["false", "FALSE"]])], statement, ["client"], "action"),
  meta("gui_toggle_visible", "GUI", "toggle visibility of %1", "Reverses a GUI object's visibility.", [field("OBJECT", "Panel")], statement, ["client"], "action"),
  meta("gui_set_position", "GUI", "set GUI %1 position scale X %2 Y %3", "Sets a GUI object's scale position.", [field("OBJECT", "Panel"), number("X", 0.5), number("Y", 0.5)], statement, ["client"], "action"),
  meta("gui_set_size", "GUI", "set GUI %1 size scale X %2 Y %3", "Sets a GUI object's scale size.", [field("OBJECT", "Panel"), number("X", 0.5), number("Y", 0.5)], statement, ["client"], "action"),
  meta("gui_text_color", "GUI", "set text color of %1 to RGB %2", "Sets text color from an RGB triplet.", [field("OBJECT", "Label"), field("RGB", "255,255,255")], statement, ["client"], "action"),
  meta("gui_background_color", "GUI", "set background color of %1 to RGB %2", "Sets background color from an RGB triplet.", [field("OBJECT", "Panel"), field("RGB", "30,30,40")], statement, ["client"], "action"),
  meta("gui_transparency", "GUI", "set transparency of GUI %1 to %2", "Sets GUI background transparency.", [field("OBJECT", "Panel"), number("VALUE", 0.5)], statement, ["client"], "action"),
  meta("gui_hovered", "GUI", "when button %1 hovered", "Runs when the pointer enters a GUI button.", [field("OBJECT", "Button")], event, ["client"], "event"),
  meta("gui_text_submitted", "GUI", "when TextBox %1 submitted", "Runs when a player presses Enter in a TextBox.", [field("OBJECT", "ChatBox")], event, ["client"], "event"),

  // CollectionService tags
  meta("tag_add", "Tags", "add tag %1 to %2", "Adds a CollectionService tag.", [field("TAG", "Enemy"), { type: "input_value", name: "OBJECT", check: "Instance" }], statement),
  meta("tag_remove", "Tags", "remove tag %1 from %2", "Removes a CollectionService tag.", [field("TAG", "Enemy"), { type: "input_value", name: "OBJECT", check: "Instance" }], statement),
  meta("tag_has", "Tags", "%1 has tag %2?", "Checks whether an Instance has a tag.", [{ type: "input_value", name: "OBJECT", check: "Instance" }, field("TAG", "Enemy")], value("Boolean"), ["both"], "value"),
  meta("tag_get_objects", "Tags", "objects tagged %1", "Returns all Instances with a tag.", [field("TAG", "Enemy")], value("Array"), ["both"], "value"),
  meta("tag_added", "Tags", "when object tagged %1 is added", "Runs when a tagged Instance appears.", [field("TAG", "Enemy")], event, ["both"], "event"),
  meta("tag_removed", "Tags", "when object tagged %1 is removed", "Runs when a tagged Instance disappears.", [field("TAG", "Enemy")], event, ["both"], "event"),

  // Standard utility library
  meta("utility_cooldown_start", "Utilities", "start cooldown %1 for %2 seconds", "Starts or resets a named local cooldown.", [field("NAME", "Attack"), number("SECONDS", 2)], statement),
  meta("utility_cooldown_ready", "Utilities", "cooldown %1 ready?", "Checks whether a cooldown can be used.", [field("NAME", "Attack")], value("Boolean"), ["both"], "value"),
  meta("utility_cooldown_left", "Utilities", "cooldown %1 time left", "Returns remaining cooldown time in seconds.", [field("NAME", "Attack")], value("Number"), ["both"], "value"),
  meta("utility_timer_start", "Utilities", "start timer %1", "Starts a named stopwatch.", [field("NAME", "Round")], statement),
  meta("utility_timer_reset", "Utilities", "reset timer %1", "Resets a named timer to now.", [field("NAME", "Round")], statement),
  meta("utility_timer_elapsed", "Utilities", "timer %1 elapsed", "Returns elapsed seconds for a named timer.", [field("NAME", "Round")], value("Number"), ["both"], "value"),
  meta("utility_countdown", "Utilities", "countdown %1 from %2 each second %3", "Runs a body once per second with countdownValue available.", [field("NAME", "Round"), number("SECONDS", 60), { type: "input_statement", name: "BODY" }], statement, ["both"], "control"),
  meta("utility_chance", "Utilities", "%1 percent chance", "Returns true with the chosen percentage probability.", [{ type: "input_value", name: "PERCENT", check: "Number" }], value("Boolean"), ["both"], "value"),
  meta("utility_format_time", "Utilities", "format %1 seconds as timer", "Formats seconds as MM:SS.", [{ type: "input_value", name: "SECONDS", check: "Number" }], value("String"), ["both"], "value"),
  meta("table_from_text", "Utilities", "list values %1", "Creates a simple text list from comma-separated values.", [field("VALUES", "Sword, Shield, Potion")], value("Array"), ["both"], "value"),
  meta("table_count", "Utilities", "number of items in %1", "Returns the number of array items.", [{ type: "input_value", name: "TABLE" }], value("Number"), ["both"], "value"),
  meta("table_random_item", "Utilities", "random item from %1", "Selects a random item from an array.", [{ type: "input_value", name: "TABLE" }], value(null), ["both"], "value"),
  meta("table_add", "Utilities", "add %1 to list %2", "Appends a value to an array.", [{ type: "input_value", name: "VALUE" }, { type: "input_value", name: "TABLE" }], statement),
  meta("table_remove", "Utilities", "remove item %1 from list %2", "Removes an array item by index.", [{ type: "input_value", name: "INDEX", check: "Number" }, { type: "input_value", name: "TABLE" }], statement),
  meta("math_vector3", "Math", "Vector3 X %1 Y %2 Z %3", "Creates a Vector3 value.", [number("X", 0), number("Y", 0), number("Z", 0)], value("Vector3"), ["both"], "value"),
  meta("math_color3", "Math", "Color RGB %1", "Creates a Color3 from an RGB triplet.", [field("RGB", "255,255,255")], value("Color3"), ["both"], "value"),
  meta("math_cframe", "Math", "CFrame X %1 Y %2 Z %3", "Creates a positioned CFrame.", [number("X", 0), number("Y", 0), number("Z", 0)], value("CFrame"), ["both"], "value"),
  meta("roblox_custom_luau", "Advanced", "custom Luau %1", "Adds raw Luau text to the generated script. It is never executed here.", [field("CODE", "-- advanced code")], statement, ["both"], "action", ["raw", "escape"]),
];

export const BLOCK_MAP = new Map(BLOCKS.map((block) => [block.id, block]));

export function toolbox(search = "", beginner = false) {
  const query = search.trim().toLowerCase();
  const visible = BLOCKS.filter((b) => (!beginner || b.category !== "Advanced") && (!query || `${b.label} ${b.description} ${b.keywords.join(" ")}`.toLowerCase().includes(query)));
  const grouped = new Map<string, BlockMeta[]>();
  for (const block of visible) grouped.set(block.category, [...(grouped.get(block.category) ?? []), block]);
  return { kind: "categoryToolbox", contents: [...grouped].map(([name, blocks]) => ({ kind: "category", name, colour: colours[name], contents: blocks.map((b) => ({ kind: "block", type: b.id })) })) };
}
