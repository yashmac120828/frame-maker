// Runs the AI background removal OFF the main thread, so the page never freezes.
import { removeBackground, preload } from '@imgly/background-removal'

let config = null

const post = (msg) => self.postMessage(msg)
const progress = (key, current, total) => post({ type: 'progress', key, current, total })

// Use the phone's GPU when it is available, otherwise the CPU.
// GPU -> 'isnet_fp16' (works best on GPU), CPU -> 'isnet_quint8' (small + fast on CPU)
async function pickConfig(forceCpu) {
  let gpu = false
  if (!forceCpu && self.navigator && self.navigator.gpu) {
    try {
      gpu = !!(await self.navigator.gpu.requestAdapter())
    } catch {
      gpu = false
    }
  }
  return gpu
    ? { device: 'gpu', model: 'isnet_fp16' }
    : { device: 'cpu', model: 'isnet_quint8' }
}

self.onmessage = async (e) => {
  const m = e.data

  if (m.type === 'init') {
    let device = 'cpu'
    try {
      const picked = await pickConfig(m.forceCpu)
      device = picked.device
      config = { ...picked, output: { format: 'image/png' } }
      await preload({ ...config, progress })
      post({ type: 'ready', device })
    } catch (err) {
      post({ type: 'initError', device, message: String((err && err.message) || err) })
    }
    return
  }

  if (m.type === 'remove') {
    try {
      const blob = await removeBackground(m.blob, { ...config, progress })
      post({ type: 'done', id: m.id, blob })
    } catch (err) {
      post({ type: 'error', id: m.id, message: String((err && err.message) || err) })
    }
  }
}