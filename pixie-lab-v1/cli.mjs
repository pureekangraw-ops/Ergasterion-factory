#!/usr/bin/env node
import { resolve } from 'node:path';
import { createJsonFilePersistence } from './pixie-lab/adapters.mjs';
import { createPixieCommander, PIXIE_COMMANDS } from './pixie-lab/command.mjs';

function usage() {
  return {
    usage: [
      'npm run pixie -- status',
      'npm run pixie -- ask "มี unknown ไหม"',
      'npm run pixie -- \'{"command":"start_session","args":{"roomId":"ROOM-A","sessionId":"S-1","purpose":"check","activityType":"CHECK"}}\'',
      'npm run pixie -- start_session \'{"roomId":"ROOM-A","sessionId":"S-1","purpose":"check","activityType":"CHECK"}\'',
    ],
    commands: PIXIE_COMMANDS,
    stateFile: process.env.PIXIE_STATE_FILE || '.pixie/state.json',
  };
}

function parse(argv) {
  if (!argv.length || ['help', '--help', '-h'].includes(argv[0])) return null;
  const joined = argv.join(' ').trim();
  if (joined.startsWith('{')) return JSON.parse(joined);

  const command = argv[0];
  if (command === 'ask') return { command, args: { question: argv.slice(1).join(' ') } };
  const rawArgs = argv.slice(1).join(' ').trim();
  return { command, args: rawArgs ? JSON.parse(rawArgs) : {} };
}

try {
  const input = parse(process.argv.slice(2));
  if (!input) {
    console.log(JSON.stringify(usage(), null, 2));
    process.exit(0);
  }

  const stateFile = resolve(process.cwd(), process.env.PIXIE_STATE_FILE || '.pixie/state.json');
  const persistence = createJsonFilePersistence({ filePath: stateFile });
  const commander = createPixieCommander({ persistence });
  const output = await commander.execute(input);
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exitCode = 2;
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
}
