import { AlertCircle, Calendar, Play } from 'lucide-react'
import React from 'react'

import { useRouter } from '@/hooks/useRouter'

export const MainMenu: React.FC = () => {
  const { navigate, preload } = useRouter()
  return (
    <div className='
      flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4
      text-white
    '
    >
      <div className='max-w-2xl text-center'>
        <h1 className='
          mb-6 bg-linear-to-r from-blue-400 to-emerald-400 bg-clip-text text-5xl
          font-extrabold tracking-tight text-transparent
          md:text-7xl
        '
        >
          Equate.
        </h1>
        <p className='mb-12 text-xl text-slate-300'>The mathematical Scrabble challenge.</p>

        <div className='mx-auto flex w-full max-w-md flex-col gap-4'>
          <button
            onClick={() => { void navigate('main') }}
            onPointerEnter={() => { void preload('main') }}
            onPointerDown={() => { void preload('main') }}
            className='
              flex w-full items-center justify-center gap-3 rounded-xl
              bg-blue-600 py-4 text-xl font-bold shadow-lg transition-all
              hover:bg-blue-500 hover:shadow-blue-500/50
            '
          >
            <Play size={24} /> Main Puzzles
          </button>
          <button
            onClick={() => { void navigate('daily') }}
            onPointerEnter={() => { void preload('daily') }}
            onPointerDown={() => { void preload('daily') }}
            className='
              flex w-full items-center justify-center gap-3 rounded-xl
              bg-emerald-600 py-4 text-xl font-bold shadow-lg transition-all
              hover:bg-emerald-500 hover:shadow-emerald-500/50
            '
          >
            <Calendar size={24} /> Daily Free Play
          </button>
        </div>

        <div className='
          mt-12 rounded-xl bg-slate-800 p-6 text-left shadow-inner
        '
        >
          <h3 className='mb-2 flex items-center gap-2 text-lg font-bold'>
            <AlertCircle className='text-blue-400' /> Core Rules
          </h3>
          <ul className='list-disc space-y-2 pl-5 text-slate-300'>
            <li>Form multi-digit numbers and chain comparators (<span className='font-bold text-blue-400'>&gt;=, &lt;, &gt;, &lt;&gt;</span>).</li>
            <li>Make <span className='font-bold text-blue-400'>&lt;&gt;</span> (not equal) by placing <span className='font-bold text-blue-400'>&gt;&lt;</span> and <span className='font-bold text-blue-400'>&gt;</span> adjacent to each other.</li>
            <li>At least one side of any comparison must contain a mathematical operation (<span className='font-bold text-orange-400'>+, −, ×, ÷</span>).</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
