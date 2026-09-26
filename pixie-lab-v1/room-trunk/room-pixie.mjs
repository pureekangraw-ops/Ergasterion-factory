import { ROOM_PROFILE } from "./room-profile.mjs";
import { createRoomCommand, createRoomResult } from "./room-contract.mjs";

const text = value => String(value ?? "").trim();

function localPlan(command) {
  return ROOM_PROFILE.defaultActions.map((action, index) => Object.freeze({
    stepId:`LOCAL-${String(index + 1).padStart(2, "0")}`,
    action,
    objective:command.command,
    scope:ROOM_PROFILE.roomId,
  }));
}

export function createRoomPixie() {
  return Object.freeze({
    profile:ROOM_PROFILE,
    run(input = {}) {
      const command = createRoomCommand({ ...input, roomId:ROOM_PROFILE.roomId });
      const unresolved = [];
      if (!text(command.requestedResult)) unresolved.push("REQUESTED_RESULT_UNSPECIFIED");

      return createRoomResult({
        roomId:ROOM_PROFILE.roomId,
        requestId:command.requestId,
        status:unresolved.length ? "UNKNOWN" : "READY",
        role:ROOM_PROFILE.role,
        plan:localPlan(command),
        result:{
          summary:`${ROOM_PROFILE.roomPixieId} prepared a local ${ROOM_PROFILE.role} plan only.`,
          guidingQuestion:ROOM_PROFILE.guidingQuestion,
          contextRefs:command.contextRefs,
          constraints:command.constraints,
        },
        unknowns:unresolved,
        candidate:{
          kind:"ROOM_LOCAL_CANDIDATE",
          roomId:ROOM_PROFILE.roomId,
          sourceBranch:ROOM_PROFILE.trunkBranch,
          returnContract:"PIXIE_ROOM_RESULT_V1",
        },
      });
    },
  });
}
