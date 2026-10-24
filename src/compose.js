// ---- Layout config (fractions of the round frame) ----
// The person (background already removed) is placed in this left area,
// centered horizontally and standing at the bottom of the circle.
export const AREA = {
  x0: 0.04,   // left limit
  x1: 0.52,   // right limit (badge starts after this)
  maxH: 0.93, // max height of the person
}

const OUTPUT = 1080

export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

// Crop the user's selection (natural pixels) -> PNG blob (max 1024px for speed)
export async function cropToBlob(img, px) {
  const MAX = 1024
  const scale = Math.min(1, MAX / Math.max(px.width, px.height))
  const c = document.createElement('canvas')
  c.width = Math.round(px.width * scale)
  c.height = Math.round(px.height * scale)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, px.x, px.y, px.width, px.height, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob(res, 'image/png'))
}

// Trim transparent borders so the person fills the area properly
function trim(img) {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
  let minX = width, minY = height, maxX = 0, maxY = 0
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
  if (maxX <= minX || maxY <= minY) return { src: c, w: width, h: height }
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const t = document.createElement('canvas')
  t.width = w
  t.height = h
  t.getContext('2d').drawImage(c, minX, minY, w, h, 0, 0, w, h)
  return { src: t, w, h }
}

export async function composeFrame(personUrl, frameSrc = '/frame.png') {
  const [frame, person] = await Promise.all([loadImage(frameSrc), loadImage(personUrl)])
  const { src, w, h } = trim(person)

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT
  canvas.height = OUTPUT
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'

  // clip to circle
  ctx.beginPath()
  ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
  ctx.clip()

  // frame
  ctx.drawImage(frame, 0, 0, OUTPUT, OUTPUT)

  // person: fit inside the left area, bottom aligned
  const areaW = (AREA.x1 - AREA.x0) * OUTPUT
  const areaH = AREA.maxH * OUTPUT
  const s = Math.min(areaW / w, areaH / h)
  const dw = w * s
  const dh = h * s
  const dx = AREA.x0 * OUTPUT + (areaW - dw) / 2
  const dy = OUTPUT - dh
  ctx.drawImage(src, dx, dy, dw, dh)

  return canvas.toDataURL('image/png')
}
