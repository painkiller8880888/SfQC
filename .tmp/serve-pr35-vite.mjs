import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const worktree = 'C:/Users/P1569/.codex/worktrees/issue-21-question-grading/SfQC'
const cacheDir = 'C:/Users/P1569/Desktop/SfQC/.tmp/pr35-vite-cache'
const vite = await import(pathToFileURL(resolve(worktree, 'node_modules/vite/dist/node/index.js')).href)
const reactPlugin = await import(pathToFileURL(resolve(worktree, 'node_modules/@vitejs/plugin-react/dist/index.js')).href)
const server = await vite.createServer({
  root: worktree,
  configFile: false,
  base: '/SfQC/',
  cacheDir,
  plugins: [reactPlugin.default()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
})
await server.listen()
server.printUrls()