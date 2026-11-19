import fs from 'node:fs'
import { PDFDocument, PDFName } from 'pdf-lib'
const buf = fs.readFileSync(process.argv[2])
const pdf = await PDFDocument.load(buf)
const pages = pdf.getPages()
const box = pages[0].getMediaBox()
console.log('pages=' + pages.length)
console.log('mediaBox=' + JSON.stringify(box))
const cat = pdf.catalog
const ref = cat.get(PDFName.of('Outlines'))
console.log('outlinesRef=' + String(ref))
if (ref) {
  const obj = pdf.context.lookup(ref)
  console.log('outlinesType=' + (obj && obj.toString ? obj.toString().slice(0, 200) : String(obj)))
  const first = obj && obj.get ? obj.get(PDFName.of('First')) : null
  const count = obj && obj.get ? obj.get(PDFName.of('Count')) : null
  console.log('first=' + String(first) + ' count=' + String(count))
  if (first) { const it = pdf.context.lookup(first); console.log('firstItem=' + (it ? it.toString().slice(0, 200) : 'null')) }
}
