const R=window.MIMIR_REGISTRY||[];
const $=s=>document.querySelector(s);
const text=v=>Array.isArray(v)?v.join(" "):String(v??"");

function recordHaystack(r){
  return [r.name,r.type,r.capability,r.route,r.callableActions,r.surface].map(text).join(" ").toLowerCase();
}

function render(q=""){
  const n=q.trim().toLowerCase();
  const rows=R.filter(r=>!n||recordHaystack(r).includes(n));
  $("#catalog").innerHTML=rows.map(r=>`<div class="record"><h3>${r.name} <small>${r.type}</small></h3><p><b>Capability:</b> ${text(r.capability)}</p><p><b>Surface:</b> ${r.surface}</p><p><b>Installation:</b> ${r.installationState??"Unknown"}</p><p><b>Permission:</b> ${r.permission}</p><p><b>Availability:</b> ${r.availability}</p><p><b>Callable:</b> ${text(r.callableActions)}</p><p><b>Route:</b> ${r.route}</p><p><b>Block reason:</b> ${r.blockReason||"—"}</p><p><b>Verified:</b> ${r.verifiedAt}</p><p><b>Modified:</b> ${r.modifiedAt??"Unknown"}</p><p><b>Source:</b> ${r.source}</p></div>`).join("")||"<p>No match.</p>";
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
      availability:r.availability
    }
  };
}

function queryMimir(q){
  const terms=[q.intent,q.requestedResult,q.surface]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .filter(t=>t.length>2);

  const ranked=R.map(r=>({
    r,
    score:terms.filter(t=>recordHaystack(r).includes(t)).length
  }))
  .filter(x=>x.score>0)
  .sort((a,b)=>b.score-a.score);

  if(!ranked.length){
    return {matches:[],status:"WAIT",waitReason:"UNKNOWN",route:null,evidence:null};
  }

  const r=ranked[0].r;
  if(r.availability!=="Available")return out(r,"WAIT","UNAVAILABLE");
  if(q.requiredAction&&!r.callableActions.includes(q.requiredAction))return out(r,"WAIT","MISSING_CALLABLE_ACTION");
  if(r.permission==="Blocked")return out(r,"WAIT","BLOCKED");
  if(r.permission==="Requires approval"&&!q.authority)return out(r,"WAIT","NEED_AUTHORITY");
  return out(r,"PASS",null);
}

function run(){
  const x=queryMimir({
    intent:$("#intent").value,
    requestedResult:$("#result").value,
    requiredAction:$("#action").value.trim()||null,
    surface:$("#surface").value.trim()||null,
    authority:null
  });
  $("#answer").innerHTML=`<h3 class="${x.status}">${x.status}${x.waitReason?" — "+x.waitReason:""}</h3><pre>${JSON.stringify(x,null,2)}</pre>`;
}

$("#search").addEventListener("input",e=>render(e.target.value));
$("#runBtn").addEventListener("click",run);
$("#passProbe").addEventListener("click",()=>{
  $("#intent").value="modify repository file";
  $("#result").value="update a file in Go-Calalog-";
  $("#action").value="update_file";
  $("#surface").value="ChatGPT GitHub connector";
  run();
});
$("#waitProbe").addEventListener("click",()=>{
  $("#intent").value="modify repository metadata";
  $("#result").value="star repository";
  $("#action").value="star_repository";
  $("#surface").value="ChatGPT GitHub connector";
  run();
});
$("#unknownProbe").addEventListener("click",()=>{
  $("#intent").value="build spreadsheet report";
  $("#result").value="create a spreadsheet";
  $("#action").value="create_spreadsheet";
  $("#surface").value="Spreadsheet app";
  run();
});

render();
run();
