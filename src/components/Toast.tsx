import { AlertCircle, Check } from 'lucide-react'
import React from 'react'

interface ToastProps {
  message: string;
  type: string;
}

export const Toast: React.FC<ToastProps> = ({ message, type }) => {
  if (!message) return null
  return (
    <div className={`
      fixed top-4 left-1/2 z-150 flex -translate-x-1/2 items-center gap-2
      rounded-full px-6 py-3 font-bold whitespace-nowrap shadow-xl
      ${type === 'success'
? 'bg-green-500 text-white'
: 'bg-red-500 text-white'}
    `}
    >
      {type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
      {message}
    </div>
  )
}
