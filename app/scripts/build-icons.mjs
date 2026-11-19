// Regenerate build/icon.png + build/icon.ico from an original vector/raster source.
// The icon is an original Konai mark (rounded square + K), drawn here with Pillow.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { execFileSync } from 'node:child_process'
const ROOT = path.resolve(__dirname, '..')
const py = [
  'from PIL import Image, ImageDraw, ImageFont',
  'S=512',
  'im=Image.new("RGBA",(S,S),(0,0,0,0))',
  'd=ImageDraw.Draw(im)',
  'for y in range(S):',
  '    t=y/(S-1); d.line([(0,y),(S,y)],fill=(int(66+(124-66)*t),int(74+(90-74)*t),int(230+(214-230)*t),255))',
  'm=Image.new("L",(S,S),0); ImageDraw.Draw(m).rounded_rectangle([0,0,S-1,S-1],radius=110,fill=255)',
  'bg=Image.new("RGBA",(S,S),(0,0,0,0)); bg.paste(im,(0,0),m); d=ImageDraw.Draw(bg)',
  'f=ImageFont.truetype(r"C:\\Windows\\Fonts\\segoeuib.ttf",300)',
  'bb=d.textbbox((0,0),"K",font=f); w=bb[2]-bb[0]; h=bb[3]-bb[1]',
  'd.text(((S-w)/2-bb[0],(S-h)/2-bb[1]),"K",font=f,fill=(255,255,255,255))',
  'bg.save(r"' + path.join(ROOT, 'build', 'icon.png') + '")',
  'bg.save(r"' + path.join(ROOT, 'build', 'icon.ico') + '", format="ICO", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])',
].join('\n')
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true })
execFileSync('python', ['-c', py], { stdio: 'inherit' })
console.log('icons regenerated')