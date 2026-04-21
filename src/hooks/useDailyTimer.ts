import { useEffect, useState } from 'react'

export const useDailyTimer = (active: boolean) => {
  const calculateTimeLeft = () => {
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const diff = tomorrow.getTime() - now.getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft)

  useEffect(() => {
    if (!active) return
    const updateTimer = () => {
      setTimeLeft(calculateTimeLeft())
    }
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [active])

  return timeLeft
}
