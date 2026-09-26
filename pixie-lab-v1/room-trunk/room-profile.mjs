export const ROOM_PROFILE = Object.freeze({
  "contract": "PIXIE_ROOM_PROFILE_V1",
  "roomId": "ROOM-D",
  "roomPixieId": "PIXIE-D",
  "role": "DEBUG",
  "purpose": "Dedicated inspection/debug room for root-cause analysis and preparing governed handoff candidates without executing them.",
  "defaultActions": [
    "TRACE",
    "ROOT_CAUSE",
    "EVIDENCE_GAP",
    "PREPARE_HANDOFF"
  ],
  "guidingQuestion": "Where is the first break, what evidence proves it, and what is the smallest governed next action?",
  "trunkBranch": "room/pixie-d",
  "promotionTarget": "main",
  "productionAuthority": false,
  "externalExecution": false,
  "directMainMutation": false
});
