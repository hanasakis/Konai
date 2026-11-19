// Create a portable launcher that runs the packed app without installation.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ROOT = path.resolve(__dirname, '..')
const dist = path.join(ROOT, 'dist')
const unpacked = path.join(dist, 'win-unpacked')
if (!fs.existsSync(unpacked)) { console.error('win-unpacked not found; run npm run dist:dir first'); process.exit(1) }
const launcher = path.join(dist, 'Konai-portable.cmd')
fs.writeFileSync(launcher, '@echo off\r\nstart "" "%~dp0win-unpacked\\Konai.exe" %*\r\n')
const readme = path.join(dist, 'PORTABLE.txt')
fs.writeFileSync(readme, 'Konai portable launcher\r\nRun Konai-portable.cmd (or win-unpacked\\Konai.exe).\r\nNo installation, no activation, no telemetry.\r\n')
console.log('portable launcher:', launcher)