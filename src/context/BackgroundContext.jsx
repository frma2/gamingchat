import { createContext, useContext, useEffect, useState } from 'react'

const BackgroundContext = createContext(null)

export const BACKGROUNDS = {
  MATRIX: 'matrix',
  GALAXY: 'galaxy',
}

function loadStoredBackground() {
  const stored = localStorage.getItem('background')
  return Object.values(BACKGROUNDS).includes(stored) ? stored : BACKGROUNDS.MATRIX
}

export function BackgroundProvider({ children }) {
  const [background, setBackground] = useState(loadStoredBackground)

  useEffect(() => {
    localStorage.setItem('background', background)
  }, [background])

  return (
    <BackgroundContext.Provider value={{ background, setBackground }}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackground() {
  const ctx = useContext(BackgroundContext)
  if (!ctx) throw new Error('useBackground must be used within a BackgroundProvider')
  return ctx
}
