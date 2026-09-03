import { useRef, useState, type MouseEvent } from 'react'

interface ImageZoomProps {
  src: string
  alt: string
  zoomScale?: number
  className?: string
  imgClassName?: string
}

/**
 * Image with hover-zoom (e-commerce PDP pattern).
 * The image is rendered at 1x and a magnified copy is positioned over it,
 * anchored to the cursor location. Movement updates the offset so the
 * "point under the cursor" stays under the cursor at the zoomed scale.
 */
export default function ImageZoom({
  src,
  alt,
  zoomScale = 2,
  className = '',
  imgClassName = '',
}: ImageZoomProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isZooming, setIsZooming] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 })

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    // Position as a percentage of the container, clamped to [0, 100].
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    setPosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    })
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={alt}
      onMouseEnter={() => setIsZooming(true)}
      onMouseLeave={() => setIsZooming(false)}
      onMouseMove={handleMouseMove}
      className={`relative cursor-zoom-in overflow-hidden bg-white ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          isZooming ? 'opacity-0' : 'opacity-100'
        } ${imgClassName}`}
        draggable={false}
      />
      {isZooming && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${src})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${zoomScale * 100}% ${zoomScale * 100}%`,
            backgroundPosition: `${position.x}% ${position.y}%`,
          }}
        />
      )}
    </div>
  )
}
