import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createEvidence, createSterilizationAdapter, executeTestType } from './core.mjs';

const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const required = (value, label) => { const result = text(value); if (!result) throw new Error(`${label} is required`); return result; };

/** Append-only JSON persistence for a host that wants a real local canonical store. */
export function createJsonFilePersistence({ filePath } = {}) {
  const path = required(filePath, 'filePath');
  return Object.freeze({
    async load() {
      try { return JSON.parse(await readFile(path, 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async save(value) {
      await mkdir(dirname(path), { recursive: true });
      const temp = `${path}.tmp`;
      await writeFile(temp, JSON.stringify(clone(value), null, 2));
      await rename(temp, path);
      return clone(value);
    },
  });
}

/** Evidence sink that preserves immutable evidence records and never upgrades UNKNOWN. */
export function createEvidenceStore({ append, list } = {}) {
  const values = [];
  return Object.freeze({
    async appendEvidence(input) {
      const item = createEvidence(input);
      values.push(item);
      if (typeof append === 'function') await append(clone(item));
      return clone(item);
    },
    async listEvidence() {
      const external = typeof list === 'function' ? await list() : values;
      return clone(external || values);
    },
  });
}

/** Host-facing sterilizer: the probe must return explicit status and evidence. */
export function createEvidenceBackedSterilizer({ adapterId, name, probe } = {}) {
  return createSterilizationAdapter({
    adapterId,
    name,
    sterilize(context) {
      if (typeof probe !== 'function') return { status: 'UNKNOWN', evidenceStatus: 'UNKNOWN', reason: 'PROBE_UNAVAILABLE' };
      const result = probe(clone(context));
      const evidence = Array.isArray(result?.evidence) ? result.evidence.map((item) => createEvidence(item)) : [];
      return { ...clone(result), evidence, evidenceStatus: evidence.length && evidence.every((item) => item.status === 'PASS') ? 'PASS' : evidence.some((item) => item.status === 'FAIL') ? 'FAIL' : 'UNKNOWN' };
    },
  });
}

/** Runner host deliberately returns UNKNOWN for missing implementations. */
export function createRunnerHost({ registry } = {}) {
  return Object.freeze({
    async run(testTypeId, context = {}) {
      return executeTestType(registry, testTypeId, context);
    },
  });
}

/** Bounded replay queue; it schedules Lab work only and has no deploy/merge authority. */
export function createReplayQueue({ execute } = {}) {
  const queue = [];
  return Object.freeze({
    enqueue(item) { queue.push(clone(item)); return { status: 'QUEUED', size: queue.length }; },
    size() { return queue.length; },
    async drain() {
      const results = [];
      while (queue.length) {
        const item = queue.shift();
        results.push(typeof execute === 'function' ? await execute(clone(item)) : { status: 'UNKNOWN', reason: 'REPLAY_EXECUTOR_UNAVAILABLE', item });
      }
      return results;
    },
  });
}
