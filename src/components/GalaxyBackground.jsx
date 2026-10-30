import { useEffect, useRef } from 'react'
import styles from './GalaxyBackground.module.scss'

const STAR_COUNT_DENSITY = 0.00012 // stars per pixel of canvas area
const MAX_DEPTH = 3

export default function GalaxyBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let stars = []
    let hue = 0

    const makeStar = () => ({
      x: (Math.random() - 0.5) * canvas.width,
      y: (Math.random() - 0.5) * canvas.height,
      z: Math.random() * MAX_DEPTH,
    })

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const count = Math.floor(canvas.width * canvas.height * STAR_COUNT_DENSITY)
      stars = Array.from({ length: count }, makeStar)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const cx = canvas.width / 2
      const cy = canvas.height / 2

      ctx.fillStyle = 'rgba(5, 0, 20, 0.25)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      hue = (hue + 0.1) % 360

      stars.forEach((star) => {
        // drift stars outward from the center, faster as they get closer to the viewer
        star.z -= 0.01
        if (star.z <= 0) {
          Object.assign(star, makeStar(), { z: MAX_DEPTH })
        }

        const scale = MAX_DEPTH / star.z
        const x = cx + star.x * scale
        const y = cy + star.y * scale

        if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return

        const size = Math.max(0.5, (1 - star.z / MAX_DEPTH) * 2.5)
        const brightness = 1 - star.z / MAX_DEPTH

        ctx.beginPath()
        ctx.fillStyle = `hsla(${(hue + star.z * 40) % 360}, 80%, ${60 + brightness * 30}%, ${0.4 + brightness * 0.6})`
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    const interval = setInterval(draw, 33)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
}
