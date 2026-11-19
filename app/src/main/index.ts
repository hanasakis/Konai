
import { app, BrowserWindow, ipcMain, dialog, protocol, shell, screen, nativeTheme } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  listDir, readFileSnapshot, writeFileAtomic, newFile, newFolder, renamePath, movePaths,
  trashPaths, undoTrash, watchWorkspace, unwatchWorkspace, saveDraft, listDrafts, readDraft, clearDraft,
  draftsDir, emptyTrashBackup,
} from './fs'
import { loadConfig, getConfig, saveConfig, addRecentFile, addRecentFolder, confDir } from './config'
import { quickOpen, globalSearch } from './search'
import { printPdf, writeTextFile, detectPandoc, captureImage, exportDocx, openPath, showItemInFolder, openExternal, trashPath } from './export'
import { DocSnapshot, ExportPdfOptions, ExportDocxOptions, ExportImageOptions, Config } from '@shared/types'

const DEV_URL = process.env.ELECTRON_RENDERER_URL
let mainWindow: BrowserWindow | null = null
let initialFile: string | null = null
const openFiles = new Set<string>()

function createWindow(file?: string): BrowserWindow {
  const cfg = getConfig()
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 760,
    minHeight: 480,
    title: 'Konai',
    backgroundColor: cfg.followSystemTheme && nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
    icon: join(__dirname, '../../build/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      webviewTag: false,
    },
  })
  if (DEV_URL) win.loadURL(DEV_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  win.on('closed', () => { if (mainWindow === win) mainWindow = null })
  win.webContents.on('did-finish-load', () => {
    if (file) win.webContents.send('konai:openFile', file)
  })
  return win
}

function sendToRenderer(channel: string, payload?: unknown): void {
  const wins = BrowserWindow.getAllWindows()
  for (const w of wins) w.webContents.send(channel, payload)
}

function registerIpc(): void {
  ipcMain.handle('config:load', () => getConfig())
  ipcMain.handle('config:save', (_e, patch: Partial<Config>) => saveConfig(patch))

  ipcMain.handle('fs:listDir', (_e, path: string) => listDir(path, getConfig()))
  ipcMain.handle('fs:openFile', (_e, path: string) => {
    const snap = readFileSnapshot(path)
    openFiles.add(path)
    addRecentFile(path, snap.name)
    return snap
  })
  ipcMain.handle('fs:saveFile', (_e, path: string, text: string) => {
    const mtime = writeFileAtomic(path, text)
    clearDraft(path)
    return { mtime }
  })
  ipcMain.handle('fs:newFile', (_e, dir: string, name: string) => newFile(dir, name))
  ipcMain.handle('fs:newFolder', (_e, dir: string, name: string) => newFolder(dir, name))
  ipcMain.handle('fs:rename', (_e, oldPath: string, newPath: string) => { renamePath(oldPath, newPath); return { ok: true } })
  ipcMain.handle('fs:move', (_e, paths: string[], targetDir: string) => { movePaths(paths, targetDir); return { ok: true } })
  ipcMain.handle('fs:trash', async (_e, paths: string[]) => trashPaths(paths))
  ipcMain.handle('fs:undoTrash', (_e, undoId: string) => undoTrash(undoId))
  ipcMain.handle('fs:emptyTrash', () => { emptyTrashBackup(); return { ok: true } })

  ipcMain.handle('fs:saveDraft', (_e, path: string, text: string) => { saveDraft(path, text); return { ok: true } })
  ipcMain.handle('fs:listDrafts', () => listDrafts())
  ipcMain.handle('fs:readDraft', (_e, path: string) => readDraft(path))
  ipcMain.handle('fs:clearDraft', (_e, path: string) => { clearDraft(path); return { ok: true } })
  ipcMain.handle('fs:draftsDir', () => draftsDir())

  ipcMain.handle('fs:quickOpen', (_e, query: string, root: string) => quickOpen(query, root))
  ipcMain.handle('fs:search', (_e, query: string, root: string, opts: any) => globalSearch(query, root, opts))

  ipcMain.handle('export:writeHtml', (_e, path: string, html: string) => { writeTextFile(path, html); return { path } })
  ipcMain.handle('export:pdf', async (_e, opts: ExportPdfOptions, bookmarks: Array<{ title: string; page: number }>, html: string) => {
    const tmp = join(app.getPath('temp'), 'konai-export-' + Date.now() + '.html')
    writeTextFile(tmp, html)
    const res = await printPdf(tmp, opts, bookmarks)
    return res
  })
  ipcMain.handle('export:docx', async (_e, opts: ExportDocxOptions) => exportDocx(opts))
  ipcMain.handle('export:image', async (_e, opts: ExportImageOptions, html: string) => {
    const tmp = join(app.getPath('temp'), 'konai-img-' + Date.now() + '.html')
    writeTextFile(tmp, html)
    return captureImage(tmp, opts.path, opts.width, opts.height)
  })
  ipcMain.handle('export:detectPandoc', () => detectPandoc())

  ipcMain.handle('app:pickFolder', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('app:pickFile', async (_e, filters: any[]) => {
    const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters })
    return r.canceled ? [] : r.filePaths
  })
  ipcMain.handle('app:showSaveDialog', async (_e, opts: any) => {
    const r = await dialog.showSaveDialog(opts || {})
    return r.canceled ? null : r.filePath
  })
  ipcMain.handle('app:showMessageBox', async (_e, opts: any) => {
    const r = await dialog.showMessageBox(mainWindow || BrowserWindow.getFocusedWindow() || new BrowserWindow({ show: false }), opts || {})
    return r.response
  })
  ipcMain.handle('app:confirm', async (_e, message: string, detail?: string) => {
    const r = await dialog.showMessageBox(mainWindow || BrowserWindow.getFocusedWindow() || new BrowserWindow({ show: false }), {
      type: 'question', buttons: ['取消', '确定'], defaultId: 1, cancelId: 0, message, detail,
    })
    return r.response === 1
  })

  ipcMain.handle('shell:openExternal', (_e, target: string) => { openExternal(target); return { ok: true } })
  ipcMain.handle('shell:showItemInFolder', (_e, p: string) => { showItemInFolder(p); return { ok: true } })
  ipcMain.handle('shell:openPath', (_e, p: string) => { openPath(p); return { ok: true } })
  ipcMain.handle('shell:openConfFolder', () => { openPath(confDir()); return { ok: true } })
  ipcMain.handle('shell:openThemeFolder', () => {
    const dir = join(app.getPath('userData'), 'themes')
    if (!existsSync(dir)) return { ok: false }
    openPath(dir)
    return { ok: true }
  })

  ipcMain.handle('app:setWindowStyle', (_e, style: string) => {
    const win = mainWindow
    if (!win) return { ok: true }
    if (style === 'seamless' || style === 'unibody') win.setBackgroundColor('#ffffff')
    else win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff')
    return { ok: true }
  })
  ipcMain.handle('app:setZoom', (_e, factor: number) => {
    const win = mainWindow
    if (win) win.webContents.setZoomFactor(Math.min(3, Math.max(0.5, factor)))
    return { ok: true }
  })
  ipcMain.handle('app:windowAction', (_e, action: string) => {
    const win = mainWindow
    if (!win) return { ok: true }
    if (action === 'minimize') win.minimize()
    else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
    else if (action === 'close') win.close()
    else if (action === 'fullscreen') win.setFullScreen(!win.isFullScreen())
    else if (action === 'alwaysOnTop') win.setAlwaysOnTop(!win.isAlwaysOnTop())
    return { ok: true }
  })
  ipcMain.handle('app:newWindow', (_e, file?: string) => { createWindow(file); return { ok: true } })
  ipcMain.handle('app:openInNewWindow', (_e, file: string) => { createWindow(file); return { ok: true } })
  ipcMain.handle('app:checkUpdates', async () => {
    try {
      const res = await fetch('https://api.github.com/repos/konai/konai/releases/latest', { headers: { 'User-Agent': 'konai' } })
      if (!res.ok) return { ok: false, error: 'network' }
      const j = await res.json()
      return { ok: true, version: j.tag_name, url: j.html_url }
    } catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('app:listOpenFiles', () => Array.from(openFiles))
  ipcMain.handle('app:setTitle', (_e, title: string) => { if (mainWindow) mainWindow.setTitle(title); return { ok: true } })
  ipcMain.handle('app:theme', () => ({ shouldUseDarkColors: nativeTheme.shouldUseDarkColors, themeSource: nativeTheme.themeSource }))
  ipcMain.handle('app:screen', () => {
    const d = screen.getPrimaryDisplay()
    return { bounds: d.bounds, scaleFactor: d.scaleFactor }
  })
  ipcMain.handle('fs:watch', (_e, root: string) => {
    watchWorkspace(root, (ev) => sendToRenderer('konai:fsEvent', ev))
    return { ok: true }
  })
  ipcMain.handle('fs:unwatch', () => { unwatchWorkspace(); return { ok: true } })
  ipcMain.handle('fs:addRecentFolder', (_e, path: string, name: string) => { addRecentFolder(path, name); return { ok: true } })
  ipcMain.handle('fs:openFolder', (_e, path: string) => { addRecentFolder(path, path.split(/[\\/]/).pop() || path); return { ok: true } })
  ipcMain.handle('fs:recent', () => ({ files: getConfig().recentFiles, folders: getConfig().recentFolders }))
}

app.whenReady().then(() => {
  loadConfig()
  registerIpc()
  protocol.registerFileProtocol('konai-file', (req, cb) => {
    try { cb(decodeURIComponent(req.url.replace(/^konai-file:\/\//, ''))) } catch { cb('') }
  })
  const args = process.argv.slice(1)
  for (const a of args) {
    if (/\.(md|markdown|txt)$/i.test(a) && existsSync(a)) { initialFile = a; break }
  }
  createWindow(initialFile || undefined)
  mainWindow = BrowserWindow.getAllWindows()[0] || null
  app.on('open-file', (e, p) => { e.preventDefault(); openExternalFile(p) })
  app.on('second-instance', (_e, argv) => {
    const files = argv.slice(1).filter((a) => /\.(md|markdown|txt)$/i.test(a) && existsSync(a))
    if (files.length) {
      if (mainWindow) mainWindow.webContents.send('konai:openFile', files[0])
      else createWindow(files[0])
      mainWindow?.focus()
    }
  })
  nativeTheme.on('updated', () => sendToRenderer('konai:themeChanged', { shouldUseDarkColors: nativeTheme.shouldUseDarkColors }))
})

function openExternalFile(p: string): void {
  if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('konai:openFile', p)
  else createWindow(p)
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })