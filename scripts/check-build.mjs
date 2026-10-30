import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
await assert.rejects(access(new URL('../dist/map-poc.html', import.meta.url)), { code: 'ENOENT' },
  'the retired standalone PoC entry must not be published')
assert.match(html, /lang="ja"/, 'production HTML should declare Japanese')

const notFoundHtml = await readFile(new URL('../dist/404.html', import.meta.url), 'utf8')
assert.match(notFoundHtml, /<html lang="ja">/, '404 page should declare Japanese')
assert.match(notFoundHtml, /href="\/SfQC\/#\/map"/, '404 page should link back to the learning map')

const assets = [...html.matchAll(/(?:src|href)="(\/SfQC\/assets\/[^"]+)"/g)]
  .map(([, url]) => url)

assert.ok(assets.some((url) => url.endsWith('.js')), 'production JavaScript should use the Pages base path')
assert.ok(assets.some((url) => url.endsWith('.css')), 'production CSS should use the Pages base path')

const javascript = await readFile(new URL(`../dist/${assets.find((url) => url.endsWith('.js')).slice('/SfQC/'.length)}`, import.meta.url), 'utf8')
const stylesheet = await readFile(new URL(`../dist/${assets.find((url) => url.endsWith('.css')).slice('/SfQC/'.length)}`, import.meta.url), 'utf8')
assert.match(javascript, /map-graph-view/, 'production JavaScript should include the integrated lesson map')
assert.match(stylesheet, /react-flow/, 'production CSS should include React Flow styles')

for (const url of assets) {
  await access(new URL(`../dist/${url.slice('/SfQC/'.length)}`, import.meta.url))
}

await access(new URL('../dist/third-party-licenses.txt', import.meta.url))
const licenses = await readFile(new URL('../dist/third-party-licenses.txt', import.meta.url), 'utf8')
assert.match(licenses, /@xyflow\/react@12\.12\.0/u, 'production graph dependencies should be listed')
assert.match(licenses, /@dagrejs\/dagre@3\.1\.3/u, 'production graph dependencies should be listed')
