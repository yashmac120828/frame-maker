import { useEffect, useRef, useState } from 'react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { warmUp, removeBg } from './bgClient'
import { prepareUpload, cropToBlob, blobToPerson } from './compose'
import Editor from './Editor'
import LoadingScreen from "./Loadingscreen"

export default function App() {
  const fileRef = useRef(null)
  const imgRef = useRef(null)

  const [imageSrc, setImageSrc] = useState(null)
  const [crop, setCrop] = useState()
  const [done, setDone] = useState(null)
  const [stage, setStage] = useState('idle') // idle | loading | crop | processing | edit
  const [phase, setPhase] = useState('compute')
  const [progress, setProgress] = useState(0)
  const [person, setPerson] = useState(null)
  const [version, setVersion] = useState(0)
  const [notice, setNotice] = useState('')
  const [modelReady, setModelReady] = useState(false)

  // SPEED: download the AI model in the background as soon as the page opens
  useEffect(() => {
    warmUp().then(() => setModelReady(true))
  }, [])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStage('loading')
    try {
      const url = await prepareUpload(file)
      if (imageSrc) URL.revokeObjectURL(imageSrc)
      setImageSrc(url)
      setCrop(undefined)
      setDone(null)
      setStage('crop')
    } catch (err) {
      console.error(err)
      alert('Could not open this photo. Please try another one.')
      setStage(person ? 'edit' : 'idle')
    }
  }

  const onImageLoad = (e) => {
    if (crop) return // keep previous box when re-selecting
    const { width, height } = e.currentTarget
    setCrop({ unit: '%', x: 10, y: 5, width: 80, height: 90 })
    setDone({ unit: 'px', x: width * 0.1, y: height * 0.05, width: width * 0.8, height: height * 0.9 })
  }

  const generate = async () => {
    const img = imgRef.current
    if (!img || !done?.width || !done?.height) return
    setStage('processing')
    setPhase('compute')
    setProgress(0)
    setNotice('')

    const sx = img.naturalWidth / img.width
    const sy = img.naturalHeight / img.height
    const px = { x: done.x * sx, y: done.y * sy, width: done.width * sx, height: done.height * sy }

    try {
      const croppedBlob = await cropToBlob(img, px)
      let personBlob = croppedBlob
      try {
        personBlob = await removeBg(croppedBlob, (key, current, total) => {
          if (String(key).startsWith('fetch')) {
            setPhase('fetch')
            if (total) setProgress(Math.round((current / total) * 100))
          } else setPhase('compute')
        })
      } catch (err) {
        console.error(err)
        setNotice('Background could not be removed, so your photo was used as it is.')
      }
      setPerson(await blobToPerson(personBlob))
      setVersion((v) => v + 1)
      setStage('edit')
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again.')
      setStage('crop')
    }
  }

  const cancelCrop = () => setStage(person ? 'edit' : 'idle')

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
          <p className="text-xs text-amber-700 text-center">
            Your photo stays on your phone. Nothing is uploaded.
          </p>
        </div>
      )}

      {stage === 'loading' && <LoadingScreen title="Opening your photo…" />}

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
                style={{ maxHeight: '65vh', maxWidth: '100%' }}
              />
            </ReactCrop>
          </div>
          {!modelReady && (
            <p className="text-xs text-amber-700 text-center">Getting the AI ready in the background…</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={cancelCrop}
              className="flex-1 rounded-full border border-red-800 py-3 text-red-800 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={generate}
              className="flex-1 rounded-full bg-red-800 py-3 text-white font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {stage === 'processing' && (
        <LoadingScreen
          title={phase === 'fetch' ? 'Downloading AI (first time only)…' : 'Removing background…'}
          progress={phase === 'fetch' ? progress : null}
        />
      )}

      {/* Editor stays mounted so edits are not lost when re-selecting the area */}
      {person && (
        <div className={stage === 'edit' ? 'w-full flex justify-center' : 'hidden'}>
          <Editor
            key={version}
            initialPerson={person}
            notice={notice}
            onChangePhoto={() => fileRef.current.click()}
            onRecrop={() => setStage('crop')}
          />
        </div>
      )}
    </div>
  )
}