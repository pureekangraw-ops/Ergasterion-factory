const R=window.MIMIR_REGISTRY||[];
const $=s=>document.querySelector(s);
const text=v=>Array.isArray(v)?v.join(" "):String(v??"");
function render(q=""){
 const n=q.toLowerCase();
 const rows=R.filter(r=>!n||[r.name,r.type,r.capability,r.route,r.callableActions].map(text).join(" ").toLowerCase().includes(n));
 $("#catalog").innerHTML=rows.map(r=>`<div class="record"><h3>${r.name} <small>${r.type}</small></h3><p><b>Capability:</b> ${text(r.capability)}</p><p><b>Surface:</b> ${r.surface}</p><p><b>Permission:</b> ${r.permission}</p><p><b>Availability:</b> ${r.availability}</p><p><b>Callable:</b> ${text(r.callableActions)}</p><p><b>Route:</b> ${r.route}</p><p><b>Verified:</b> ${r.verifiedAt}</p><p><b>Source:</b> ${r.source}</p></div>`).join("")||"<p>No match.</p>";
}
function out(r,status,waitReason){return{matches:[r.id],status,waitReason,route:status==="PASS"?r.route:null,evidence:{source:r.source,verifiedAt:r.verifiedAt,surface:r.surface,capability:r.capability,callableActions:r.callableActions,permission:r.permission,availability:r.availability}}}
function queryMimir(q){
 const r=R.find(x=>[x.name,x.type,x.capability,x.route,x.surface].map(text).join(" ").toLowerCase().includes("github"));
 if(!r)return{matches:[],status:"WAIT",waitReason:"UNKNOWN",route:null,evidence:null};
 if(r.availability!=="Available")return out(r,"WAIT","UNAVAILABLE");
 if(q.requiredAction&&!r.callableActions.includes(q.requiredAction))return out(r,"WAIT","MISSING_CALLABLE_ACTION");
 if(r.permission==="Blocked")return out(r,"WAIT","BLOCKED");
 return out(r,"PASS",null);
}
function run(){const x=queryMimir({intent:$("#intent").value,requestedResult:$("#result").value,requiredAction:$("#action").value.trim(),surface:$("#surface").value.trim()});$("#answer").innerHTML=`<h3 class="${x.status}">${x.status}${x.waitReason?" — "+x.waitReason:""}</h3><pre>${JSON.stringify(x,null,2)}</pre>`}
$("#search").addEventListener("input",e=>render(e.target.value));
$("#runBtn").addEventListener("click",run);
$("#passProbe").addEventListener("click",()=>{$("#action").value="update_file";run()});
$("#waitProbe").addEventListener("click",()=>{$("#action").value="star_repository";run()});
render();run();
