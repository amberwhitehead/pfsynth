import fs from 'node:fs';
import {createHash} from 'node:crypto';
const web = new URL('../', import.meta.url), upstream = new URL('../../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('native/upstream-sync.json', web)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const hasUpstream = fs.existsSync(new URL('src/host/pfplayer.c', upstream));
for (const entry of manifest.files) {
  if (hasUpstream && hash(fs.readFileSync(new URL(entry.source, upstream))) !== entry.sha256) throw new Error(`Upstream changed: ${entry.source}; audit and update the port before accepting the new hash.`);
  if (entry.copy) {
    let bytes = fs.readFileSync(new URL(entry.copy, web));
    if (entry.wasmSentinel) bytes = Buffer.from(bytes.toString().replace('0x7fffffffL;   /* wasm32: long is 32-bit; the upstream 64-bit sentinel truncates to -1 here */', '0x7fffffffffffffffL;'));
    if (hash(bytes) !== entry.sha256) throw new Error(`Vendored/data copy drifted: ${entry.copy}`);
  }
}
console.log(`Sync manifest ${manifest.commit}: vendored code/data match${hasUpstream ? '; local upstream source unchanged.' : '; upstream checkout unavailable, source freshness not checked.'}`);
