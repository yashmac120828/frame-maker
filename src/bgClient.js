// Talks to bgWorker.js. Falls back safely if the worker / GPU does not work.

let worker = null
let ready = null
let device = null
let cpuForced = false
let nextId = 1
let initHandlers = null
let activeProgress = null
const pending = new Map()

const noGpuFlag = () => {
  try {
    return (
      localStorage.getItem('noGpu') === '1' ||
      new URLSearchParams(location.search).has('cpu') // open the site with ?cpu to force CPU
    )
  } catch {
    return false
  }
}
const setNoGpu = () => {
  try {
    localStorage.setItem('noGpu', '1')
  } catch {
    /* ignore */
  }
}

function stop() {
  if (worker) worker.terminate()
  worker = null
  ready = null
  device = null
  for (const p of pending.values()) p.reject(new Error('worker stopped'))
  pending.clear()
}

function start(forceCpu) {
  cpuForced = forceCpu
  worker = new Worker(new URL('./bgWorker.js', import.meta.url), { type: 'module' })
  ready = new Promise((resolve, reject) => {
    initHandlers = { resolve, reject }
  })
  ready.catch(() => {}) // avoid "unhandled rejection" noise

  worker.onmessage = (e) => {
    const m = e.data
    if (m.type === 'ready') {
      device = m.device
      initHandlers?.resolve()
    } else if (m.type === 'initError') {
      initHandlers?.reject(Object.assign(new Error(m.message), { device: m.device }))
    } else if (m.type === 'progress') {
      activeProgress?.(m.key, m.current, m.total)
    } else if (m.type === 'done') {
      pending.get(m.id)?.resolve(m.blob)
      pending.delete(m.id)
    } else if (m.type === 'error') {
      pending.get(m.id)?.reject(new Error(m.message))
      pending.delete(m.id)
    }
  }
  worker.onerror = (e) => {
    const err = new Error(e.message || 'worker crashed')
    initHandlers?.reject(err)
    for (const p of pending.values()) p.reject(err)
    pending.clear()
  }
  worker.postMessage({ type: 'init', forceCpu })
}

async function ensureReady() {
  if (!worker) start(noGpuFlag())
  try {
    await ready
  } catch (err) {
    // GPU mode failed to start -> remember it and retry with CPU
    if (!cpuForced && err.device === 'gpu') {
      setNoGpu()
      stop()
      start(true)
      await ready
    } else throw err
  }
}

const run = (blob) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    worker.postMessage({ type: 'remove', id, blob })
  })

// Call when the page opens: starts loading the AI in the background
export async function warmUp() {
  try {
    await ensureReady()
  } catch (err) {
    console.warn('AI warm-up failed:', err)
  }
}

// Removes the background. onProgress(key, current, total) is optional.
export async function removeBg(blob, onProgress) {
  activeProgress = onProgress || null
  try {
    await ensureReady()
    try {
      return await run(blob)
    } catch (err) {
      if (device === 'gpu') {
        // GPU failed while working -> retry once on CPU
        setNoGpu()
        stop()
        start(true)
        await ready
        return await run(blob)
      }
      throw err
    }
  } catch (err) {
    // last resort: the old way (main thread), slower but works almost everywhere
    console.warn('Worker failed, using main thread:', err)
    stop()
    const { removeBackground } = await import('@imgly/background-removal')
    return await removeBackground(blob, {
      model: 'isnet_quint8',
      output: { format: 'image/png' },
      progress: onProgress,
    })
  } finally {
    activeProgress = null
  }
}