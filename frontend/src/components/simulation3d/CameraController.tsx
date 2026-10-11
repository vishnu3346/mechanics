import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMERA_PRESETS, type CameraPreset } from './types'

interface CameraControllerProps {
  preset: CameraPreset
  controlsRef: React.RefObject<any>
}

export function CameraController({ preset, controlsRef }: CameraControllerProps) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3(...CAMERA_PRESETS[preset].position))
  const targetLook = useRef(new THREE.Vector3(...CAMERA_PRESETS[preset].target))
  const isTransitioning = useRef(false)
  const prevPreset = useRef(preset)

  // Update target coordinates when preset changes
  useEffect(() => {
    const config = CAMERA_PRESETS[preset]
    targetPos.current.set(...config.position)
    targetLook.current.set(...config.target)
    isTransitioning.current = true
    prevPreset.current = preset
  }, [preset])

  useFrame((_, delta) => {
    if (!isTransitioning.current) return

    // Smooth exponential approach (lambda = 5.5)
    const factor = 1 - Math.exp(-delta * 5.5)

    camera.position.lerp(targetPos.current, factor)

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, factor)
      controlsRef.current.update()
    }

    // Check completion distance
    const distPos = camera.position.distanceTo(targetPos.current)
    const distLook = controlsRef.current
      ? controlsRef.current.target.distanceTo(targetLook.current)
      : 0

    if (distPos < 0.05 && distLook < 0.05) {
      camera.position.copy(targetPos.current)
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetLook.current)
        controlsRef.current.update()
      }
      isTransitioning.current = false
    }
  })

  return null
}
