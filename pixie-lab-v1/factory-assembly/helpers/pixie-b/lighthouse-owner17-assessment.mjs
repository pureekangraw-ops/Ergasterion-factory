import { LIGHTHOUSE_OWNER17_FIELD as field } from "./lighthouse-owner17-field.mjs";
export function assessLighthouseField(){
  const css=field.evidence.css+"\n"+field.evidence.ownerPolish;
  const findings=[];
  const unknowns=[];
  if (/z-index:20/.test(css)) findings.push("BOTTOM_NAV_Z20");
  if (field.evidence.staticOverlayScan.higherFixedZIndexFound===false) findings.push("NO_HIGHER_FIXED_OVERLAY_FOUND");
  if (/pointer-events:none/.test(field.evidence.ownerPolish)) findings.push("DECORATIVE_AUTH_LAYER_NON_INTERACTIVE");
  if (field.evidence.staticOverlayScan.pointerBlockingOverlayFound===false) findings.push("NO_STATIC_POINTER_BLOCKER_FOUND");
  unknowns.push("ANDROID_WEBVIEW_COMPOSITING_UNKNOWN");
  return Object.freeze({
    roomId:"ROOM-B",
    temporaryLens:"HIT_TEST_LAYOUT",
    verdict:"CSS_INTERCEPT_NOT_PROVEN",
    findings,
    unknowns,
    nextProbe:"Capture on-device hit target at each nav-button center and inspect any native/WebView overlay bounds.",
  });
}
