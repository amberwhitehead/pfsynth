// Collapse Vite's validated output into one independently deployable HTML file.
import fs from 'node:fs/promises';
import path from 'node:path';
const root = new URL('./dist/', import.meta.url);
let html = await fs.readFile(new URL('index.html', root), 'utf8');
const dataURL = async (file, mime) => `data:${mime};base64,${(await fs.readFile(new URL(file, root))).toString('base64')}`;
const scriptTag = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
if (!scriptTag) throw new Error('Missing Vite entry script');
const cssTag = html.match(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/);
if (!cssTag) throw new Error('Missing Vite stylesheet');
let script = await fs.readFile(new URL(scriptTag[1].replace(/^\//, ''), root), 'utf8');
const worklet = script.match(/"(\/assets\/piano-worklet-[^"]+\.js)"/);
if (!worklet) throw new Error('Missing piano worklet asset');
script = script.replaceAll(worklet[0], JSON.stringify(await dataURL(worklet[1].slice(1), 'text/javascript')));
for (const file of ['salamander.bin', 'pianoteq.bin']) {
  const reference = JSON.stringify('/' + file);
  if (!script.includes(reference)) throw new Error(`Missing piano parameter asset: ${file}`);
  script = script.replaceAll(reference, JSON.stringify(await dataURL(file, 'application/octet-stream')));
}
const css = await fs.readFile(new URL(cssTag[1].slice(1), root), 'utf8');
if (/@import|url\(\s*["']?https?:/i.test(css)) throw new Error('Stylesheet has external dependencies');
html = html.replace(scriptTag[0], () => `<script type="module">${script.replaceAll('</script', '<\\/script')}</script>`);
html = html.replace(cssTag[0], () => `<style>${css}</style>`);
const license = await fs.readFile(new URL('LICENSE.txt', root), 'utf8');
html = html.replace('<html ', `<!--\n${license.replaceAll('--', '—')}\n-->\n<html `);
// Remove only generated Vite artifacts, after the standalone file is complete.
await fs.writeFile(new URL('index.html', root), html);
for (const entry of await fs.readdir(root)) if (entry !== 'index.html') await fs.rm(new URL(entry, root), {recursive: true});
if (html.includes('/assets/') || html.includes('/salamander.bin') || html.includes('/pianoteq.bin') || html.includes('/LICENSE.txt')) throw new Error('Unresolved runtime asset reference');
console.log(`Single-file deployment: ${path.resolve('dist/index.html')} (${Buffer.byteLength(html).toLocaleString()} bytes)`);
