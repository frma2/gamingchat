import { useEffect, useRef } from 'react'
import styles from './MatrixBackground.module.scss'

const CHARACTERS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ'
const FONT_SIZE = 16
const FRAME_MS = 50

export default function MatrixBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let drops = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const columns = Math.floor(canvas.width / FONT_SIZE)
      // each drop tracks the current row (in font-size units) of its column
      drops = Array.from({ length: columns }, () => Math.random() * (canvas.height / FONT_SIZE))
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#2fff6b'
      ctx.font = `${FONT_SIZE}px monospace`

      drops.forEach((row, i) => {
        const char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
        ctx.fillText(char, i * FONT_SIZE, row * FONT_SIZE)

        // randomly reset a drop back to the top once it's off-screen, for a staggered loop
        if (row * FONT_SIZE > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        } else {
          drops[i] = row + 1
        }
      })
    }

    const interval = setInterval(draw, FRAME_MS)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
}
