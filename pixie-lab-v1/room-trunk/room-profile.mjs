export const ROOM_PROFILE = Object.freeze({
  "contract": "PIXIE_ROOM_PROFILE_V1",
  "roomId": "ROOM-C",
  "roomPixieId": "PIXIE-C",
  "role": "VERIFY",
  "purpose": "Ordinary isolated experiment room for independent verification, contradiction checks, and false-green detection.",
  "defaultActions": [
    "VERIFY",
    "CROSS_CHECK",
    "CONTRADICTION_SCAN",
    "FALSE_GREEN_CHECK"
  ],
  "guidingQuestion": "Does independent evidence agree with the claimed result, or is this a false green?",
  "trunkBranch": "room/pixie-c",
  "promotionTarget": "main",
  "productionAuthority": false,
  "externalExecution": false,
  "directMainMutation": false
});
