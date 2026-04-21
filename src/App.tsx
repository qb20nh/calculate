import React, { lazy } from 'react'

import { Route, Router } from './components/Router'
import { Toast } from './components/Toast'
import { MainMenu } from './features/menu/MainMenu'
import { useToast } from './hooks/useToast'

const PuzzleView = lazy(() => import('./features/puzzle/PuzzleView').then(m => ({ default: m.PuzzleView })))
const DailyView = lazy(() => import('./features/daily/DailyView').then(m => ({ default: m.DailyView })))

export default function App() {
  const { toast, showToast } = useToast()

  return (
    <div className='
      min-h-screen overflow-x-hidden bg-slate-900 font-sans antialiased
      selection:bg-blue-500/30
    '
    >
      <Toast message={toast.message} type={toast.type} />
      <Router initialView='menu'>
        <Route id='menu'>
          <MainMenu />
        </Route>

        <Route
          id='main'
          isPreloadable
          prefetch={() => import('./features/puzzle/PuzzleView')}
        >
          <PuzzleView
            showToast={showToast}
          />
        </Route>

        <Route
          id='daily'
          isPreloadable
          prefetch={() => import('./features/daily/DailyView')}
        >
          <DailyView
            showToast={showToast}
          />
        </Route>
      </Router>
    </div>
  )
}
