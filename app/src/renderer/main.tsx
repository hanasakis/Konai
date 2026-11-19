import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { buildExportHtml } from './export'

;(window as any).__konai = { buildExportHtml }

const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)