import { LIGHTHOUSE_OWNER17_FIELD as field } from "./lighthouse-owner17-field.mjs";
export function assessLighthouseField(){
  const app=field.evidence.app;
  const css=field.evidence.css;
  const findings=[];
  const unknowns=[];
  if (/keyboard-open/.test(app) && /keyboard-open \.bottom-nav\{display:none\}/.test(css)) findings.push("KEYBOARD_STATE_CAN_HIDE_NAV");
  if (/state\.activeRoot = next/.test(app)) findings.push("ROOT_STATE_MUTATION_PRESENT");
  if (/page\.hidden = page\.dataset\.root !== next/.test(app)) findings.push("PAGE_VISIBILITY_SWITCH_PRESENT");
  if (!field.evidence.runtimeAttempt.deviceHitTestObserved) unknowns.push("VISIBLE_BUT_UNCLICKABLE_NOT_REPRODUCED");
  return Object.freeze({
    roomId:"ROOM-C",
    temporaryLens:"STATE_LIFECYCLE",
    verdict:"STATE_PATH_LOOKS_PLAUSIBLE_STATICALLY",
    findings,
    unknowns,
    nextProbe:"Reproduce after keyboard open/close, app resume, and root changes; record keyboard-open class and activeRoot before/after tap.",
  });
}
