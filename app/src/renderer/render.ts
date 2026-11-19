
import hljs from 'highlight.js'

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2')
    .replace(/<\s*\/?\s*(html|head|body)\b[^>]*>/gi, '')
}

// ---------- MathJax ----------

let mjPromise: Promise<any> | null = null

export function loadMathJax(): Promise<any> {
  const w = window as any
  if (w.MathJax && w.MathJax.tex2svgPromise) return Promise.resolve(w.MathJax)
  if (mjPromise) return mjPromise
  mjPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'vendor/mathjax/tex-svg.js'
    s.async = true
    s.onload = () => {
      const MJ = (window as any).MathJax
      if (MJ && MJ.startup && MJ.startup.promise) {
        MJ.startup.promise.then(() => resolve(MJ)).catch(reject)
      } else if (MJ) resolve(MJ)
      else reject(new Error('MathJax failed to initialise'))
    }
    s.onerror = () => reject(new Error('MathJax script load failed'))
    document.head.appendChild(s)
  })
  return mjPromise
}

export async function renderMath(tex: string, display: boolean): Promise<HTMLElement> {
  const MJ = await loadMathJax()
  const host = document.createElement('span')
  host.className = 'konai-math-host'
  host.textContent = '⟨math…⟩'
  try {
    const node = await MJ.tex2svgPromise(tex, { display, em: 16, ex: 8, containerWidth: 860, scale: 1 })
    if (!node || !node.innerHTML || node.innerHTML.length < 5) { host.textContent = 'MATH EMPTY keys=' + Object.keys(MJ).join(',') + ' tex2=' + typeof MJ.tex2svgPromise; return host }
    host.replaceChildren(node)
  } catch (e) {
    host.textContent = 'MATH ERR: ' + String(e)
  }
  return host
}

export function mathToHtml(tex: string, display: boolean): string {
  const esc = escapeHtml(tex)
  return '<span class="konai-math-src">' + (display ? '\\[' + esc + '\\]' : '\\(' + esc + '\\)') + '</span>'
}

// ---------- Mermaid ----------

let mermaidMod: any = null

export async function loadMermaid(): Promise<any> {
  if (mermaidMod) return mermaidMod
  const mod: any = await import('mermaid')
  mermaidMod = mod.default || mod
  return mermaidMod
}

export async function renderMermaid(code: string, id: string, theme: string): Promise<HTMLElement> {
  const host = document.createElement('div')
  host.className = 'konai-mermaid'
  try {
    const mermaid = await loadMermaid()
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'dark' ? 'dark' : 'default', fontFamily: 'inherit' })
    const res = await mermaid.render('konai-mm-' + id, code)
    host.innerHTML = res.svg || ''
    const el = host.querySelector('svg')
    if (el) {
      el.style.maxWidth = '100%'
      el.style.height = 'auto'
    }
  } catch (e) {
    host.innerHTML = '<pre class="konai-mermaid-error">' + escapeHtml(code) + '</pre>'
  }
  return host
}

// ---------- code highlight ----------

const LANG_MAP: Record<string, string> = {
  js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript', md: 'markdown', yml: 'yaml',
  sh: 'bash', shell: 'bash', zsh: 'bash', py: 'python', rb: 'ruby', rs: 'rust', cs: 'csharp', kt: 'kotlin',
  cpp: 'cpp', cxx: 'cpp', h: 'c', hpp: 'cpp', golang: 'go', docker: 'dockerfile', tf: 'hcl', conf: 'ini',
}

export function normalizeLang(lang: string): string {
  const l = (lang || '').toLowerCase()
  return LANG_MAP[l] || l
}

export function highlightCode(code: string, lang: string, lineNumbers = false): string {
  const language = normalizeLang(lang)
  let html = ''
  try {
    if (language && hljs.getLanguage(language)) {
      html = hljs.highlight(code, { language, ignoreIllegals: true }).value
    } else {
      html = hljs.highlightAuto(code).value
    }
  } catch {
    html = escapeHtml(code)
  }
  if (lineNumbers) {
    const lines = html.split('\n')
    const body = lines.map((l, i) => '<span class="konai-code-line"><span class="konai-ln">' + (i + 1) + '</span>' + (l || '') + '</span>').join('\n')
    return '<pre class="konai-code"><code>' + body + '</code></pre>'
  }
  return '<pre class="konai-code"><code>' + html + '</code></pre>'
}

export function codeHtml(code: string, lang: string, lineNumbers = false): string {
  return highlightCode(code.replace(/\n$/, ''), lang, lineNumbers)
}

// ---------- misc ----------

export function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
}

export function resolveAsset(src: string, docDir: string): string {
  if (!src) return ''
  if (/^(https?:|data:|file:|konai-file:)/i.test(src)) return src
  if (src.startsWith('/')) return 'konai-file://' + src
  const base = docDir.replace(/\\/g, '/')
  return 'konai-file://' + (base ? base.replace(/\/?$/, '/') : '') + src.replace(/^\.\//, '')
}