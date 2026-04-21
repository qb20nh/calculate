import React, { useState } from 'react'

import { ViewType } from '../domain/types'
import { RouterContext } from '../hooks/useRouter'
import { LoadingSpinner } from './LoadingSpinner'
import { Preloader } from './Preloader'
import { ProgressBar } from './ProgressBar'

interface RouteProps {
  id: ViewType;
  prefetch?: () => Promise<unknown>;
  isPreloadable?: boolean;
  children: React.ReactNode;
}

/**
 * Route Component (Declarative)
 *
 * Defines a route configuration. This component does not render directly;
 * its props are consumed by the parent <Router>.
 */
export const Route: React.FC<RouteProps> = () => null

interface RouterProps {
  children: React.ReactNode;
  initialView: ViewType;
}

/**
 * Router Component (Generic Container)
 *
 * Manages navigation state and orchestrates prefetching and loading animations
 * in a declarative way.
 */
export const Router: React.FC<RouterProps> = ({ children, initialView }) => {
  const [view, setView] = useState<ViewType>(initialView)
  const [isGlobalLoading, setIsGlobalLoading] = useState(false)
  const [preloadedViews, setPreloadedViews] = useState<Set<ViewType>>(() => new Set())

  // Extract route configurations from children
  const routes = React.Children.toArray(children)
    .map(child => {
      if (React.isValidElement(child) && child.type === Route) {
        return child.props as RouteProps
      }
      return null
    })
    .filter((route): route is RouteProps => route !== null)

  const preload = async (v: ViewType) => {
    const route = routes.find(r => r.id === v)
    if (!route) return

    setPreloadedViews(prev => {
      if (prev.has(v)) return prev
      const next = new Set(prev)
      next.add(v)
      return next
    })

    if (route.prefetch) {
      await route.prefetch()
    }
  }

  const navigate = async (v: ViewType) => {
    if (v === view) return

    setIsGlobalLoading(true)
    try {
      await preload(v)
      setView(v)
    } finally {
      setIsGlobalLoading(false)
    }
  }

  return (
    <RouterContext.Provider value={{
      view,
      navigate,
      preload
    }}
    >
      <ProgressBar isLoading={isGlobalLoading} />
      <LoadingSpinner isVisible={isGlobalLoading} />

      {routes.map(route => {
        if (route.isPreloadable) {
          return (
            <Preloader
              key={route.id}
              isActive={view === route.id}
              isPreloaded={preloadedViews.has(route.id)}
              fallback={<LoadingSpinner />}
            >
              {route.children}
            </Preloader>
          )
        }

        return view === route.id
          ? (
            <div key={route.id} className='block'>
              {route.children}
            </div>
            )
          : null
      })}
    </RouterContext.Provider>
  )
}
