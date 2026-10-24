import { useEffect, useState } from 'react'

const QUOTES = [
  { sa: 'सर्वे भवन्तु सुखिनः, सर्वे सन्तु निरामयाः।', en: 'May all be happy, may all be free from illness.' },
  { sa: 'वसुधैव कुटुम्बकम्।', en: 'The whole world is one family.' },
  { sa: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।', en: 'You have the right to your actions, never to their fruits.' },
  { sa: 'सत्यमेव जयते।', en: 'Truth alone triumphs.' },
  { sa: 'असतो मा सद्गमय, तमसो मा ज्योतिर्गमय।', en: 'Lead me from untruth to truth, from darkness to light.' },
  { sa: 'यतो धर्मस्ततो जयः।', en: 'Where there is dharma, there is victory.' },
]

// ---------- main loading screen ----------
export default function LoadingScreen({ title, progress = null }) {
  const [q, setQ] = useState(() => Math.floor(Math.random() * QUOTES.length))

  useEffect(() => {
    const id = setInterval(() => setQ((n) => (n + 1) % QUOTES.length), 5000)
    return () => clearInterval(id)
  }, [])

  const quote = QUOTES[q]

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-5 mt-4">
      {/* glowing diya-style ring around the frame */}
      <div className="relative flex items-center justify-center">
        <span className="absolute h-44 w-44 rounded-full bg-amber-300/50 animate-ping" />
        <div className="relative h-40 w-40 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-yellow-200 to-red-700 animate-spin" style={{ animationDuration: '6s' }}>
          <div className="h-full w-full rounded-full bg-amber-50" />
        </div>
        <img
          src="/frame.png"
          alt=""
          className="absolute h-32 w-32 rounded-full shadow-lg animate-pulse"
        />
      </div>

      <p className="text-amber-900 font-semibold text-center">{title}</p>

      {progress !== null && (
        <div className="w-full h-2 rounded-full bg-amber-200 overflow-hidden">
          <div className="h-full bg-red-800 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* rotating quotes */}
      <div key={q} className="fade-in min-h-[84px] text-center px-2">
        <p className="text-lg font-bold text-red-900 leading-snug">{quote.sa}</p>
        <p className="text-sm text-amber-800 mt-1">{quote.en}</p>
      </div>

    </div>
  )
}