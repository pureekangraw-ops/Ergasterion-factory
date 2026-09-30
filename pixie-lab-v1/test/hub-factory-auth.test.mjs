import test from 'node:test';
import assert from 'node:assert/strict';
import { signHubFactoryPayload, verifyHubFactoryRequest } from '../pixie-lab/hub-factory-auth.mjs';
test('Hub Factory transport verifies signed payload and rejects replay', () => { const payload={handoffId:'H-1',workId:'W-1',checkpointId:'CP-1'}, timestamp=String(Date.now()), signature=signHubFactoryPayload(payload,'test-secret',timestamp); assert.equal(verifyHubFactoryRequest(payload,{'x-go-hub-timestamp':timestamp,'x-go-hub-signature':signature},{secret:'test-secret'}).authenticated,true); assert.throws(()=>verifyHubFactoryRequest(payload,{'x-go-hub-timestamp':String(Date.now()-600000),'x-go-hub-signature':signature},{secret:'test-secret'}),/EXPIRED/); });
test('local development can explicitly run without a shared secret', () => { assert.equal(verifyHubFactoryRequest({}, {}, { required:false }).authenticated, false); });
