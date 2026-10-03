import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLabRetrievalIndex,
  resolveLabRetrieval,
  evaluateRetrievalCandidate,
} from '../pixie-lab/retrieval-resolver.mjs';

const index=()=>createLabRetrievalIndex([
  {
    workId:'WORK-77',
    checkpointId:'CP-4',
    requestId:'REQ-123',
    briefId:'BRIEF-9',
    clientId:'CLIENT-A',
    objectId:'brief.json',
    objectKey:'centre/WORK-77/CP-4/brief.json',
    contentType:'application/json',
    sha256:'abc123',
    sourceRef:'centre://request/REQ-123',
  },
  {
    workId:'WORK-78',
    checkpointId:'CP-1',
    requestId:'REQ-124',
    briefId:'BRIEF-10',
    clientId:'CLIENT-A',
    objectId:'brief.json',
    objectKey:'centre/WORK-78/CP-1/brief.json',
  },
]);

test('requestId resolves canonical work/checkpoint/object without caller knowing workId',()=>{
  const result=resolveLabRetrieval(index(),{requestId:'REQ-123'});
  assert.equal(result.status,'RESOLVED');
  assert.deepEqual(result.canonical,{
    workId:'WORK-77',
    checkpointId:'CP-4',
    objectId:'brief.json',
    objectKey:'centre/WORK-77/CP-4/brief.json',
  });
  assert.equal(result.retrievalPlan[1].step,'FETCH_R2');
  assert.equal(result.retrievalPlan[1].status,'SIMULATION_ONLY');
  assert.equal(result.productionAuthority,false);
});

test('briefId and objectId can narrow retrieval to one canonical object',()=>{
  const result=resolveLabRetrieval(index(),{briefId:'BRIEF-9',objectId:'brief.json'});
  assert.equal(result.status,'RESOLVED');
  assert.equal(result.canonical.workId,'WORK-77');
});

test('clientId alone stays ambiguous instead of guessing a workId',()=>{
  const result=resolveLabRetrieval(index(),{clientId:'CLIENT-A'});
  assert.equal(result.status,'AMBIGUOUS');
  assert.equal(result.candidates.length,2);
  assert.deepEqual(evaluateRetrievalCandidate(result),{
    status:'NEEDS_FIX',
    reason:'DISAMBIGUATION_REQUIRED',
    productionAuthority:false,
  });
});

test('conflicting identifiers fail closed as not found',()=>{
  const result=resolveLabRetrieval(index(),{requestId:'REQ-123',briefId:'BRIEF-10'});
  assert.equal(result.status,'NOT_FOUND');
  assert.equal(result.reason,'NO_INDEX_MATCH');
  assert.equal(evaluateRetrievalCandidate(result).reason,'INDEX_GAP');
});

test('direct workId remains supported but is not required',()=>{
  const result=resolveLabRetrieval(index(),{workId:'WORK-78'});
  assert.equal(result.status,'RESOLVED');
  assert.equal(result.canonical.checkpointId,'CP-1');
});

test('empty lookup is inconclusive and never gains production authority',()=>{
  const result=resolveLabRetrieval(index(),{});
  assert.equal(result.status,'INVALID_QUERY');
  assert.equal(result.productionAuthority,false);
  assert.deepEqual(evaluateRetrievalCandidate(result),{
    status:'INCONCLUSIVE',
    reason:'LOOKUP_IDENTIFIER_REQUIRED',
    productionAuthority:false,
  });
});
