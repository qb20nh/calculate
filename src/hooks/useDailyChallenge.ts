import { useCallback, useEffect, useState } from 'react'

import { DAILY_POOL } from '@/constants/gameData'
import { getNormalizedRelations, isValidEquation } from '@/domain/engine'
import { reorder } from '@/domain/reorder'
import { DragItem, HoverTarget, TileItem } from '@/domain/types'
import { StorageService } from '@/services/StorageService'

export const useDailyChallenge = (
  showToast: (msg: string, type?: string) => void
) => {
  const [date] = useState(() => new Date().toISOString().split('T')[0])

  const getInitialState = useCallback((d: string) => {
    const saved = StorageService.getDailySave(d)
    if (saved) {
      return {
        pool: saved.dailyPool,
        current: saved.dailyCurrent,
        submitted: saved.dailySubmitted,
        knownRelations: new Set<string>(saved.dailyKnownRelations || [])
      }
    }
    return {
      pool: DAILY_POOL.map((char, i) => ({
        id: `d-${i}`,
        char
      })),
      current: [],
      submitted: [],
      knownRelations: new Set<string>()
    }
  }, [])

  const [dailyPool, setDailyPool] = useState<TileItem[]>(
    () => getInitialState(date).pool
  )
  const [dailyCurrent, setDailyCurrent] = useState<TileItem[]>(
    () => getInitialState(date).current
  )
  const [dailySubmitted, setDailySubmitted] = useState<string[]>(
    () => getInitialState(date).submitted
  )
  const [dailyKnownRelations, setDailyKnownRelations] = useState<Set<string>>(
    () => getInitialState(date).knownRelations
  )

  const submitStatement = useCallback(() => {
    if (dailyCurrent.length === 0) return
    const statement = dailyCurrent.map((t) => t.char).join('')
    const result = isValidEquation(statement)

    if (!result.valid) {
      showToast(result.reason || 'Invalid equation', 'error')
      return
    }

    const currentRelations = getNormalizedRelations(statement)
    const isNew = currentRelations.some((rel) => !dailyKnownRelations.has(rel))

    if (!isNew) {
      showToast('Mathematically redundant statement.', 'error')
      return
    }

    const newKnown = new Set(dailyKnownRelations)
    currentRelations.forEach((rel) => newKnown.add(rel))

    setDailyKnownRelations(newKnown)
    setDailySubmitted((prev) => [statement, ...prev])
    setDailyPool((prev) => [...prev, ...dailyCurrent])
    setDailyCurrent([])
    showToast('New discovery!', 'success')
  }, [dailyCurrent, dailyKnownRelations, showToast])

  const handleDrop = useCallback(
    (dragItem: DragItem, dropTarget: HoverTarget | null) => {
      if (!dropTarget) return

      if (dragItem.source === 'pool' && dropTarget.type === 'builder') {
        const newPool = [...dailyPool]
        const poolIdx = newPool.findIndex((t) => t.char === dragItem.char)
        const [movedTile] = newPool.splice(poolIdx, 1)

        const newCurrent = [...dailyCurrent]
        if (dropTarget.index === undefined) {
          newCurrent.push(movedTile)
        } else {
          newCurrent.splice(dropTarget.index, 0, movedTile)
        }
        setDailyPool(newPool)
        setDailyCurrent(newCurrent)
      } else if (
        dragItem.source === 'builder' &&
        dropTarget.type === 'builder' &&
        dragItem.index !== undefined
      ) {
        if (dragItem.index === dropTarget.index) return
        setDailyCurrent((prev) =>
          reorder(prev, dragItem.index!, dropTarget.index ?? prev.length)
        )
      } else if (
        dragItem.source === 'builder' &&
        dropTarget.type === 'pool' &&
        dragItem.index !== undefined
      ) {
        const newCurrent = [...dailyCurrent]
        const [movedTile] = newCurrent.splice(dragItem.index, 1)
        setDailyCurrent(newCurrent)
        setDailyPool((prev) => [...prev, movedTile])
      }
    },
    [dailyPool, dailyCurrent]
  )

  const handleQuickClick = useCallback(
    (item: DragItem) => {
      if (item.source === 'pool') {
        handleDrop(item, {
          type: 'builder',
          index: dailyCurrent.length
        })
      } else if (item.source === 'builder') {
        handleDrop(item, { type: 'pool' })
      }
    },
    [dailyCurrent.length, handleDrop]
  )

  const clearBuilder = useCallback(() => {
    setDailyPool((prev) => [...prev, ...dailyCurrent])
    setDailyCurrent([])
  }, [dailyCurrent])

  // Lifecycle
  // Persist to storage
  useEffect(() => {
    StorageService.setDailySave(date, {
      dailyPool,
      dailyCurrent,
      dailySubmitted,
      dailyKnownRelations: Array.from(dailyKnownRelations)
    })
  }, [dailyPool, dailyCurrent, dailySubmitted, dailyKnownRelations, date])

  return {
    dailyPool,
    dailyCurrent,
    dailySubmitted,
    submitStatement,
    handleDrop,
    handleQuickClick,
    clearBuilder
  }
}
