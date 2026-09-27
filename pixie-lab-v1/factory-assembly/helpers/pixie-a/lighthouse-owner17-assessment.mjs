import { LIGHTHOUSE_OWNER17_FIELD as field } from "./lighthouse-owner17-field.mjs";
export function assessLighthouseField(){
  const app=field.evidence.app;
  const html=field.evidence.html;
  const findings=[];
  const unknowns=[];
  if (/data-root-target/.test(html) && /addEventListener\('click'/.test(app) && /selectRoot/.test(app)) {
    findings.push("CLICK_WIRING_PRESENT");
  }
  if (/allowed = \['chat','manual','go','settings'\]/.test(app)) findings.push("ROOT_TARGETS_ALLOWLISTED");
  if (!field.evidence.runtimeAttempt.deviceHitTestObserved) unknowns.push("DEVICE_HITTEST_UNKNOWN");
  if (!field.evidence.runtimeAttempt.webViewNativeLayerObserved) unknowns.push("NATIVE_LAYER_INTERCEPT_UNKNOWN");
  return Object.freeze({
    roomId:"ROOM-A",
    temporaryLens:"EVENT_PATH",
    verdict:"NO_STATIC_PROOF_OF_CLICK_HANDLER_FAILURE",
    findings,
    unknowns,
    nextProbe:"Observe a real tap and compare event.target / elementFromPoint / activeRoot transition on device.",
  });
}
