import { ROOM_PROFILE } from "./room-profile.mjs";
import { createRoomCommand, createRoomResult } from "./room-contract.mjs";
import { createPixieWorkshopToolkit } from "./workshop-tools.mjs";
import { createPixieApprentice } from "./apprentice-agent.mjs";

const text = value => String(value ?? "").trim();

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
    run(input = {}) {
      const command = createRoomCommand({ ...input, roomId:ROOM_PROFILE.roomId });
      const unresolved = [];
      if (!text(command.requestedResult)) unresolved.push("REQUESTED_RESULT_UNSPECIFIED");

      return createRoomResult({
        roomId:ROOM_PROFILE.roomId,
        requestId:command.requestId,
        status:unresolved.length ? "UNKNOWN" : "READY",
        role:ROOM_PROFILE.role,
        plan:[{
          stepId:"FREE-01",
          action:"CHOOSE_NEXT_ACTION",
          objective:command.command,
          scope:ROOM_PROFILE.roomId,
        }],
        result:{
          summary:ROOM_PROFILE.roomPixieId + " is ready to choose any useful experiment path for the mission.",
          guidingQuestion:ROOM_PROFILE.guidingQuestion,
          contextRefs:command.contextRefs,
          constraints:command.constraints,
        },
        unknowns:unresolved,
        candidate:{
          kind:"ROOM_WORKSHOP_CANDIDATE",
          roomId:ROOM_PROFILE.roomId,
          sourceBranch:ROOM_PROFILE.trunkBranch,
          returnContract:"PIXIE_ROOM_RESULT_V1",
        },
      });
    },
  });
}
