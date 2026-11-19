
import { contextBridge, ipcRenderer, webUtils } from 'electron'

const invoke = (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
const on = (channel: string, cb: (payload: any) => void) => {
  const listener = (_e: any, payload: any) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  invoke,
  onFsEvent: (cb: any) => on('konai:fsEvent', cb),
  onConfig: (cb: any) => on('konai:config', cb),
  onOpenFile: (cb: any) => on('konai:openFile', cb),
  onThemeChanged: (cb: any) => on('konai:themeChanged', cb),

  config: {
    load: () => invoke('config:load'),
    save: (patch: any) => invoke('config:save', patch),
  },
  fs: {
    listDir: (path: string) => invoke('fs:listDir', path),
    openFile: (path: string) => invoke('fs:openFile', path),
    saveFile: (path: string, text: string) => invoke('fs:saveFile', path, text),
    newFile: (dir: string, name: string) => invoke('fs:newFile', dir, name),
    newFolder: (dir: string, name: string) => invoke('fs:newFolder', dir, name),
    rename: (oldPath: string, newPath: string) => invoke('fs:rename', oldPath, newPath),
    move: (paths: string[], targetDir: string) => invoke('fs:move', paths, targetDir),
    trash: (paths: string[]) => invoke('fs:trash', paths),
    undoTrash: (undoId: string) => invoke('fs:undoTrash', undoId),
    emptyTrash: () => invoke('fs:emptyTrash'),
    saveDraft: (path: string, text: string) => invoke('fs:saveDraft', path, text),
    listDrafts: () => invoke('fs:listDrafts'),
    readDraft: (path: string) => invoke('fs:readDraft', path),
    clearDraft: (path: string) => invoke('fs:clearDraft', path),
    draftsDir: () => invoke('fs:draftsDir'),
    quickOpen: (query: string, root: string) => invoke('fs:quickOpen', query, root),
    search: (query: string, root: string, opts: any) => invoke('fs:search', query, root, opts),
    watch: (root: string) => invoke('fs:watch', root),
    unwatch: () => invoke('fs:unwatch'),
    addRecentFolder: (path: string, name: string) => invoke('fs:addRecentFolder', path, name),
    openFolder: (path: string) => invoke('fs:openFolder', path),
    recent: () => invoke('fs:recent'),
  },
  export: {
    writeHtml: (path: string, html: string) => invoke('export:writeHtml', path, html),
    pdf: (opts: any, bookmarks: any[], html: string) => invoke('export:pdf', opts, bookmarks, html),
    docx: (opts: any) => invoke('export:docx', opts),
    image: (opts: any, html: string) => invoke('export:image', opts, html),
    detectPandoc: () => invoke('export:detectPandoc'),
  },
  app: {
    pickFolder: () => invoke('app:pickFolder'),
    pickFile: (filters: any[]) => invoke('app:pickFile', filters),
    showSaveDialog: (opts: any) => invoke('app:showSaveDialog', opts),
    showMessageBox: (opts: any) => invoke('app:showMessageBox', opts),
    confirm: (message: string, detail?: string) => invoke('app:confirm', message, detail),
    setWindowStyle: (style: string) => invoke('app:setWindowStyle', style),
    setZoom: (factor: number) => invoke('app:setZoom', factor),
    windowAction: (action: string) => invoke('app:windowAction', action),
    newWindow: (file?: string) => invoke('app:newWindow', file),
    openInNewWindow: (file: string) => invoke('app:openInNewWindow', file),
    checkUpdates: () => invoke('app:checkUpdates'),
    listOpenFiles: () => invoke('app:listOpenFiles'),
    setTitle: (title: string) => invoke('app:setTitle', title),
    theme: () => invoke('app:theme'),
    screen: () => invoke('app:screen'),
    getPath: (p: string) => (webUtils ? webUtils.getPathForFile({ path: p } as any) : p),
  },
  shell: {
    openExternal: (target: string) => invoke('shell:openExternal', target),
    showItemInFolder: (p: string) => invoke('shell:showItemInFolder', p),
    openPath: (p: string) => invoke('shell:openPath', p),
    openConfFolder: () => invoke('shell:openConfFolder'),
    openThemeFolder: () => invoke('shell:openThemeFolder'),
  },
}

contextBridge.exposeInMainWorld('konai', api)
export type KonaiApi = typeof api
