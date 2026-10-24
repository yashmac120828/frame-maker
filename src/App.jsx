import { useRef, useState } from 'react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { removeBackground } from '@imgly/background-removal'
import { composeFrame, cropToBlob } from './compose'

export default function App() {
  const fileRef = useRef(null)
  const imgRef = useRef(null)

  const [imageSrc, setImageSrc] = useState(null)
  const [crop, setCrop] = useState()
  const [done, setDone] = useState(null) // pixel crop (display px)
  const [stage, setStage] = useState('idle') // idle | crop | processing | result
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [notice, setNotice] = useState('')

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result)
      setCrop(undefined)
      setDone(null)
      setResult(null)
      setNotice('')
      setStage('crop')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // free-form default box (user can resize / move it freely)
  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget
    const c = { unit: '%', x: 10, y: 5, width: 80, height: 90 }
    setCrop(c)
    setDone({
      unit: 'px',
      x: width * 0.1,
      y: height * 0.05,
      width: width * 0.8,
      height: height * 0.9,
    })
  }

  const generate = async () => {
    const img = imgRef.current
    if (!img || !done?.width || !done?.height) return
    setStage('processing')
    setProgress(0)
    setNotice('')

    // convert displayed crop -> natural image pixels
    const sx = img.naturalWidth / img.width
    const sy = img.naturalHeight / img.height
    const px = {
      x: done.x * sx,
      y: done.y * sy,
      width: done.width * sx,
      height: done.height * sy,
    }

    const croppedBlob = await cropToBlob(img, px)
    let personBlob = croppedBlob
    try {
      personBlob = await removeBackground(croppedBlob, {
        output: { format: 'image/png' },
        progress: (_key, current, total) => {
          if (total) setProgress(Math.round((current / total) * 100))
        },
      })
    } catch (err) {
      console.error(err)
      setNotice('Background could not be removed, so your photo was used as it is.')
    }

    const url = URL.createObjectURL(personBlob)
    setResult(await composeFrame(url))
    URL.revokeObjectURL(url)
    setStage('result')
  }

  const download = () => {
    const a = document.createElement('a')
    a.href = result
    a.download = 'my-profile-frame.png'
    a.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-yellow-100 flex flex-col items-center px-4 py-6">
      <h1 className="text-xl font-bold text-red-900 text-center">
        षष्ठी पूर्ति – विश्व कल्याण महोत्सव
      </h1>
      <p className="text-sm text-amber-800 mb-5 text-center">Create your profile photo</p>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      {stage === 'idle' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-5">
          <img src="/frame.png" alt="Frame preview" className="w-72 h-72 rounded-full shadow-xl" />
          <button
            onClick={() => fileRef.current.click()}
            className="w-full rounded-full bg-red-800 py-3 text-white font-semibold shadow-lg active:scale-95 transition"
          >
            Upload your photo
          </button>
        </div>
      )}

      {stage === 'crop' && imageSrc && (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <p className="text-center text-sm text-amber-900">
            Drag the corners to select yourself (head to shoulders works best)
          </p>
          <div className="flex justify-center bg-black rounded-xl overflow-hidden">
            <ReactCrop
              crop={crop}
              onChange={(_, pct) => setCrop(pct)}
              onComplete={(px) => setDone(px)}
              minWidth={40}
              minHeight={40}
              keepSelection
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Upload"
                onLoad={onImageLoad}
                style={{ maxHeight: '65vh' }}
              />
            </ReactCrop>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStage('idle')}
              className="flex-1 rounded-full border border-red-800 py-3 text-red-800 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={generate}
              className="flex-1 rounded-full bg-red-800 py-3 text-white font-semibold"
            >
              Upload
            </button>
          </div>
        </div>
      )}

      {stage === 'processing' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-4 mt-10">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-800 border-t-transparent" />
          <p className="text-amber-900 font-medium">Removing background…</p>
          <div className="w-full h-2 rounded-full bg-amber-200 overflow-hidden">
            <div className="h-full bg-red-800 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-amber-700 text-center">
            First time may take a little longer while the AI model loads.
          </p>
        </div>
      )}

      {stage === 'result' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-5">
          <img src={result} alt="Your profile" className="w-80 h-80 rounded-full shadow-xl" />
          {notice && <p className="text-sm text-red-700 text-center">{notice}</p>}
          <button
            onClick={download}
            className="w-full rounded-full bg-red-800 py-3 text-white font-semibold shadow-lg"
          >
            Download
          </button>
          <button
            onClick={() => fileRef.current.click()}
            className="w-full rounded-full border border-red-800 py-3 text-red-800 font-semibold"
          >
            Choose another photo
          </button>
        </div>
      )}
    </div>
  )
}
