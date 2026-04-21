import { createContext, useContext } from 'react'

import { ViewType } from '../domain/types'

interface RouterContextType {
  view: ViewType;
  navigate: (v: ViewType) => Promise<void>;
  preload: (v: ViewType) => Promise<void>;
}

export const RouterContext = createContext<RouterContextType | undefined>(undefined)

/**
 * useRouter Hook
 *
 * Provides access to the current navigation state and functions.
 */
export const useRouter = () => {
  const context = useContext(RouterContext)
  if (!context) {
    throw new Error('useRouter must be used within a Router')
  }
  return context
}
