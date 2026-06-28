/**
 * Backstage director persona (single source of truth).
 *
 * Loaded from the markdown source file, not hardcoded. The hermetic
 * faction-director child runs `pi -p --no-tools --no-approve` and therefore does
 * NOT load any agent definition — so the persona must travel inside the prompt.
 * `buildBackstageDirectorPrompt` composes this persona + the subagent-safe
 * `<timeline_state_context>` projection + the engine-assembled ParallelLineInput.
 *
 * Source of truth: spikes/pi-actors/backstage-director-persona.md
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONA_PATH = resolve(__dirname, "../../../spikes/pi-actors/backstage-director-persona.md");

export const BACKSTAGE_DIRECTOR_PERSONA: string = readFileSync(PERSONA_PATH, "utf-8");