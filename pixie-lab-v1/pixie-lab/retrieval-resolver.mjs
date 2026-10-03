const text=(value)=>String(value??'').trim();
const clone=(value)=>value==null?value:structuredClone(value);
const freeze=(value)=>Object.freeze(clone(value));

const LOOKUP_FIELDS=Object.freeze(['workId','checkpointId','requestId','briefId','clientId','objectId']);

function normalizedEntry(value,index){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('RETRIEVAL_INDEX_ENTRY_INVALID');
  const workId=text(value.workId);
  const checkpointId=text(value.checkpointId);
  const objectId=text(value.objectId);
  const objectKey=text(value.objectKey);
  if(!workId||!checkpointId||!objectId||!objectKey)throw new Error('RETRIEVAL_INDEX_IDENTITY_REQUIRED');
  return freeze({
    index,
    workId,
    checkpointId,
    requestId:text(value.requestId)||null,
    briefId:text(value.briefId)||null,
    clientId:text(value.clientId)||null,
    objectId,
    objectKey,
    contentType:text(value.contentType)||'application/octet-stream',
    sha256:text(value.sha256)||null,
    sourceRef:text(value.sourceRef)||null,
  });
}

function queryFields(input={}){
  return LOOKUP_FIELDS
    .map(field=>[field,text(input[field])])
    .filter(([,value])=>Boolean(value));
}

function candidateView(entry){
  return freeze({
    workId:entry.workId,
    checkpointId:entry.checkpointId,
    objectId:entry.objectId,
    objectKey:entry.objectKey,
    requestId:entry.requestId,
    briefId:entry.briefId,
    clientId:entry.clientId,
  });
}

export function createLabRetrievalIndex(entries=[]){
  const index=(Array.isArray(entries)?entries:[]).map(normalizedEntry);
  return Object.freeze({
    labOnly:true,
    kind:'PIXIE_RETRIEVAL_INDEX_V1',
    entries:freeze(index),
  });
}

export function resolveLabRetrieval(index,input={}){
  if(!index?.labOnly||index?.kind!=='PIXIE_RETRIEVAL_INDEX_V1')throw new Error('LAB_RETRIEVAL_INDEX_REQUIRED');
  const fields=queryFields(input);
  if(!fields.length){
    return freeze({
      status:'INVALID_QUERY',
      reason:'LOOKUP_IDENTIFIER_REQUIRED',
      labOnly:true,
      productionAuthority:false,
      candidates:[],
    });
  }

  const matches=index.entries.filter((entry)=>fields.every(([field,value])=>text(entry[field])===value));
  if(matches.length===0){
    return freeze({
      status:'NOT_FOUND',
      reason:'NO_INDEX_MATCH',
      labOnly:true,
      productionAuthority:false,
      query:Object.fromEntries(fields),
      candidates:[],
    });
  }
  if(matches.length>1){
    return freeze({
      status:'AMBIGUOUS',
      reason:'MULTIPLE_INDEX_MATCHES',
      labOnly:true,
      productionAuthority:false,
      query:Object.fromEntries(fields),
      candidates:matches.map(candidateView),
    });
  }

  const entry=matches[0];
  return freeze({
    status:'RESOLVED',
    reason:null,
    labOnly:true,
    productionAuthority:false,
    query:Object.fromEntries(fields),
    canonical:{
      workId:entry.workId,
      checkpointId:entry.checkpointId,
      objectId:entry.objectId,
      objectKey:entry.objectKey,
    },
    metadata:{
      requestId:entry.requestId,
      briefId:entry.briefId,
      clientId:entry.clientId,
      contentType:entry.contentType,
      sha256:entry.sha256,
      sourceRef:entry.sourceRef,
    },
    retrievalPlan:[
      {step:'RESOLVE_INDEX',status:'DONE'},
      {step:'FETCH_R2',status:'SIMULATION_ONLY',objectKey:entry.objectKey},
      {step:'ASSEMBLE_CONTEXT',status:'SIMULATION_ONLY'},
    ],
  });
}

export function evaluateRetrievalCandidate(result){
  if(result?.status==='RESOLVED')return freeze({status:'CANDIDATE_READY',reason:null,productionAuthority:false});
  if(result?.status==='AMBIGUOUS')return freeze({status:'NEEDS_FIX',reason:'DISAMBIGUATION_REQUIRED',productionAuthority:false});
  if(result?.status==='NOT_FOUND')return freeze({status:'NEEDS_FIX',reason:'INDEX_GAP',productionAuthority:false});
  return freeze({status:'INCONCLUSIVE',reason:result?.reason||'UNKNOWN',productionAuthority:false});
}
