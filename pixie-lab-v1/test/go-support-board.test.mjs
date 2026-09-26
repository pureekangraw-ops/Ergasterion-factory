import test from "node:test";
import assert from "node:assert/strict";
import { projectGoSupportBoard } from "../room-trunk/go-support-board.mjs";

test("support board projects mission cards without controlling work", () => {
  const board=projectGoSupportBoard({
    now:()=>"2026-09-26T16:00:00.000Z",
    missions:[
      {
        missionId:"M-1",
        mission:"ช่วย GO ตรวจ parser",
        requestedResult:"ได้ candidate",
        status:"ACTIVE",
        assignedRooms:["ROOM-A","ROOM-B","ROOM-C"],
        startedAt:"2026-09-26T15:00:00.000Z",
        roomStates:[
          {roomId:"ROOM-A",session:{status:"FINISHED",trace:[1,2],observations:[1],evidenceRefs:["e1","e2"],unknowns:[],finalResult:{candidate:"A1"}}},
          {roomId:"ROOM-B",session:{status:"ACTIVE",trace:[1],observations:[],evidenceRefs:["e3"],unknowns:["U1"],finalResult:null}},
          {roomId:"ROOM-C",session:{status:"ACTIVE",trace:[],observations:[],evidenceRefs:[],unknowns:[],finalResult:null}},
        ],
      },
    ],
  });

  assert.equal(board.projectionOnly,true);
  assert.equal(board.generatedFor,"GO");
  assert.equal(board.cards[0].status,"PARTIAL");
  assert.equal(board.cards[0].finishedRooms,1);
  assert.equal(board.cards[0].evidenceCount,3);
  assert.equal(board.cards[0].unknownCount,1);
  assert.equal(board.counts.partial,1);
});

test("ready-for-go appears when every room finished", () => {
  const board=projectGoSupportBoard({
    missions:[{
      missionId:"M-2",
      mission:"ลองสามทาง",
      status:"ACTIVE",
      assignedRooms:["ROOM-A","ROOM-B"],
      roomStates:[
        {roomId:"ROOM-A",session:{status:"FINISHED",trace:[],observations:[],evidenceRefs:[],unknowns:[]}},
        {roomId:"ROOM-B",session:{status:"FINISHED",trace:[],observations:[],evidenceRefs:[],unknowns:[]}},
      ],
    }],
  });

  assert.equal(board.cards[0].status,"READY_FOR_GO");
  assert.equal(board.counts.readyForGo,1);
});
