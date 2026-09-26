import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { PIXIE_COMMANDS } from '../pixie-lab/command.mjs';

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 8, 26, 8, 0, tick++)).toISOString();
}

test('Archive snapshots a session but never closes or cleans the room', () => {
  const lab = new PixieLab({ now: clock() });
  lab.startSession({
    roomId:'ROOM-A',
    sessionId:'S-A',
    purpose:'archive separation',
    activityType:'CHECK',
  });
  const before = lab.board();
  const archived = lab.archiveSession('S-A', { archiveId:'ARCHIVE-A', note:'keep this' });
  const after = lab.board();

  assert.equal(archived.archiveId, 'ARCHIVE-A');
  assert.equal(after.archives.length, 1);
  assert.equal(after.cleanRuns.length, 0);
  assert.equal(lab.session('S-A').status, 'ACTIVE');
  assert.equal(lab.room('ROOM-A').status, 'RESERVED');
  assert.equal(lab.room('ROOM-A').activeSessionId, 'S-A');
  assert.equal(before.rooms.find((room) => room.roomId === 'ROOM-A').status, 'RESERVED');
});

test('Clean resets room transient state and never creates an archive', () => {
  const lab = new PixieLab({ now: clock() });
  lab.startSession({
    roomId:'ROOM-B',
    sessionId:'S-B',
    purpose:'clean separation',
    activityType:'CHECK',
  });
  lab.addRoomReport({
    roomId:'ROOM-B',
    roomPixieId:'PIXIE-B',
    roomStatus:'RUNNING',
    activeSubject:'SUBJECT-B',
    latestResult:'FAIL',
    unknowns:['temporary'],
  });

  const cleaned = lab.cleanRoom('ROOM-B', { reason:'OWNER_CLEAN' });
  const board = lab.board();
  const room = lab.room('ROOM-B');

  assert.equal(cleaned.status, 'PASS');
  assert.equal(cleaned.archiveCreated, false);
  assert.deepEqual(cleaned.stages, ['ZERO', 'STERILIZE', 'VERIFY_CLEAN', 'LOAD_CLEAN_SEED', 'READY']);
  assert.deepEqual(cleaned.discardedSessionIds, ['S-B']);
  assert.equal(lab.session('S-B'), null);
  assert.equal(room.status, 'READY');
  assert.equal(room.lifecycleStage, 'READY');
  assert.equal(room.activeSessionId, null);
  assert.equal(board.archives.length, 0);
  assert.equal(board.cleanRuns.length, 1);
  assert.equal(board.roomReports.some((report) => report.roomId === 'ROOM-B'), false);
});

test('Archive survives a later clean because Archive Zone is independent', () => {
  const lab = new PixieLab({ now: clock() });
  lab.startSession({
    roomId:'ROOM-C',
    sessionId:'S-C',
    purpose:'keep then wipe',
    activityType:'CHECK',
  });
  lab.archiveSession('S-C', { archiveId:'ARCHIVE-C' });
  lab.cleanRoom('ROOM-C');

  const board = lab.board();
  assert.equal(board.archives.length, 1);
  assert.equal(board.archives[0].archiveId, 'ARCHIVE-C');
  assert.equal(board.cleanRuns.length, 1);
  assert.equal(lab.room('ROOM-C').status, 'READY');
  assert.equal(lab.session('S-C'), null);
});

test('close_session only closes and leaves a DIRTY room until explicit clean', () => {
  const lab = new PixieLab({ now: clock() });
  lab.startSession({
    roomId:'ROOM-A',
    sessionId:'S-CLOSE',
    purpose:'close only',
    activityType:'CHECK',
  });
  const closed = lab.closeSession('S-CLOSE');

  assert.equal(closed.status, 'CLOSED');
  assert.equal(lab.room('ROOM-A').status, 'DIRTY');
  assert.equal(lab.board().archives.length, 0);
  assert.equal(lab.board().cleanRuns.length, 0);
  assert.throws(() => lab.startSession({
    roomId:'ROOM-A',
    sessionId:'S-BLOCKED',
    purpose:'must clean first',
    activityType:'CHECK',
  }), /ROOM_NOT_READY/);

  lab.cleanRoom('ROOM-A');
  assert.equal(lab.room('ROOM-A').status, 'READY');
  assert.doesNotThrow(() => lab.startSession({
    roomId:'ROOM-A',
    sessionId:'S-AFTER-CLEAN',
    purpose:'new clean room',
    activityType:'CHECK',
  }));
});

test('command surface exposes Archive and Clean as separate actions', () => {
  assert.equal(PIXIE_COMMANDS.includes('archive_session'), true);
  assert.equal(PIXIE_COMMANDS.includes('clean_room'), true);
  assert.equal(PIXIE_COMMANDS.includes('close_session'), true);
});
