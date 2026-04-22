import React, { Suspense, useRef, useState, useTransition } from 'react'

import { ViewType } from '../domain/types'
import { RouterContext } from '../hooks/useRouter'
import { LoadingSpinner } from './LoadingSpinner'
import { ProgressBar } from './ProgressBar'

interface RouteProps {
  id: ViewType
  children: React.ReactNode
  prefetch?: () => Promise<unknown>
}

/**
 * Route Component
 * Declarative definition of a route. Does not render content itself.
 */
export const Route: React.FC<RouteProps> = () => null

interface RouterProps {
  initialView?: ViewType
  children: React.ReactNode
}

/**
 * Router Component
 * Manages view state and handles declarative routing.
 * Uses useTransition to ensure seamless view handovers without empty screen gaps.
 */
export const Router: React.FC<RouterProps> = ({
  initialView = 'menu',
  children
}) => {
  const [view, setView] = useState<ViewType>(initialView)
  const [isGlobalLoading, setIsGlobalLoading] = useState(false)
  const [, startTransition] = useTransition()
  const loadedRoutes = useRef<Set<ViewType>>(new Set())

  // Extract route configurations from children.
  const routes = React.Children.toArray(children)
    .map((child) => {
      if (React.isValidElement<RouteProps>(child)) {
        return {
          id: child.props.id,
          children: child.props.children,
          prefetch: child.props.prefetch
        }
      }
      return null
    })
    .filter((route): route is RouteProps => route?.id)

  const preload = async (v: ViewType) => {
    const route = routes.find((r) => r.id === v)
    if (!route) return

    if (route.prefetch) {
      await route.prefetch()
      loadedRoutes.current.add(v)
    }
  }

  const navigate = async (v: ViewType) => {
    if (v === view) return

    const route = routes.find((r) => r.id === v)
    const isAlreadyLoaded = loadedRoutes.current.has(v) || !route?.prefetch

    if (isAlreadyLoaded) {
      startTransition(() => {
        setView(v)
      })
      return
    }

    setIsGlobalLoading(true)
    try {
      await preload(v)
      // Use startTransition to coordinate the view change with the end of loading.
      // This keeps the OLD view visible until the NEW view is fully ready to paint,
      // eliminating the brief empty screen gap.
      startTransition(() => {
        setView(v)
        setIsGlobalLoading(false)
      })
    } catch (error) {
      console.error('Failed to navigate:', error)
      setIsGlobalLoading(false)
    }
  }

  return (
    <RouterContext.Provider
      value={{
        view,
        navigate,
        preload
      }}
    >
      {/*
        Route definitions render null.
        Any non-Route children (like a persistent Navbar) would render normally.
      */}
      {children}

      {/* Render active route content inside a Suspense boundary */}
      <Suspense fallback={null}>
        {routes.map((route) => {
          if (view !== route.id) return null
          return (
            <div key={route.id} className='block'>
              {route.children}
            </div>
          )
        })}
      </Suspense>

      <ProgressBar isLoading={isGlobalLoading} />
      <LoadingSpinner isVisible={isGlobalLoading} />
    </RouterContext.Provider>
  )
}
