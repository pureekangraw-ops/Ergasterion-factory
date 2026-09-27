import { ROOM_PROFILE } from "./room-profile.mjs";
import { createRoomCommand, createRoomResult } from "./room-contract.mjs";
import { interpretGoCommand } from "./command-intelligence.mjs";
import { createPixieWorkshopToolkit } from "./workshop-tools.mjs";
import { createPixieApprentice } from "./apprentice-agent.mjs";
import { createGoSupportTeam } from "./go-support-team.mjs";

export function createRoomPixie() {
  return Object.freeze({
    profile:ROOM_PROFILE,
    createWorkshop({ host = {}, extensions = [] } = {}) {
      return createPixieWorkshopToolkit({ host, extensions });
    },
    createApprentice({ host = {}, extensions = [], now } = {}) {
      const toolkit = createPixieWorkshopToolkit({ host, extensions });
      return createPixieApprentice({ toolkit, now });
    },
    createSupportTeam({ host = {}, extensions = [], now } = {}) {
      const toolkit = createPixieWorkshopToolkit({ host, extensions });
      return createGoSupportTeam({ toolkit, now });
    },
    run(input = {}) {
      const command = createRoomCommand({ ...input, roomId:ROOM_PROFILE.roomId });
      const interpretation = interpretGoCommand({
        command:command.command,
        requestedResult:command.requestedResult,
        constraints:command.constraints,
        contextRefs:command.contextRefs,
      });
      const unresolved = [...interpretation.unknowns];

      return createRoomResult({
        roomId:ROOM_PROFILE.roomId,
        requestId:command.requestId,
        status:unresolved.length ? "UNKNOWN" : "READY",
        role:ROOM_PROFILE.role,
        plan:interpretation.plan,
        result:{
          summary:ROOM_PROFILE.roomPixieId + " interpreted one optional experiment path inside the free-play workshop.",
          guidingQuestion:ROOM_PROFILE.guidingQuestion,
          intent:interpretation.intent,
          targets:interpretation.targets,
          conditions:interpretation.conditions,
          stopConditions:interpretation.stopConditions,
          contextRefs:command.contextRefs,
          constraints:command.constraints,
        },
        unknowns:unresolved,
        candidate:{
          kind:"ROOM_WORKSHOP_COMMAND_CANDIDATE",
          roomId:ROOM_PROFILE.roomId,
          sourceBranch:ROOM_PROFILE.trunkBranch,
          intelligenceContract:interpretation.contract,
          returnContract:"PIXIE_ROOM_RESULT_V1",
          execution:interpretation.execution,
        },
      });
    },
  });
}
