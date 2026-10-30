import { BACKGROUNDS, useBackground } from '../context/BackgroundContext.jsx'
import MatrixBackground from './MatrixBackground.jsx'
import GalaxyBackground from './GalaxyBackground.jsx'

export default function Background() {
  const { background } = useBackground()

  if (background === BACKGROUNDS.GALAXY) return <GalaxyBackground />
  return <MatrixBackground />
}
