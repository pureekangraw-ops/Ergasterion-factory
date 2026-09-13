const R=window.MIMIR_REGISTRY||[];
const EXPECTED=window.OWNER_SEAL_EXPECTED||{};
const $=s=>document.querySelector(s);
const text=v=>Array.isArray(v)?v.join(" "):String(v??"");

function recordHaystack(r){
  return [r.name,r.type,r.capability,r.route,r.callableActions,r.surface].map(text).join(" ").toLowerCase();
}

function render(q=""){
  const n=q.trim().toLowerCase();
  const rows=R.filter(r=>!n||recordHaystack(r).includes(n));
  $("#catalog").innerHTML=rows.map(r=>{
    const s=r.logicSeal||{};
    return `<div class="record"><h3>${r.name} <small>${r.type}</small></h3><p><b>Capability:</b> ${text(r.capability)}</p><p><b>Surface:</b> ${r.surface}</p><p><b>Installation:</b> ${r.installationState??"Unknown"}</p><p><b>Permission:</b> ${r.permission}</p><p><b>Availability:</b> ${r.availability}</p><p><b>Callable:</b> ${text(r.callableActions)}</p><p><b>Route:</b> ${r.route}</p><p><b>Block reason:</b> ${r.blockReason||"—"}</p><p><b>Verified:</b> ${r.verifiedAt}</p><p><b>Modified:</b> ${r.modifiedAt??"Unknown"}</p><p><b>Source:</b> ${r.source}</p><hr><p><b>Seal owner:</b> ${s.ownerId??"Unknown"}</p><p><b>Logic version:</b> ${s.logicVersion??"Unknown"}</p><p><b>Source commit:</b> ${s.sourceCommit??"Unknown"}</p><p><b>Integrity claim:</b> ${s.integrityDigest??"Unknown"}</p><p><b>Signer:</b> ${s.signer??"Unknown"}</p><p><b>Seal state:</b> ${s.verificationState??"Unknown"}</p><p><b>Seal verified:</b> ${s.verifiedAt??"Unknown"}</p><p><b>Boundary:</b> ${s.proofBoundary??"Static proof metadata — not production authenticity proof."}</p></div>`;
  }).join("")||"<p>No match.</p>";
}

function verifyLogicSeal(record){
  const seal=record&&record.logicSeal;
  const required=["ownerId","logicVersion","sourceCommit","integrityDigest","signer","verificationState","verifiedAt"];
  if(!seal||required.some(k=>!seal[k]))return {trusted:false,waitReason:"SEAL_MISSING"};
  if(seal.verificationState==="UNVERIFIED")return {trusted:false,waitReason:"SEAL_UNVERIFIED"};
  if(seal.verificationState==="MISMATCH")return {trusted:false,waitReason:"SEAL_MISMATCH"};
  if(seal.verificationState!=="VERIFIED")return {trusted:false,waitReason:"SEAL_UNKNOWN"};
  const expectedKeys=["ownerId","logicVersion","sourceCommit","integrityDigest","signer"];
if(expectedKeys.some(k=>!EXPECTED[k]))return {trusted:false,waitReason:"SEAL_EXPECTED_MISSING"};
if(expectedKeys.some(k=>seal[k]!==EXPECTED[k]))return {trusted:false,waitReason:"SEAL_MISMATCH"};
  return {trusted:true,waitReason:null};
}

function out(r,status,waitReason){
  return {
    matches:[r.id],
    status,
    waitReason,
    route:status==="PASS"?r.route:null,
    evidence:{
      source:r.source,
      verifiedAt:r.verifiedAt,
      surface:r.surface,
      capability:r.capability,
      callableActions:r.callableActions,
      permission:r.permission,
      availability:r.availability,
      logicSeal:r.logicSeal||null
    }
  };
}

function queryMimir(q){
  const surfaceNeed=text(q.surface).trim().toLowerCase();
  const pool=surfaceNeed?R.filter(r=>{
    const recordSurface=text(r.surface).trim().toLowerCase();
    return recordSurface.includes(surfaceNeed)||surfaceNeed.includes(recordSurface);
  }):R;

  if(!pool.length)return {matches:[],status:"WAIT",waitReason:"UNKNOWN",route:null,evidence:null};

  const terms=[q.intent,q.requestedResult,q.surface]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .filter(t=>t.length>2);

  const ranked=pool.map(r=>({r,score:terms.filter(t=>recordHaystack(r).includes(t)).length}))
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score);

  if(!ranked.length)return {matches:[],status:"WAIT",waitReason:"UNKNOWN",route:null,evidence:null};

  const r=ranked[0].r;
  if(r.availability!=="Available")return out(r,"WAIT","UNAVAILABLE");
  if(q.requiredAction&&!r.callableActions.includes(q.requiredAction))return out(r,"WAIT","MISSING_CALLABLE_ACTION");
  if(r.permission==="Blocked")return out(r,"WAIT","BLOCKED");
  if(r.permission==="Requires approval"&&!q.authority)return out(r,"WAIT","NEED_AUTHORITY");
  const seal=verifyLogicSeal(r);
  if(!seal.trusted)return out(r,"WAIT",seal.waitReason);
  return out(r,"PASS",null);
}

function show(x){
  $("#answer").innerHTML=`<h3 class="${x.status}">${x.status}${x.waitReason?" — "+x.waitReason:""}</h3><pre>${JSON.stringify(x,null,2)}</pre>`;
}

function currentQuery(){
  return {intent:$("#intent").value,requestedResult:$("#result").value,requiredAction:$("#action").value.trim()||null,surface:$("#surface").value.trim()||null,authority:null};
}

function run(){show(queryMimir(currentQuery()));}

function runWithSealState(state,q){
  const r=R.find(x=>x.id==="github-chatgpt-connector");
  if(!r||!r.logicSeal)return {matches:r?[r.id]:[],status:"WAIT",waitReason:"SEAL_MISSING",route:null,evidence:r?out(r,"WAIT","SEAL_MISSING").evidence:null};
  const previous=r.logicSeal.verificationState;
  try{r.logicSeal.verificationState=state;return queryMimir(q);}finally{r.logicSeal.verificationState=previous;}
}

function githubUpdateQuery(){
  return {intent:"modify repository file",requestedResult:"update a file in Go-Calalog-",requiredAction:"update_file",surface:"ChatGPT GitHub connector",authority:null};
}

$("#search").addEventListener("input",e=>render(e.target.value));
$("#runBtn").addEventListener("click",run);
$("#passProbe").addEventListener("click",()=>show(queryMimir(githubUpdateQuery())));
$("#waitProbe").addEventListener("click",()=>show(queryMimir({intent:"modify repository metadata",requestedResult:"star repository",requiredAction:"star_repository",surface:"ChatGPT GitHub connector",authority:null})));
$("#unknownProbe").addEventListener("click",()=>show(queryMimir({intent:"build spreadsheet report",requestedResult:"create a spreadsheet",requiredAction:"create_spreadsheet",surface:"Spreadsheet app",authority:null})));

const verifiedBtn=$("#sealPassProbe");
const unverifiedBtn=$("#sealUnverifiedProbe");
const mismatchBtn=$("#sealMismatchProbe");
if(verifiedBtn)verifiedBtn.addEventListener("click",()=>show(runWithSealState("VERIFIED",githubUpdateQuery())));
if(unverifiedBtn)unverifiedBtn.addEventListener("click",()=>show(runWithSealState("UNVERIFIED",githubUpdateQuery())));
if(mismatchBtn)mismatchBtn.addEventListener("click",()=>show(runWithSealState("MISMATCH",githubUpdateQuery())));

window.MIMIR_TEST_API={queryMimir,verifyLogicSeal,runWithSealState};
render();
run();
