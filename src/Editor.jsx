import { useEffect, useRef, useState } from 'react'
import ReactCrop from 'react-image-crop'
import {
  getFrame,
  drawScene,
  defaultTransform,
  trimCanvas,
  cloneCanvas,
  renderToBlob,
} from './compose'

const CHECKER = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

const btn = 'rounded-full border border-red-800 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-40'
const btnMain = 'rounded-full bg-red-800 px-4 py-3 text-white font-semibold shadow-lg disabled:opacity-60'

export default function Editor({ initialPerson, notice, onChangePhoto, onRecrop }) {
  const [person, setPerson] = useState(initialPerson)
  const [t, setT] = useState(() => defaultTransform(initialPerson))
  const [history, setHistory] = useState([])
  const [mode, setMode] = useState('move') // move | crop | erase
  const [frame, setFrame] = useState(null)
  const [saving, setSaving] = useState(false)

  const previewRef = useRef(null)
  const tRef = useRef(t)
  tRef.current = t
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  // crop-mode state
  const [cropUrl, setCropUrl] = useState(null)
  const [crop, setCrop] = useState()
  const [done, setDone] = useState(null)
  const cropImgRef = useRef(null)

  // erase-mode state
  const eraseRef = useRef(null)
  const [tool, setTool] = useState('erase') // erase | restore
  const [brush, setBrush] = useState(28)
  const drawing = useRef(false)
  const lastPt = useRef(null)

  useEffect(() => {
    getFrame().then(setFrame)
  }, [])

  // ---------- live preview ----------
  useEffect(() => {
    if (!frame || mode !== 'move') return
    const c = previewRef.current
    if (c) drawScene(c.getContext('2d'), c.width, frame, person, t)
  }, [frame, person, t, mode])

  // mouse wheel zoom (desktop)
  useEffect(() => {
    const c = previewRef.current
    if (!c) return
    const onWheel = (e) => {
      e.preventDefault()
      const k = e.deltaY < 0 ? 1.06 : 0.94
      setT((p) => ({ ...p, s: clamp(p.s * k, 0.2, 4) }))
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  }, [mode])

  // ---------- drag + pinch ----------
  const resetGesture = () => {
    const pts = [...pointers.current.values()]
    if (pts.length === 1) gesture.current = { last: { ...pts[0] } }
    else if (pts.length === 2) {
      gesture.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        s0: tRef.current.s,
      }
    } else gesture.current = null
  }
  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    resetGesture()
  }
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const rect = e.currentTarget.getBoundingClientRect()
    const pts = [...pointers.current.values()]
    const g = gesture.current
    if (!g) return
    if (pts.length === 1 && g.last) {
      const dx = (pts[0].x - g.last.x) / rect.width
      const dy = (pts[0].y - g.last.y) / rect.height
      g.last = { ...pts[0] }
      setT((p) => ({ ...p, cx: clamp(p.cx + dx, -0.5, 1.5), cy: clamp(p.cy + dy, -0.5, 1.5) }))
    } else if (pts.length === 2 && g.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      setT((p) => ({ ...p, s: clamp(g.s0 * (d / g.dist), 0.2, 4) }))
    }
  }
  const onUp = (e) => {
    pointers.current.delete(e.pointerId)
    resetGesture()
  }

  // ---------- history ----------
  const pushHistory = () => setHistory((h) => [...h.slice(-9), { person, t }])
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    setPerson(last.person)
    setT(last.t)
  }

  // ---------- crop mode ----------
  const openCrop = () => {
    setCropUrl(person.toDataURL('image/png'))
    setCrop(undefined)
    setDone(null)
    setMode('crop')
  }
  const onCropImgLoad = (e) => {
    const { width, height } = e.currentTarget
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 })
    setDone({ unit: 'px', x: 0, y: 0, width, height })
  }
  const applyCrop = () => {
    const img = cropImgRef.current
    if (!img || !done?.width || !done?.height) return
    const k = person.width / img.width
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(done.width * k))
    c.height = Math.max(1, Math.round(done.height * k))
    c.getContext('2d').drawImage(
      person, done.x * k, done.y * k, done.width * k, done.height * k, 0, 0, c.width, c.height
    )
    const trimmed = trimCanvas(c)
    pushHistory()
    setPerson(trimmed)
    setT(defaultTransform(trimmed))
    setMode('move')
  }

  // ---------- erase / restore mode ----------
  useEffect(() => {
    if (mode !== 'erase') return
    const cv = eraseRef.current
    if (!cv) return
    cv.width = person.width
    cv.height = person.height
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(person, 0, 0)
  }, [mode, person])

  const stamp = (x, y, r) => {
    const cv = eraseRef.current
    const ctx = cv.getContext('2d')
    ctx.save()
    if (tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.clip()
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.drawImage(person, 0, 0)
    }
    ctx.restore()
  }
  const paint = (e) => {
    const cv = eraseRef.current
    const rect = cv.getBoundingClientRect()
    const k = cv.width / rect.width
    const x = (e.clientX - rect.left) * k
    const y = (e.clientY - rect.top) * k
    const r = (brush / 2) * k
    const last = lastPt.current
    if (last) {
      const dist = Math.hypot(x - last.x, y - last.y)
      const steps = Math.max(1, Math.ceil(dist / (r / 2)))
      for (let i = 1; i <= steps; i++) {
        stamp(last.x + ((x - last.x) * i) / steps, last.y + ((y - last.y) * i) / steps, r)
      }
    } else stamp(x, y, r)
    lastPt.current = { x, y }
  }
  const eDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    lastPt.current = null
    paint(e)
  }
  const eMove = (e) => drawing.current && paint(e)
  const eUp = () => {
    drawing.current = false
    lastPt.current = null
  }
  const applyErase = () => {
    pushHistory()
    setPerson(cloneCanvas(eraseRef.current))
    setMode('move')
  }

  // ---------- download ----------
  const download = async () => {
    setSaving(true)
    try {
      const blob = await renderToBlob(person, t)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'my-profile-frame.png'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally {
      setSaving(false)
    }
  }

  // ================= UI =================
  if (mode === 'crop') {
    return (
      <div className="w-full max-w-sm flex flex-col gap-4">
        <p className="text-center text-sm text-amber-900">
          Select the part of your cutout you want to keep
        </p>
        <div className="flex justify-center rounded-xl overflow-hidden" style={CHECKER}>
          <ReactCrop
            crop={crop}
            onChange={(_, pct) => setCrop(pct)}
            onComplete={(px) => setDone(px)}
            minWidth={30}
            minHeight={30}
            keepSelection
          >
            <img
              ref={cropImgRef}
              src={cropUrl}
              alt="Cutout"
              onLoad={onCropImgLoad}
              style={{ maxHeight: '55vh', maxWidth: '100%' }}
            />
          </ReactCrop>
        </div>
        <div className="flex gap-3">
          <button className={`${btn} flex-1`} onClick={() => setMode('move')}>Cancel</button>
          <button className={`${btnMain} flex-1`} onClick={applyCrop}>Apply crop</button>
        </div>
      </div>
    )
  }

  if (mode === 'erase') {
    return (
      <div className="w-full max-w-sm flex flex-col gap-4">
        <p className="text-center text-sm text-amber-900">
          Paint over the parts you want to remove. Use Restore to bring parts back.
        </p>
        <div className="flex justify-center rounded-xl overflow-hidden" style={CHECKER}>
          <canvas
            ref={eraseRef}
            onPointerDown={eDown}
            onPointerMove={eMove}
            onPointerUp={eUp}
            onPointerCancel={eUp}
            style={{
              maxHeight: '55vh',
              maxWidth: '100%',
              width: 'auto',
              height: 'auto',
              touchAction: 'none',
              cursor: 'crosshair',
            }}
          />
        </div>
        <div className="flex gap-2 justify-center">
          <button
            className={`${btn} ${tool === 'erase' ? 'bg-red-800 !text-white' : ''}`}
            onClick={() => setTool('erase')}
          >
            Erase
          </button>
          <button
            className={`${btn} ${tool === 'restore' ? 'bg-red-800 !text-white' : ''}`}
            onClick={() => setTool('restore')}
          >
            Restore
          </button>
        </div>
        <label className="text-sm text-amber-900">
          Brush size
          <input
            type="range" min={8} max={80} value={brush}
            onChange={(e) => setBrush(Number(e.target.value))}
            className="w-full accent-red-800"
          />
        </label>
        <div className="flex gap-3">
          <button className={`${btn} flex-1`} onClick={() => setMode('move')}>Cancel</button>
          <button className={`${btnMain} flex-1`} onClick={applyErase}>Apply</button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-4">
      <canvas
        ref={previewRef}
        width={720}
        height={720}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="w-80 max-w-full aspect-square rounded-full shadow-xl cursor-grab"
        style={{ touchAction: 'none' }}
      />
      <p className="text-xs text-amber-800 text-center">
        Drag to move · pinch or use the slider to resize
      </p>
      {notice && <p className="text-sm text-red-700 text-center">{notice}</p>}

      <div className="w-full flex flex-col gap-2">
        <label className="text-sm text-amber-900">
          Size
          <input
            type="range" min={0.2} max={3} step={0.01} value={t.s}
            onChange={(e) => setT({ ...t, s: Number(e.target.value) })}
            className="w-full accent-red-800"
          />
        </label>
        <label className="text-sm text-amber-900">
          Tilt
          <input
            type="range" min={-30} max={30} step={0.5} value={t.rot}
            onChange={(e) => setT({ ...t, rot: Number(e.target.value) })}
            className="w-full accent-red-800"
          />
        </label>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button className={btn} onClick={() => setT({ ...t, flip: !t.flip })}>Flip</button>
        <button className={btn} onClick={() => setT(defaultTransform(person))}>Reset position</button>
        <button className={btn} onClick={openCrop}>Crop cutout</button>
        <button className={btn} onClick={() => setMode('erase')}>Erase / Restore</button>
        <button className={btn} onClick={undo} disabled={!history.length}>Undo</button>
      </div>

      <button className={`${btnMain} w-full`} onClick={download} disabled={saving}>
        {saving ? 'Preparing…' : 'Download'}
      </button>
      <div className="flex gap-2 w-full">
        <button className={`${btn} flex-1`} onClick={onRecrop}>Re-select area</button>
        <button className={`${btn} flex-1`} onClick={onChangePhoto}>Change photo</button>
      </div>
    </div>
  )
}