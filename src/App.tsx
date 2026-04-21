import React, { lazy, useState } from 'react'

import { Toast } from './components/Toast'
import { WarmableView } from './components/WarmableView'
import { ViewType } from './domain/types'
import { MainMenu } from './features/menu/MainMenu'
import { useToast } from './hooks/useToast'

const PuzzleView = lazy(() => import('./features/puzzle/PuzzleView').then(m => ({ default: m.PuzzleView })))
const DailyView = lazy(() => import('./features/daily/DailyView').then(m => ({ default: m.DailyView })))

const LoadingSpinner = () => (
  <div className='
    fixed inset-0 z-50 flex items-center justify-center bg-slate-900
  '
  >
    <div className='
      size-16 animate-spin rounded-full border-4 border-blue-500/20
      border-t-blue-500
    '
    />
  </div>
)

export default function App() {
  const [view, setView] = useState<ViewType>('menu')
  const [warmedViews, setWarmedViews] = useState<Set<ViewType>>(() => new Set())
  const { toast, showToast } = useToast()

  const handlePreload = (v: ViewType) => {
    if (v === 'main') void import('./features/puzzle/PuzzleView')
    if (v === 'daily') void import('./features/daily/DailyView')

    setWarmedViews(prev => {
      if (prev.has(v)) return prev
      const next = new Set(prev)
      next.add(v)
      return next
    })
  }

  const handleNavigate = (v: ViewType) => {
    handlePreload(v)
    setView(v)
  }

  return (
    <div className='
      min-h-screen overflow-x-hidden bg-slate-900 font-sans antialiased
      selection:bg-blue-500/30
    '
    >
      <Toast message={toast.message} type={toast.type} />

      <div className={view === 'menu' ? 'block' : 'hidden'}>
        <MainMenu onNavigate={handleNavigate} onPreload={handlePreload} />
      </div>

      <WarmableView
        isActive={view === 'main'}
        isWarmed={warmedViews.has('main')}
        fallback={<LoadingSpinner />}
      >
        <PuzzleView onBack={() => setView('menu')} showToast={showToast} />
      </WarmableView>

      <WarmableView
        isActive={view === 'daily'}
        isWarmed={warmedViews.has('daily')}
        fallback={<LoadingSpinner />}
      >
        <DailyView onBack={() => setView('menu')} showToast={showToast} />
      </WarmableView>
    </div>
  )
}
