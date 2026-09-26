import test from "node:test";
import assert from "node:assert/strict";
import {
  PIXIE_WORKSHOP_ACTIONS,
  PIXIE_WORKSHOP_REPOSITORY,
  createPixieWorkshopToolkit,
  isWorkshopRef,
  roomIdFromRef,
} from "../room-trunk/workshop-tools.mjs";

function memoryHost() {
  const calls = [];
  const wrap = name => async args => {
    calls.push({ name, args });
    return { status:"OK", name, args };
  };
  return {
    calls,
    host:{
      inspectRepository:wrap("inspectRepository"),
      readFile:wrap("readFile"),
      compareRefs:wrap("compareRefs"),
      createBranch:wrap("createBranch"),
      writeFile:wrap("writeFile"),
      deleteFile:wrap("deleteFile"),
      runTests:wrap("runTests"),
      readCi:wrap("readCi"),
      readFailure:wrap("readFailure"),
      openPullRequest:wrap("openPullRequest"),
      roomMerge:wrap("roomMerge"),
      snapshot:wrap("snapshot"),
      rollback:wrap("rollback"),
      recordLesson:wrap("recordLesson"),
      emitEvidence:wrap("emitEvidence"),
    },
  };
}

test("toolbox is complete enough for room experimentation", () => {
  const { host } = memoryHost();
  const toolkit = createPixieWorkshopToolkit({ host });
  const catalog = toolkit.catalog();

  assert.equal(catalog.repository,PIXIE_WORKSHOP_REPOSITORY);
  assert.deepEqual(catalog.rooms,["ROOM-A","ROOM-B","ROOM-C"]);
  assert.equal(catalog.actions.length,PIXIE_WORKSHOP_ACTIONS.length);
  assert.equal(catalog.actions.every(item => item.available),true);

  for (const action of [
    "inspect_repository","read_file","compare_refs","create_branch",
    "write_file","delete_file","run_tests","read_ci","read_failure",
    "open_pr","room_merge","snapshot","rollback","record_lesson","emit_evidence",
  ]) {
    assert.equal(PIXIE_WORKSHOP_ACTIONS.includes(action),true);
  }
});

test("A/B/C and their feature branches are the workshop space", () => {
  assert.equal(isWorkshopRef("room/pixie-a"),true);
  assert.equal(isWorkshopRef("room/pixie-b"),true);
  assert.equal(isWorkshopRef("feature/room-c-next-idea"),true);
  assert.equal(isWorkshopRef("main"),false);
  assert.equal(isWorkshopRef("release"),false);
  assert.equal(roomIdFromRef("feature/room-b-try-2"),"ROOM-B");
});

test("workshop can freely write and merge across A/B/C without inheriting factory policy", async () => {
  const { host, calls } = memoryHost();
  const toolkit = createPixieWorkshopToolkit({ host });

  const write = await toolkit.execute({
    requestId:"REQ-WRITE-1",
    action:"write_file",
    roomId:"ROOM-A",
    targetRef:"feature/room-a-free-play",
    path:"pixie-lab-v1/experiments/demo.mjs",
    content:"export const value = 1;",
  });
  assert.equal(write.ok,true);

  const merge = await toolkit.execute({
    requestId:"REQ-MERGE-1",
    action:"room_merge",
    roomId:"ROOM-A",
    headRef:"feature/room-a-free-play",
    baseRef:"room/pixie-b",
    expectedSha:"abc123",
  });
  assert.equal(merge.ok,true);
  assert.equal(calls.at(-1).name,"roomMerge");
  assert.equal(calls.at(-1).args.base,"room/pixie-b");
});

test("anything outside A/B/C is simply outside the workshop", async () => {
  const { host } = memoryHost();
  const toolkit = createPixieWorkshopToolkit({ host });

  await assert.rejects(
    toolkit.execute({
      requestId:"REQ-OUTSIDE-1",
      action:"write_file",
      roomId:"ROOM-A",
      targetRef:"main",
      path:"x.mjs",
      content:"x",
    }),
    /OUTSIDE_PIXIE_WORKSHOP/,
  );
});

test("snapshots and rollback are first-class workshop tools", async () => {
  const { host, calls } = memoryHost();
  const toolkit = createPixieWorkshopToolkit({ host });

  await toolkit.execute({
    requestId:"REQ-SNAP-1",
    action:"snapshot",
    roomId:"ROOM-C",
    targetRef:"room/pixie-c",
    snapshotId:"SNAP-C-001",
  });
  await toolkit.execute({
    requestId:"REQ-ROLLBACK-1",
    action:"rollback",
    roomId:"ROOM-C",
    targetRef:"room/pixie-c",
    snapshotId:"SNAP-C-001",
  });

  assert.equal(calls.at(-2).name,"snapshot");
  assert.equal(calls.at(-1).name,"rollback");
});

test("missing host implementation stays explicit and does not invent success", async () => {
  const toolkit = createPixieWorkshopToolkit({ host:{} });
  const result = await toolkit.execute({
    requestId:"REQ-MISSING-1",
    action:"run_tests",
    roomId:"ROOM-B",
    targetRef:"room/pixie-b",
  });

  assert.equal(result.ok,false);
  assert.equal(result.status,"TOOL_UNAVAILABLE");
  assert.equal(result.missingCapability,"runTests");
});

test("future workshop tools can be added as extensions without editing the core toolbox", async () => {
  const toolkit = createPixieWorkshopToolkit({
    extensions:[{
      action:"render_preview",
      async run(input) {
        return { ok:true, roomId:input.roomId, rendered:true };
      },
    }],
  });

  const result = await toolkit.execute({
    requestId:"REQ-X-1",
    action:"render_preview",
    roomId:"ROOM-A",
  });

  assert.equal(result.ok,true);
  assert.equal(result.rendered,true);
});
