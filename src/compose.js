// ---------------- Settings ----------------
// Where the person is placed by default (fractions of the round frame)
export const AREA = {
  x0: 0.04,   // left limit
  x1: 0.52,   // right limit (badge starts after this)
  maxH: 0.93, // max height of the person
}

// AI model. 'isnet_quint8' = smaller + faster.
// If edges look rough, change to 'isnet_fp16' (bigger, slightly better quality).
export const MODEL = 'isnet_quint8'

export const OUTPUT = 1080 // exported image size (px)

// ---------------- Helpers ----------------
export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

let framePromise
export const getFrame = () => (framePromise ??= loadImage('/frame.png'))

export function cloneCanvas(src) {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  c.getContext('2d').drawImage(src, 0, 0)
  return c
}

// SPEED: shrink huge phone photos (12MP+) right after selecting them
export async function prepareUpload(file, max = 1600) {
  const tmp = URL.createObjectURL(file)
  try {
    const img = await loadImage(tmp)
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k)
    c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92))
    return URL.createObjectURL(blob)
  } finally {
    URL.revokeObjectURL(tmp)
  }
}

// Crop the user's selection (natural px). SPEED: max 800px is plenty for the frame.
export async function cropToBlob(img, px, max = 800) {
  const k = Math.min(1, max / Math.max(px.width, px.height))
  const c = document.createElement('canvas')
  c.width = Math.round(px.width * k)
  c.height = Math.round(px.height * k)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, px.x, px.y, px.width, px.height, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob(res, 'image/png'))
}

// Remove transparent borders around the person
export function trimCanvas(src) {
  const ctx = src.getContext('2d', { willReadFrequently: true })
  const { data, width, height } = ctx.getImageData(0, 0, src.width, src.height)
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return src
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const t = document.createElement('canvas')
  t.width = w
  t.height = h
  t.getContext('2d').drawImage(src, minX, minY, w, h, 0, 0, w, h)
  return t
}

// PNG blob (background removed) -> trimmed canvas
export async function blobToPerson(blob) {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d').drawImage(img, 0, 0)
    return trimCanvas(c)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------------- Placement / drawing ----------------
// transform t = { cx, cy, s, rot, flip }
// cx, cy = centre of the person (fraction of frame), s = size multiplier,
// rot = tilt in degrees, flip = mirror horizontally
const baseScale = (w, h) => Math.min((AREA.x1 - AREA.x0) / w, AREA.maxH / h)

export function defaultTransform(p) {
  const b = baseScale(p.width, p.height)
  return {
    cx: (AREA.x0 + AREA.x1) / 2,
    cy: 1 - (p.height * b) / 2, // bottom aligned
    s: 1,
    rot: 0,
    flip: false,
  }
}

export function drawScene(ctx, size, frame, person, t) {
  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.imageSmoothingQuality = 'high'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(frame, 0, 0, size, size)
  if (person) {
    const b = baseScale(person.width, person.height)
    const dw = person.width * b * t.s * size
    const dh = person.height * b * t.s * size
    ctx.translate(t.cx * size, t.cy * size)
    ctx.rotate((t.rot * Math.PI) / 180)
    ctx.scale(t.flip ? -1 : 1, 1)
    ctx.drawImage(person, -dw / 2, -dh / 2, dw, dh)
  }
  ctx.restore()
}

export async function renderToBlob(person, t) {
  const frame = await getFrame()
  const c = document.createElement('canvas')
  c.width = OUTPUT
  c.height = OUTPUT
  drawScene(c.getContext('2d'), OUTPUT, frame, person, t)
  return new Promise((res) => c.toBlob(res, 'image/png'))
}