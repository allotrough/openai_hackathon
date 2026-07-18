import { ContactShadows, Grid, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group, Mesh } from 'three'
import { Color, ExtrudeGeometry, MathUtils, Quaternion, Shape, Vector3 } from 'three'
import type { VehicleSpec, ViewMode } from '../types'
import {
  buildAeroFlowPlan,
  type AeroFlowFamily,
  type AeroPressureZone,
  type AeroStreamline,
  type AeroWakeZone,
} from '../lib/aeroFlow'
import { getGeometryProfile, type GeometryProfile } from '../lib/vehicleGeometry'

type ViewportProps = {
  spec: VehicleSpec
  viewMode: ViewMode
  exploded: boolean
  airflow: boolean
  resetToken: number
}

type PartProps = {
  target: [number, number, number]
  children: React.ReactNode
}

function AnimatedPart({ target, children }: PartProps) {
  const ref = useRef<Group>(null)
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.position.x = MathUtils.damp(ref.current.position.x, target[0], 6, delta)
    ref.current.position.y = MathUtils.damp(ref.current.position.y, target[1], 6, delta)
    ref.current.position.z = MathUtils.damp(ref.current.position.z, target[2], 6, delta)
  })
  return <group ref={ref}>{children}</group>
}

function BodyMaterial({ color, mode, opacity = 1 }: { color: string; mode: ViewMode; opacity?: number }) {
  if (mode === 'blueprint') {
    return <meshBasicMaterial color="#54cfff" wireframe transparent opacity={0.9 * opacity} />
  }
  if (mode === 'structural') {
    return <meshStandardMaterial color="#17212a" wireframe transparent opacity={0.24 * opacity} />
  }
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={mode === 'wireframe' ? 0.15 : mode === 'studio' ? 0.84 : 0.72}
      roughness={mode === 'wireframe' ? 0.42 : mode === 'studio' ? 0.18 : 0.25}
      clearcoat={mode === 'studio' ? 1 : 0.75}
      clearcoatRoughness={mode === 'studio' ? 0.12 : 0.24}
      wireframe={mode === 'wireframe'}
      transparent={opacity < 1}
      opacity={opacity}
    />
  )
}

function SilhouetteShell({ profile, color, mode }: { profile: GeometryProfile; color: string; mode: ViewMode }) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    profile.contour.forEach(([relativeX, relativeY], index) => {
      const x = relativeX * profile.bodyLength
      const y = relativeY * profile.bodyHeight
      if (index === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
    shape.closePath()
    const next = new ExtrudeGeometry(shape, {
      depth: profile.bodyWidth,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelThickness: Math.min(0.045, profile.bodyWidth * 0.035),
      bevelSize: Math.min(0.045, profile.bodyWidth * 0.035),
    })
    next.translate(0, 0, -profile.bodyWidth / 2)
    next.computeVertexNormals()
    return next
  }, [profile])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} position={[0, profile.bodyY, 0]} castShadow receiveShadow>
      <BodyMaterial color={color} mode={mode} opacity={mode === 'structural' ? 0.35 : 1} />
    </mesh>
  )
}

function CabinAndDetails({ profile, spec, mode }: { profile: GeometryProfile; spec: VehicleSpec; mode: ViewMode }) {
  const lampDepth = profile.headlampStyle === 'blade' ? 0.035 : 0.08
  const lampWidth = profile.headlampStyle === 'blade' ? 0.22 : profile.headlampStyle === 'round' ? 0.11 : 0.16
  const lampHeight = profile.headlampStyle === 'blade' ? 0.035 : 0.09
  const lampZ = profile.bodyWidth * (profile.headlampStyle === 'blade' ? 0.33 : 0.37)
  const lampX = profile.bodyLength * 0.47
  const lampY = profile.bodyY + profile.bodyHeight * 0.02
  const darkGlass = mode === 'blueprint' ? '#163f51' : '#111923'
  return (
    <>
      <RoundedBox
        args={[profile.cabin.length, profile.cabin.height, profile.cabin.width]}
        radius={0.12}
        smoothness={4}
        position={[profile.cabin.x, profile.bodyY + profile.cabin.y, 0]}
        rotation={[0, 0, profile.cabin.tilt]}
        castShadow
      >
        <meshPhysicalMaterial color={darkGlass} wireframe={mode === 'wireframe' || mode === 'blueprint'} metalness={0.78} roughness={0.12} clearcoat={0.9} transparent opacity={mode === 'structural' ? 0.16 : 0.86} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox args={[lampWidth, lampHeight, lampDepth]} radius={lampDepth / 2} smoothness={3} position={[lampX, lampY, side * lampZ]}>
            <meshStandardMaterial color={mode === 'blueprint' ? '#7de8ff' : '#e8f4ff'} emissive={mode === 'blueprint' ? '#2bc3df' : '#82c6ff'} emissiveIntensity={1.4} wireframe={mode === 'wireframe'} />
          </RoundedBox>
          <RoundedBox args={[profile.bodyLength * 0.13, 0.12, 0.035]} radius={0.02} smoothness={2} position={[profile.bodyLength * 0.04, profile.bodyY - profile.bodyHeight * 0.08, side * (profile.bodyWidth * 0.51)]}>
            <meshStandardMaterial color={mode === 'blueprint' ? '#237d98' : '#111820'} wireframe={mode === 'wireframe' || mode === 'blueprint'} metalness={0.65} roughness={0.35} />
          </RoundedBox>
        </group>
      ))}
      <RoundedBox args={[profile.bodyLength * 0.45, 0.028, 0.04]} radius={0.014} smoothness={2} position={[-profile.bodyLength * 0.47, profile.bodyY + profile.bodyHeight * 0.03, 0]}>
        <meshStandardMaterial color={mode === 'blueprint' ? '#8be9ff' : spec.accentColor} emissive={mode === 'blueprint' ? '#1e9fbc' : spec.accentColor} emissiveIntensity={0.8} wireframe={mode === 'wireframe'} />
      </RoundedBox>
    </>
  )
}

function Wheel({ position, radius, width, mode }: { position: [number, number, number]; radius: number; width: number; mode: ViewMode }) {
  const rimRadius = radius * 0.61
  const faceZ = width * 0.51
  const tireColor = mode === 'blueprint' ? '#173f50' : '#0c0f13'
  const darkMetal = mode === 'blueprint' ? '#234e62' : '#202932'
  return (
    <group position={position} rotation={[0, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, width * 0.94, 28]} />
        <meshStandardMaterial color={tireColor} wireframe={mode === 'wireframe' || mode === 'blueprint'} metalness={0.08} roughness={0.82} />
      </mesh>
      <mesh rotation={[0, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[radius * 0.9, Math.max(0.035, width * 0.13), 10, 28]} />
        <meshStandardMaterial color={mode === 'blueprint' ? '#60d6ff' : '#11161b'} wireframe={mode === 'wireframe' || mode === 'blueprint'} roughness={0.75} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * (faceZ - 0.012)]} castShadow>
            <cylinderGeometry args={[rimRadius, rimRadius, 0.025, 24]} />
            <meshStandardMaterial color={darkMetal} wireframe={mode === 'wireframe' || mode === 'blueprint'} metalness={0.85} roughness={0.22} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * faceZ]}>
            <cylinderGeometry args={[rimRadius * 0.79, rimRadius * 0.79, 0.013, 24]} />
            <meshStandardMaterial color={mode === 'blueprint' ? '#55cae8' : '#78838c'} wireframe={mode === 'wireframe' || mode === 'blueprint'} metalness={0.88} roughness={0.24} />
          </mesh>
          <group position={[0, 0, side * (faceZ + 0.018)]}>
            {Array.from({ length: 6 }, (_, index) => (
              <RoundedBox key={index} args={[rimRadius * 0.72, 0.022, 0.018]} radius={0.008} smoothness={2} position={[rimRadius * 0.34, 0, 0]} rotation={[0, 0, (index / 6) * Math.PI * 2 + (side < 0 ? Math.PI / 6 : 0)]}>
                <meshStandardMaterial color={mode === 'blueprint' ? '#60d6ff' : '#111820'} wireframe={mode === 'wireframe' || mode === 'blueprint'} metalness={0.8} roughness={0.22} />
              </RoundedBox>
            ))}
            <RoundedBox args={[rimRadius * 0.24, rimRadius * 0.24, 0.03]} radius={0.04} smoothness={3}>
              <meshStandardMaterial color={mode === 'blueprint' ? '#73e8ff' : '#1c252e'} metalness={0.82} roughness={0.24} />
            </RoundedBox>
          </group>
          <RoundedBox args={[rimRadius * 0.24, rimRadius * 0.12, 0.04]} radius={0.018} smoothness={3} position={[0, rimRadius * 0.42, side * (faceZ + 0.022)]}>
            <meshStandardMaterial color={mode === 'blueprint' ? '#54dfff' : '#e1a23f'} emissive={mode === 'blueprint' ? '#1688a6' : '#5d3510'} emissiveIntensity={0.45} wireframe={mode === 'wireframe'} metalness={0.55} roughness={0.3} />
          </RoundedBox>
        </group>
      ))}
    </group>
  )
}

function WheelArch({ position, radius, color, mode }: { position: [number, number, number]; radius: number; color: string; mode: ViewMode }) {
  return (
    <mesh position={position} castShadow>
      <torusGeometry args={[radius * 1.1, Math.max(0.025, radius * 0.09), 8, 24, Math.PI]} />
      <meshStandardMaterial color={mode === 'blueprint' ? '#6edfff' : color} wireframe={mode === 'wireframe' || mode === 'blueprint'} metalness={mode === 'studio' ? 0.82 : 0.62} roughness={mode === 'studio' ? 0.22 : 0.32} />
    </mesh>
  )
}

function Strut({ position, scale, mode }: { position: [number, number, number]; scale: [number, number, number]; mode: ViewMode }) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={mode === 'blueprint' ? '#55ccff' : '#a8b2b8'} wireframe={mode === 'wireframe' || mode === 'blueprint'} metalness={0.72} roughness={0.3} />
    </mesh>
  )
}

function AeroWing({ position, width, chord, mode, color, rotate = 0 }: {
  position: [number, number, number]
  width: number
  chord: number
  mode: ViewMode
  color: string
  rotate?: number
}) {
  return (
    <group position={position} rotation={[0, 0, rotate]}>
      <RoundedBox args={[chord, 0.07, width]} radius={0.025} smoothness={3} castShadow>
        <BodyMaterial color={color} mode={mode} />
      </RoundedBox>
      <Strut position={[0.03, -0.16, -width * 0.26]} scale={[0.045, 0.3, 0.04]} mode={mode} />
      <Strut position={[0.03, -0.16, width * 0.26]} scale={[0.045, 0.3, 0.04]} mode={mode} />
    </group>
  )
}

type VectorTuple = [number, number, number]

function FormulaSurfaceMaterial({
  color,
  mode,
  metalness = 0.72,
  roughness = 0.28,
  emissive,
}: {
  color: string
  mode: ViewMode
  metalness?: number
  roughness?: number
  emissive?: string
}) {
  const blueprint = mode === 'blueprint'
  const structural = mode === 'structural'
  return (
    <meshStandardMaterial
      color={blueprint ? '#55d9ff' : color}
      emissive={blueprint ? '#12627c' : emissive ?? '#000000'}
      emissiveIntensity={blueprint ? 0.34 : emissive ? 0.32 : 0}
      metalness={blueprint ? 0.34 : metalness}
      roughness={blueprint ? 0.36 : roughness}
      wireframe={mode === 'wireframe' || blueprint}
      transparent={structural}
      opacity={structural ? 0.46 : 1}
    />
  )
}

function FormulaTube({
  from,
  to,
  radius = 0.018,
  color = '#1b2229',
  mode,
}: {
  from: VectorTuple
  to: VectorTuple
  radius?: number
  color?: string
  mode: ViewMode
}) {
  const transform = useMemo(() => {
    const start = new Vector3(...from)
    const end = new Vector3(...to)
    const direction = end.clone().sub(start)
    const length = direction.length()
    const midpoint = start.add(end).multiplyScalar(0.5)
    const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())
    return { midpoint: midpoint.toArray() as VectorTuple, rotation, length }
  }, [from[0], from[1], from[2], to[0], to[1], to[2]])

  return (
    <mesh position={transform.midpoint} quaternion={transform.rotation} castShadow>
      <cylinderGeometry args={[radius, radius, transform.length, 8]} />
      <FormulaSurfaceMaterial color={color} mode={mode} metalness={0.82} roughness={0.22} />
    </mesh>
  )
}

function FormulaWingElement({
  position,
  span,
  chord,
  mode,
  color,
  pitch = 0,
}: {
  position: VectorTuple
  span: number
  chord: number
  mode: ViewMode
  color: string
  pitch?: number
}) {
  return (
    <RoundedBox args={[chord, 0.035, span]} radius={0.012} smoothness={3} position={position} rotation={[0, 0, pitch]} castShadow>
      <FormulaSurfaceMaterial color={color} mode={mode} metalness={0.76} roughness={0.2} />
    </RoundedBox>
  )
}

function FormulaWheel({
  position,
  radius,
  width,
  accent,
  mode,
}: {
  position: VectorTuple
  radius: number
  width: number
  accent: string
  mode: ViewMode
}) {
  const rimRadius = radius * 0.58
  const faceZ = width * 0.53
  const spokeCount = 8
  const sides = [-1, 1] as const
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, width, 32, 1]} />
        <FormulaSurfaceMaterial color="#0c0e11" mode={mode} metalness={0.08} roughness={0.82} />
      </mesh>
      <mesh castShadow>
        <torusGeometry args={[radius * 0.91, Math.max(0.026, width * 0.12), 8, 30]} />
        <FormulaSurfaceMaterial color="#11151a" mode={mode} metalness={0.1} roughness={0.7} />
      </mesh>
      {sides.map((side) => (
        <group key={side}>
          <mesh position={[0, 0, side * (faceZ - 0.012)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[rimRadius, rimRadius, 0.024, 24]} />
            <FormulaSurfaceMaterial color="#212932" mode={mode} metalness={0.88} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, side * (faceZ + 0.005)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[rimRadius * 0.79, rimRadius * 0.79, 0.012, 24]} />
            <FormulaSurfaceMaterial color="#69747e" mode={mode} metalness={0.86} roughness={0.24} />
          </mesh>
          {Array.from({ length: spokeCount }, (_, index) => {
            const angle = (index / spokeCount) * Math.PI * 2 + (side < 0 ? Math.PI / spokeCount : 0)
            return (
              <FormulaTube
                key={index}
                from={[0, 0, side * (faceZ + 0.018)]}
                to={[Math.cos(angle) * rimRadius * 0.72, Math.sin(angle) * rimRadius * 0.72, side * (faceZ + 0.018)]}
                radius={0.012}
                color="#11171e"
                mode={mode}
              />
            )
          })}
          <mesh position={[0, 0, side * (faceZ + 0.03)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[rimRadius * 0.17, rimRadius * 0.17, 0.024, 18]} />
            <FormulaSurfaceMaterial color={accent} mode={mode} metalness={0.7} roughness={0.25} emissive={accent} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function FormulaHalo({ bodyY, mode }: { bodyY: number; mode: ViewMode }) {
  const haloY = bodyY + 0.48
  const rearX = -0.37
  const frontX = 0.28
  const outerZ = 0.255
  const tubeColor = mode === 'blueprint' ? '#61dbff' : '#181e25'
  return (
    <group>
      <FormulaTube from={[frontX + 0.17, bodyY + 0.18, 0]} to={[frontX, haloY, 0]} radius={0.028} color={tubeColor} mode={mode} />
      <FormulaTube from={[frontX, haloY, 0]} to={[frontX - 0.08, haloY + 0.025, outerZ]} radius={0.029} color={tubeColor} mode={mode} />
      <FormulaTube from={[frontX, haloY, 0]} to={[frontX - 0.08, haloY + 0.025, -outerZ]} radius={0.029} color={tubeColor} mode={mode} />
      <FormulaTube from={[frontX - 0.08, haloY + 0.025, outerZ]} to={[rearX, haloY + 0.015, outerZ]} radius={0.029} color={tubeColor} mode={mode} />
      <FormulaTube from={[frontX - 0.08, haloY + 0.025, -outerZ]} to={[rearX, haloY + 0.015, -outerZ]} radius={0.029} color={tubeColor} mode={mode} />
      <FormulaTube from={[rearX, haloY + 0.015, outerZ]} to={[rearX - 0.09, bodyY + 0.26, outerZ * 0.72]} radius={0.029} color={tubeColor} mode={mode} />
      <FormulaTube from={[rearX, haloY + 0.015, -outerZ]} to={[rearX - 0.09, bodyY + 0.26, -outerZ * 0.72]} radius={0.029} color={tubeColor} mode={mode} />
      <FormulaTube from={[rearX, haloY + 0.015, -outerZ]} to={[rearX, haloY + 0.015, outerZ]} radius={0.029} color={tubeColor} mode={mode} />
      <RoundedBox args={[0.52, 0.09, 0.4]} radius={0.04} smoothness={3} position={[-0.08, bodyY + 0.22, 0]}>
        <FormulaSurfaceMaterial color="#080b0e" mode={mode} metalness={0.2} roughness={0.62} />
      </RoundedBox>
      <RoundedBox args={[0.13, 0.04, 0.28]} radius={0.015} smoothness={2} position={[0.17, bodyY + 0.305, 0]} rotation={[0, 0, -0.13]}>
        <FormulaSurfaceMaterial color="#333e48" mode={mode} metalness={0.8} roughness={0.24} />
      </RoundedBox>
    </group>
  )
}

function FormulaSuspension({
  frontX,
  rearX,
  frontTrack,
  rearTrack,
  wheelY,
  bodyY,
  mode,
}: {
  frontX: number
  rearX: number
  frontTrack: number
  rearTrack: number
  wheelY: number
  bodyY: number
  mode: ViewMode
}) {
  const carbon = mode === 'blueprint' ? '#61dfff' : '#18212a'
  const corners = [
    { axle: frontX, track: frontTrack, innerX: frontX - 0.31, rear: false },
    { axle: rearX, track: rearTrack, innerX: rearX + 0.28, rear: true },
  ]
  return (
    <group>
      {corners.flatMap(({ axle, track, innerX, rear }) => [-1, 1].map((side) => {
        const outerZ = side * (track / 2 - 0.055)
        const innerZ = side * 0.27
        const pushrodX = rear ? axle - 0.08 : axle + 0.07
        return (
          <group key={`${axle}-${side}`}>
            <FormulaTube from={[innerX, bodyY + 0.1, innerZ]} to={[axle, wheelY + 0.105, outerZ]} radius={0.018} color={carbon} mode={mode} />
            <FormulaTube from={[innerX + (rear ? 0.18 : -0.16), bodyY - 0.07, innerZ]} to={[axle, wheelY - 0.075, outerZ]} radius={0.018} color={carbon} mode={mode} />
            <FormulaTube from={[pushrodX, bodyY + 0.19, side * 0.2]} to={[axle, wheelY + 0.135, outerZ]} radius={0.015} color={carbon} mode={mode} />
            {!rear && <FormulaTube from={[axle - 0.14, bodyY + 0.015, side * 0.23]} to={[axle + 0.03, wheelY + 0.02, outerZ]} radius={0.012} color={carbon} mode={mode} />}
            <mesh position={[axle, wheelY, outerZ]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.078, 0.078, 0.045, 12]} />
              <FormulaSurfaceMaterial color="#4c5965" mode={mode} metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        )
      }))}
    </group>
  )
}

function FormulaFrontWing({
  frontX,
  bodyY,
  span,
  accent,
  mode,
}: {
  frontX: number
  bodyY: number
  span: number
  accent: string
  mode: ViewMode
}) {
  const wingX = frontX + 0.4
  const wingY = bodyY - 0.2
  const endplateColor = mode === 'blueprint' ? '#61dcff' : '#151c23'
  return (
    <group>
      <FormulaWingElement position={[wingX, wingY, 0]} span={span} chord={0.48} mode={mode} color="#10161c" pitch={0.04} />
      <FormulaWingElement position={[wingX - 0.07, wingY + 0.07, 0]} span={span * 0.9} chord={0.4} mode={mode} color={accent} pitch={0.11} />
      <FormulaWingElement position={[wingX - 0.14, wingY + 0.125, 0]} span={span * 0.72} chord={0.31} mode={mode} color="#131a21" pitch={0.14} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox args={[0.52, 0.35, 0.035]} radius={0.012} smoothness={2} position={[wingX - 0.02, wingY + 0.12, side * (span / 2 - 0.012)]} rotation={[0, 0, -0.1]}>
            <FormulaSurfaceMaterial color={endplateColor} mode={mode} metalness={0.64} roughness={0.3} />
          </RoundedBox>
          <RoundedBox args={[0.18, 0.1, 0.045]} radius={0.012} smoothness={2} position={[wingX - 0.18, wingY + 0.08, side * (span * 0.35)]}>
            <FormulaSurfaceMaterial color={accent} mode={mode} metalness={0.65} roughness={0.24} />
          </RoundedBox>
        </group>
      ))}
      <FormulaTube from={[frontX + 0.12, bodyY - 0.04, -0.16]} to={[wingX - 0.08, wingY + 0.06, -span * 0.21]} radius={0.018} color="#1b2229" mode={mode} />
      <FormulaTube from={[frontX + 0.12, bodyY - 0.04, 0.16]} to={[wingX - 0.08, wingY + 0.06, span * 0.21]} radius={0.018} color="#1b2229" mode={mode} />
    </group>
  )
}

function FormulaRearWing({
  rearX,
  bodyY,
  span,
  accent,
  mode,
}: {
  rearX: number
  bodyY: number
  span: number
  accent: string
  mode: ViewMode
}) {
  const wingX = rearX - 0.38
  const wingY = bodyY + 0.48
  const carbon = mode === 'blueprint' ? '#61dcff' : '#12191f'
  return (
    <group>
      <FormulaWingElement position={[wingX, wingY, 0]} span={span} chord={0.42} mode={mode} color={carbon} pitch={-0.13} />
      <FormulaWingElement position={[wingX + 0.1, wingY + 0.13, 0]} span={span * 0.94} chord={0.33} mode={mode} color={accent} pitch={-0.16} />
      {[-1, 1].map((side) => (
        <RoundedBox key={side} args={[0.31, 0.62, 0.04]} radius={0.014} smoothness={2} position={[wingX, wingY - 0.05, side * (span / 2 - 0.015)]} rotation={[0, 0, 0.02]}>
          <FormulaSurfaceMaterial color={carbon} mode={mode} metalness={0.72} roughness={0.23} />
        </RoundedBox>
      ))}
      <FormulaTube from={[rearX - 0.08, bodyY + 0.08, -0.2]} to={[wingX + 0.06, wingY - 0.16, -0.2]} radius={0.024} color="#1d252c" mode={mode} />
      <FormulaTube from={[rearX - 0.08, bodyY + 0.08, 0.2]} to={[wingX + 0.06, wingY - 0.16, 0.2]} radius={0.024} color="#1d252c" mode={mode} />
      <RoundedBox args={[0.27, 0.035, span * 0.32]} radius={0.01} smoothness={2} position={[wingX - 0.07, wingY + 0.22, 0]}>
        <FormulaSurfaceMaterial color="#090d11" mode={mode} metalness={0.58} roughness={0.34} />
      </RoundedBox>
    </group>
  )
}

function FormulaFloorAndDiffuser({
  spec,
  bodyY,
  rearX,
  mode,
}: {
  spec: VehicleSpec
  bodyY: number
  rearX: number
  mode: ViewMode
}) {
  const floorY = bodyY - 0.2
  const floorLength = spec.wheelbase * 0.95
  const carbon = mode === 'blueprint' ? '#61dcff' : '#11181f'
  return (
    <group>
      <RoundedBox args={[floorLength, 0.075, 1.22]} radius={0.018} smoothness={2} position={[-0.04, floorY, 0]} castShadow>
        <FormulaSurfaceMaterial color={carbon} mode={mode} metalness={0.7} roughness={0.28} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox args={[spec.wheelbase * 0.54, 0.16, 0.026]} radius={0.008} smoothness={2} position={[0.22, floorY + 0.06, side * 0.61]}>
            <FormulaSurfaceMaterial color={carbon} mode={mode} metalness={0.7} roughness={0.24} />
          </RoundedBox>
          <RoundedBox args={[0.55, 0.14, 0.02]} radius={0.006} smoothness={2} position={[-0.5, floorY + 0.08, side * 0.49]} rotation={[0, 0, side * 0.04]}>
            <FormulaSurfaceMaterial color={spec.accentColor} mode={mode} metalness={0.72} roughness={0.25} />
          </RoundedBox>
        </group>
      ))}
      <RoundedBox args={[0.72, 0.12, 1.18]} radius={0.012} smoothness={2} position={[rearX - 0.17, floorY + 0.065, 0]} rotation={[0, 0, -0.12]}>
        <FormulaSurfaceMaterial color="#0a0f14" mode={mode} metalness={0.52} roughness={0.38} />
      </RoundedBox>
      {[-0.43, -0.22, 0, 0.22, 0.43].map((z) => (
        <RoundedBox key={z} args={[0.48, 0.22, 0.024]} radius={0.006} smoothness={2} position={[rearX - 0.28, floorY + 0.12, z]} rotation={[0, 0, -0.18]}>
          <FormulaSurfaceMaterial color={carbon} mode={mode} metalness={0.65} roughness={0.3} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.1, 0.055, 0.07]} radius={0.016} smoothness={3} position={[rearX - 0.54, floorY + 0.08, 0]}>
        <FormulaSurfaceMaterial color="#ff302f" mode={mode} metalness={0.24} roughness={0.24} emissive="#ff302f" />
      </RoundedBox>
    </group>
  )
}

function FormulaBodywork({ spec, profile, mode }: { spec: VehicleSpec; profile: GeometryProfile; mode: ViewMode }) {
  const { bodyY } = profile
  const carbon = mode === 'blueprint' ? '#61dcff' : '#141b22'
  return (
    <group>
      <FormulaTaperedPod position={[0.93, bodyY + 0.015, 0]} length={1.28} rearRadius={0.21} frontRadius={0.055} depthScale={0.83} color={spec.bodyColor} mode={mode} />
      <RoundedBox args={[0.94, 0.34, 0.56]} radius={0.115} smoothness={5} position={[-0.03, bodyY + 0.08, 0]} castShadow receiveShadow>
        <FormulaSurfaceMaterial color={spec.bodyColor} mode={mode} metalness={0.78} roughness={0.22} />
      </RoundedBox>
      <RoundedBox args={[0.78, 0.42, 0.4]} radius={0.12} smoothness={5} position={[-0.74, bodyY + 0.2, 0]} rotation={[0, 0, 0.08]} castShadow>
        <FormulaSurfaceMaterial color={spec.bodyColor} mode={mode} metalness={0.74} roughness={0.24} />
      </RoundedBox>
      <FormulaTaperedPod position={[-1.22, bodyY + 0.12, 0]} length={1.08} rearRadius={0.22} frontRadius={0.18} depthScale={0.82} color={spec.bodyColor} mode={mode} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <FormulaTaperedPod position={[-0.78, bodyY + 0.005, side * 0.47]} length={1.18} rearRadius={0.22} frontRadius={0.16} depthScale={0.82} color={spec.bodyColor} mode={mode} />
          <RoundedBox args={[0.34, 0.18, 0.024]} radius={0.045} smoothness={4} position={[-0.22, bodyY + 0.08, side * 0.627]} rotation={[0, 0, side * 0.02]}>
            <FormulaSurfaceMaterial color="#06090c" mode={mode} metalness={0.22} roughness={0.7} />
          </RoundedBox>
          <RoundedBox args={[0.72, 0.05, 0.1]} radius={0.018} smoothness={3} position={[-1.08, bodyY + 0.23, side * 0.56]} rotation={[0, 0, -0.08]}>
            <FormulaSurfaceMaterial color={carbon} mode={mode} metalness={0.8} roughness={0.2} />
          </RoundedBox>
        </group>
      ))}
      <RoundedBox args={[0.26, 0.18, 0.3]} radius={0.07} smoothness={4} position={[-0.63, bodyY + 0.56, 0]}>
        <FormulaSurfaceMaterial color={carbon} mode={mode} metalness={0.68} roughness={0.25} />
      </RoundedBox>
      <RoundedBox args={[0.11, 0.08, 0.18]} radius={0.034} smoothness={3} position={[-0.58, bodyY + 0.65, 0]}>
        <FormulaSurfaceMaterial color="#080c10" mode={mode} metalness={0.2} roughness={0.6} />
      </RoundedBox>
      <FormulaHalo bodyY={bodyY} mode={mode} />
    </group>
  )
}

function FormulaTaperedPod({
  position,
  length,
  rearRadius,
  frontRadius,
  depthScale,
  color,
  mode,
}: {
  position: VectorTuple
  length: number
  rearRadius: number
  frontRadius: number
  depthScale: number
  color: string
  mode: ViewMode
}) {
  return (
    <mesh position={position} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, depthScale]} castShadow>
      <cylinderGeometry args={[rearRadius, frontRadius, length, 6]} />
      <FormulaSurfaceMaterial color={color} mode={mode} metalness={0.72} roughness={0.25} />
    </mesh>
  )
}

function FormulaCar({ spec, profile, mode, exploded }: { spec: VehicleSpec; profile: GeometryProfile; mode: ViewMode; exploded: boolean }) {
  const frontX = spec.wheelbase / 2
  const rearX = -spec.wheelbase / 2
  const frontSpan = Math.max(spec.frontTrack + 0.3, 1.95)
  const rearSpan = Math.max(spec.rearTrack + 0.04, 1.66)
  const explode = exploded ? 1 : 0
  return (
    <>
      <AnimatedPart target={[0, explode * 0.11, 0]}>
        <FormulaFloorAndDiffuser spec={spec} bodyY={profile.bodyY} rearX={rearX} mode={mode} />
        <FormulaBodywork spec={spec} profile={profile} mode={mode} />
        <FormulaSuspension
          frontX={frontX}
          rearX={rearX}
          frontTrack={spec.frontTrack}
          rearTrack={spec.rearTrack}
          wheelY={spec.wheelRadius}
          bodyY={profile.bodyY}
          mode={mode}
        />
      </AnimatedPart>
      <AnimatedPart target={[explode * 0.66, explode * 0.08, 0]}>
        <FormulaFrontWing frontX={frontX} bodyY={profile.bodyY} span={frontSpan} accent={spec.accentColor} mode={mode} />
      </AnimatedPart>
      <AnimatedPart target={[-explode * 0.66, explode * 0.32, 0]}>
        <FormulaRearWing rearX={rearX} bodyY={profile.bodyY} span={rearSpan} accent={spec.accentColor} mode={mode} />
      </AnimatedPart>
    </>
  )
}

function VehicleDetailMaterial({
  color,
  mode,
  emissive,
  metalness = 0.68,
  roughness = 0.28,
}: {
  color: string
  mode: ViewMode
  emissive?: string
  metalness?: number
  roughness?: number
}) {
  const blueprint = mode === 'blueprint'
  const structural = mode === 'structural'
  return (
    <meshStandardMaterial
      color={blueprint ? '#5cddff' : color}
      emissive={blueprint ? '#146783' : emissive ?? '#000000'}
      emissiveIntensity={blueprint ? 0.35 : emissive ? 0.72 : 0}
      metalness={blueprint ? 0.34 : metalness}
      roughness={blueprint ? 0.35 : roughness}
      wireframe={mode === 'wireframe' || blueprint}
      transparent={structural}
      opacity={structural ? 0.42 : 1}
    />
  )
}

function PassengerBodyDetails({ profile, spec, mode }: { profile: GeometryProfile; spec: VehicleSpec; mode: ViewMode }) {
  const { bodyLength, bodyWidth, bodyHeight, bodyY, cabin } = profile
  const frontX = bodyLength * 0.505
  const rearX = -bodyLength * 0.505
  const sideZ = bodyWidth * 0.51
  const glass = mode === 'blueprint' ? '#174e64' : '#0b151e'
  const seam = mode === 'blueprint' ? '#77e7ff' : '#151d25'
  const lampY = bodyY + bodyHeight * 0.02
  const doorY = bodyY + bodyHeight * 0.01
  const grilleWidth = Math.max(bodyWidth * 0.34, spec.coolingIntake * bodyWidth * 0.95)
  return (
    <group>
      <RoundedBox args={[0.026, cabin.height * 0.76, cabin.width * 0.88]} radius={0.012} smoothness={2} position={[cabin.x + cabin.length * 0.42, bodyY + cabin.y + cabin.height * 0.02, 0]} rotation={[0, 0, 0.3]}>
        <VehicleDetailMaterial color={glass} mode={mode} metalness={0.78} roughness={0.11} />
      </RoundedBox>
      <RoundedBox args={[0.026, cabin.height * 0.56, cabin.width * 0.8]} radius={0.012} smoothness={2} position={[cabin.x - cabin.length * 0.43, bodyY + cabin.y + cabin.height * 0.02, 0]} rotation={[0, 0, -0.17]}>
        <VehicleDetailMaterial color={glass} mode={mode} metalness={0.78} roughness={0.11} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox args={[cabin.length * 0.68, cabin.height * 0.5, 0.018]} radius={0.016} smoothness={2} position={[cabin.x, bodyY + cabin.y + cabin.height * 0.02, side * (cabin.width * 0.51)]}>
            <VehicleDetailMaterial color={glass} mode={mode} metalness={0.8} roughness={0.1} />
          </RoundedBox>
          <RoundedBox args={[0.022, cabin.height * 0.58, 0.022]} radius={0.006} smoothness={2} position={[cabin.x - cabin.length * 0.04, bodyY + cabin.y + cabin.height * 0.01, side * (cabin.width * 0.53)]}>
            <VehicleDetailMaterial color={seam} mode={mode} metalness={0.74} roughness={0.23} />
          </RoundedBox>
          {[-0.29, 0.27].map((offset) => (
            <RoundedBox key={offset} args={[0.017, Math.max(0.28, bodyHeight * 0.6), 0.012]} radius={0.004} smoothness={2} position={[cabin.x + cabin.length * offset, doorY, side * sideZ]}>
              <VehicleDetailMaterial color={seam} mode={mode} metalness={0.6} roughness={0.35} />
            </RoundedBox>
          ))}
          <RoundedBox args={[cabin.length * 0.6, 0.013, 0.012]} radius={0.004} smoothness={2} position={[cabin.x, doorY - Math.max(0.12, bodyHeight * 0.15), side * sideZ]}>
            <VehicleDetailMaterial color={seam} mode={mode} metalness={0.6} roughness={0.35} />
          </RoundedBox>
          <RoundedBox args={[0.12, 0.022, 0.026]} radius={0.009} smoothness={2} position={[cabin.x + cabin.length * 0.12, doorY + Math.max(0.02, bodyHeight * 0.09), side * (sideZ + 0.012)]}>
            <VehicleDetailMaterial color="#9ea7ae" mode={mode} metalness={0.86} roughness={0.19} />
          </RoundedBox>
          <RoundedBox args={[0.14, 0.026, 0.018]} radius={0.008} smoothness={2} position={[cabin.x + cabin.length * 0.31, bodyY + cabin.y * 0.73, side * (sideZ + 0.075)]} rotation={[0, 0, -0.18]}>
            <VehicleDetailMaterial color={seam} mode={mode} metalness={0.72} roughness={0.23} />
          </RoundedBox>
          <RoundedBox args={[0.16, 0.07, 0.07]} radius={0.024} smoothness={3} position={[cabin.x + cabin.length * 0.38, bodyY + cabin.y * 0.75, side * (sideZ + 0.14)]}>
            <VehicleDetailMaterial color={glass} mode={mode} metalness={0.76} roughness={0.14} />
          </RoundedBox>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <RoundedBox key={side} args={[0.035, 0.085, Math.max(0.14, bodyWidth * 0.17)]} radius={0.018} smoothness={3} position={[frontX, lampY, side * (bodyWidth * 0.31)]}>
          <VehicleDetailMaterial color="#eef8ff" mode={mode} emissive="#74c8ff" metalness={0.25} roughness={0.12} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.035, 0.16, grilleWidth]} radius={0.022} smoothness={3} position={[frontX + 0.008, bodyY - bodyHeight * 0.12, 0]}>
        <VehicleDetailMaterial color="#090e13" mode={mode} metalness={0.32} roughness={0.63} />
      </RoundedBox>
      {[-0.045, 0, 0.045].map((offset) => (
        <RoundedBox key={offset} args={[0.016, 0.012, grilleWidth * 0.86]} radius={0.004} smoothness={2} position={[frontX + 0.029, bodyY - bodyHeight * 0.12 + offset, 0]}>
          <VehicleDetailMaterial color="#59636c" mode={mode} metalness={0.82} roughness={0.27} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.03, 0.045, bodyWidth * 0.58]} radius={0.012} smoothness={2} position={[rearX, bodyY + bodyHeight * 0.02, 0]}>
        <VehicleDetailMaterial color="#ff3f42" mode={mode} emissive="#ff2626" metalness={0.35} roughness={0.19} />
      </RoundedBox>
      <RoundedBox args={[bodyLength * 0.26, 0.012, bodyWidth * 0.62]} radius={0.004} smoothness={2} position={[bodyLength * 0.17, bodyY + bodyHeight * 0.47, 0]}>
        <VehicleDetailMaterial color={seam} mode={mode} metalness={0.58} roughness={0.38} />
      </RoundedBox>
    </group>
  )
}

function MonsterShock({ from, to, accent, mode }: { from: VectorTuple; to: VectorTuple; accent: string; mode: ViewMode }) {
  const midpoint: VectorTuple = [
    from[0] * 0.48 + to[0] * 0.52,
    from[1] * 0.48 + to[1] * 0.52,
    from[2] * 0.48 + to[2] * 0.52,
  ]
  return (
    <group>
      <FormulaTube from={from} to={midpoint} radius={0.052} color={accent} mode={mode} />
      <FormulaTube from={midpoint} to={to} radius={0.021} color="#c5d0d6" mode={mode} />
    </group>
  )
}

function MonsterWheel({
  position,
  radius,
  width,
  accent,
  mode,
}: {
  position: VectorTuple
  radius: number
  width: number
  accent: string
  mode: ViewMode
}) {
  const tireWidth = Math.max(width, radius * 0.58)
  const rimRadius = radius * 0.48
  const faceZ = tireWidth * 0.52
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, tireWidth, 24]} />
        <VehicleDetailMaterial color="#101216" mode={mode} metalness={0.06} roughness={0.86} />
      </mesh>
      <mesh castShadow>
        <torusGeometry args={[radius * 0.88, tireWidth * 0.16, 8, 24]} />
        <VehicleDetailMaterial color="#12161a" mode={mode} metalness={0.08} roughness={0.78} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2
        const treadZ = index % 2 === 0 ? -tireWidth * 0.2 : tireWidth * 0.2
        return (
          <RoundedBox key={index} args={[radius * 0.2, radius * 0.16, tireWidth * 0.54]} radius={0.022} smoothness={2} position={[Math.cos(angle) * radius * 0.94, Math.sin(angle) * radius * 0.94, treadZ]} rotation={[0, 0, angle]} castShadow>
            <VehicleDetailMaterial color="#191d22" mode={mode} metalness={0.08} roughness={0.76} />
          </RoundedBox>
        )
      })}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[0, 0, side * faceZ]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[rimRadius, rimRadius, 0.035, 18]} />
            <VehicleDetailMaterial color="#202a31" mode={mode} metalness={0.88} roughness={0.21} />
          </mesh>
          <mesh position={[0, 0, side * (faceZ + 0.024)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[rimRadius * 0.76, rimRadius * 0.76, 0.018, 18]} />
            <VehicleDetailMaterial color="#4d5a64" mode={mode} metalness={0.9} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0, side * (faceZ + 0.04)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[rimRadius * 0.2, rimRadius * 0.2, 0.035, 14]} />
            <VehicleDetailMaterial color={accent} mode={mode} emissive={accent} metalness={0.58} roughness={0.28} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function MonsterTruck({ spec, profile, mode, exploded }: { spec: VehicleSpec; profile: GeometryProfile; mode: ViewMode; exploded: boolean }) {
  const wheelX = spec.wheelbase / 2
  const wheelY = spec.wheelRadius
  const frameY = wheelY + Math.max(0.44, spec.rideHeight * 0.83)
  const bodyWidth = profile.bodyWidth * 0.84
  const cabY = frameY + 0.53
  const axleY = wheelY + 0.03
  const cageColor = mode === 'blueprint' ? '#67e5ff' : '#2a333b'
  const explode = exploded ? 1 : 0
  const axles = [
    { x: wheelX, track: spec.frontTrack, rear: false },
    { x: -wheelX, track: spec.rearTrack, rear: true },
  ]
  return (
    <>
      <AnimatedPart target={[0, explode * 0.16, 0]}>
        <group>
          <FormulaTube from={[wheelX + 0.38, frameY, -bodyWidth * 0.34]} to={[-wheelX - 0.38, frameY, -bodyWidth * 0.34]} radius={0.048} color={cageColor} mode={mode} />
          <FormulaTube from={[wheelX + 0.38, frameY, bodyWidth * 0.34]} to={[-wheelX - 0.38, frameY, bodyWidth * 0.34]} radius={0.048} color={cageColor} mode={mode} />
          <FormulaTube from={[wheelX * 0.58, frameY + 0.44, -bodyWidth * 0.36]} to={[-wheelX * 0.55, frameY + 0.44, -bodyWidth * 0.36]} radius={0.045} color={cageColor} mode={mode} />
          <FormulaTube from={[wheelX * 0.58, frameY + 0.44, bodyWidth * 0.36]} to={[-wheelX * 0.55, frameY + 0.44, bodyWidth * 0.36]} radius={0.045} color={cageColor} mode={mode} />
          {[-1, 1].map((side) => (
            <group key={side}>
              <FormulaTube from={[0.42, frameY, side * bodyWidth * 0.36]} to={[0.24, cabY + 0.46, side * bodyWidth * 0.36]} radius={0.046} color={cageColor} mode={mode} />
              <FormulaTube from={[-0.58, frameY, side * bodyWidth * 0.36]} to={[-0.62, cabY + 0.43, side * bodyWidth * 0.36]} radius={0.046} color={cageColor} mode={mode} />
              <FormulaTube from={[0.24, cabY + 0.46, side * bodyWidth * 0.36]} to={[-0.62, cabY + 0.43, side * bodyWidth * 0.36]} radius={0.046} color={cageColor} mode={mode} />
              <FormulaTube from={[0.42, frameY + 0.02, side * bodyWidth * 0.36]} to={[-0.58, frameY + 0.44, side * bodyWidth * 0.36]} radius={0.035} color={cageColor} mode={mode} />
            </group>
          ))}
          <RoundedBox args={[1.04, 0.76, bodyWidth * 0.72]} radius={0.075} smoothness={4} position={[-0.2, cabY, 0]} castShadow>
            <BodyMaterial color={spec.bodyColor} mode={mode} opacity={mode === 'structural' ? 0.28 : 1} />
          </RoundedBox>
          <RoundedBox args={[1.14, 0.3, bodyWidth * 0.82]} radius={0.045} smoothness={3} position={[0.78, frameY + 0.26, 0]} rotation={[0, 0, -0.06]} castShadow>
            <BodyMaterial color={spec.bodyColor} mode={mode} opacity={mode === 'structural' ? 0.28 : 1} />
          </RoundedBox>
          <RoundedBox args={[1.08, 0.32, bodyWidth * 0.83]} radius={0.026} smoothness={3} position={[-1.12, frameY + 0.19, 0]} castShadow>
            <BodyMaterial color={spec.bodyColor} mode={mode} opacity={mode === 'structural' ? 0.28 : 1} />
          </RoundedBox>
          <RoundedBox args={[0.84, 0.025, bodyWidth * 0.68]} radius={0.008} smoothness={2} position={[-1.12, frameY + 0.37, 0]}>
            <VehicleDetailMaterial color="#090d11" mode={mode} metalness={0.2} roughness={0.72} />
          </RoundedBox>
          <RoundedBox args={[0.025, 0.3, bodyWidth * 0.52]} radius={0.012} smoothness={2} position={[0.36, cabY + 0.05, 0]} rotation={[0, 0, 0.18]}>
            <VehicleDetailMaterial color="#0b151d" mode={mode} metalness={0.78} roughness={0.12} />
          </RoundedBox>
          {[-1, 1].map((side) => (
            <group key={side}>
              <RoundedBox args={[0.62, 0.34, 0.02]} radius={0.018} smoothness={2} position={[-0.2, cabY + 0.05, side * (bodyWidth * 0.375)]}>
                <VehicleDetailMaterial color="#0b151d" mode={mode} metalness={0.78} roughness={0.12} />
              </RoundedBox>
              <RoundedBox args={[0.16, 0.08, 0.06]} radius={0.022} smoothness={3} position={[0.36, cabY + 0.01, side * (bodyWidth * 0.48)]}>
                <VehicleDetailMaterial color="#101820" mode={mode} metalness={0.75} roughness={0.19} />
              </RoundedBox>
              <RoundedBox args={[0.035, 0.09, bodyWidth * 0.13]} radius={0.018} smoothness={3} position={[1.35, frameY + 0.22, side * (bodyWidth * 0.27)]}>
                <VehicleDetailMaterial color="#eff8ff" mode={mode} emissive="#73c7ff" metalness={0.25} roughness={0.13} />
              </RoundedBox>
            </group>
          ))}
          <RoundedBox args={[0.038, 0.19, bodyWidth * 0.44]} radius={0.016} smoothness={3} position={[1.36, frameY + 0.12, 0]}>
            <VehicleDetailMaterial color="#0a1015" mode={mode} metalness={0.4} roughness={0.56} />
          </RoundedBox>
          <RoundedBox args={[0.48, 0.04, bodyWidth * 0.58]} radius={0.012} smoothness={2} position={[-0.18, cabY + 0.43, 0]}>
            <VehicleDetailMaterial color={cageColor} mode={mode} metalness={0.74} roughness={0.25} />
          </RoundedBox>
        </group>
      </AnimatedPart>
      {axles.map(({ x, track, rear }) => (
        <AnimatedPart key={x} target={[rear ? -explode * 0.14 : explode * 0.14, -explode * 0.09, 0]}>
          <RoundedBox args={[0.18, 0.18, track * 0.94]} radius={0.04} smoothness={3} position={[x, axleY, 0]}>
            <VehicleDetailMaterial color="#252e35" mode={mode} metalness={0.75} roughness={0.3} />
          </RoundedBox>
          <mesh position={[x, axleY, 0]} castShadow>
            <sphereGeometry args={[0.17, 12, 10]} />
            <VehicleDetailMaterial color="#1b232a" mode={mode} metalness={0.72} roughness={0.27} />
          </mesh>
          {[-1, 1].map((side) => {
            const outerZ = side * (track / 2 - 0.17)
            return (
              <group key={side}>
                <FormulaTube from={[x + (rear ? 0.34 : -0.34), frameY + 0.05, side * bodyWidth * 0.27]} to={[x, axleY + 0.03, outerZ]} radius={0.043} color={cageColor} mode={mode} />
                <FormulaTube from={[x + (rear ? -0.28 : 0.28), frameY - 0.02, side * bodyWidth * 0.25]} to={[x, axleY - 0.04, outerZ]} radius={0.043} color={cageColor} mode={mode} />
                <MonsterShock from={[x + (rear ? 0.2 : -0.2), frameY + 0.48, side * bodyWidth * 0.31]} to={[x, axleY + 0.12, outerZ]} accent={spec.accentColor} mode={mode} />
              </group>
            )
          })}
        </AnimatedPart>
      ))}
    </>
  )
}

function StructuralFrame({ spec, mode }: { spec: VehicleSpec; mode: ViewMode }) {
  if (mode !== 'structural') return null
  const bodyY = spec.wheelRadius + spec.rideHeight + 0.22
  const length = spec.wheelbase * 1.04
  const width = Math.max(spec.frontTrack, spec.rearTrack) * 0.7
  const frameColor = spec.vehicleClass === 'monster' ? '#ff7347' : '#8af0d7'
  return (
    <group>
      <Strut position={[0, bodyY, -width / 2]} scale={[length, 0.08, 0.08]} mode="solid" />
      <Strut position={[0, bodyY, width / 2]} scale={[length, 0.08, 0.08]} mode="solid" />
      <Strut position={[0, bodyY - 0.18, 0]} scale={[length * 0.92, 0.08, 0.08]} mode="solid" />
      {[-length / 2.2, 0, length / 2.2].map((x) => (
        <mesh key={x} position={[x, bodyY + 0.17, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.036, 0.036, width, 8]} />
          <meshStandardMaterial color={frameColor} emissive={new Color(frameColor)} emissiveIntensity={0.25} />
        </mesh>
      ))}
      <Strut position={[-0.32, bodyY + 0.45, 0]} scale={[0.06, 0.9, width * 0.88]} mode="solid" />
      <Strut position={[0.48, bodyY + 0.42, 0]} scale={[0.06, 0.76, width * 0.82]} mode="solid" />
    </group>
  )
}

const flowFamilyColor: Record<AeroFlowFamily, string> = {
  freestream: '#b8f3ff',
  roofline: '#65dbff',
  sidewash: '#79c9ff',
  'wheel-wake': '#dc87ff',
  underbody: '#91ffd0',
  'aero-surface': '#f3ff91',
  cooling: '#ffc276',
  'structural-wake': '#ff8aa7',
}

type FlowPresentation = {
  lineWidth: number
  opacity: number
  ribbonCount: number
  tracerScale: number
}

function averagePointAxis(points: readonly [number, number, number][], axis: 0 | 1 | 2) {
  if (!points.length) return 0
  return points.reduce((sum, point) => sum + point[axis], 0) / points.length
}

function flowPresentation(streamline: AeroStreamline): FlowPresentation {
  const baseOpacity = Math.min(0.9, 0.26 + streamline.opacity * 0.58)
  if (streamline.family === 'sidewash') {
    // The opening camera favours +Z. Keeping both sides present while making
    // that side brighter makes the surface-attached route readable immediately.
    const nearDefaultCamera = averagePointAxis(streamline.points, 2) >= 0
    return {
      lineWidth: nearDefaultCamera ? 3.4 : 2.45,
      opacity: nearDefaultCamera ? Math.max(baseOpacity, 0.9) : Math.max(baseOpacity, 0.72),
      ribbonCount: 2,
      tracerScale: nearDefaultCamera ? 1.35 : 1.12,
    }
  }
  if (streamline.family === 'underbody') return { lineWidth: 2.25, opacity: Math.max(baseOpacity, 0.76), ribbonCount: 1, tracerScale: 1.14 }
  if (streamline.family === 'aero-surface') return { lineWidth: 2.05, opacity: Math.max(baseOpacity, 0.8), ribbonCount: 1, tracerScale: 1.12 }
  if (streamline.family === 'wheel-wake') return { lineWidth: 1.85, opacity: Math.max(baseOpacity, 0.78), ribbonCount: 0, tracerScale: 1.08 }
  return { lineWidth: 1.65, opacity: baseOpacity, ribbonCount: 0, tracerScale: 1 }
}

function surfaceRibbonPoints(streamline: AeroStreamline, layer: number): [number, number, number][] {
  const side = Math.sign(averagePointAxis(streamline.points, 2)) || 1
  const distance = 0.011 + layer * 0.014
  return streamline.points.map(([x, y, z], index) => {
    const taper = 0.8 + Math.min(index / Math.max(1, streamline.points.length - 1), 1) * 0.2
    if (streamline.family === 'underbody') return [x, y - distance * taper, z]
    if (streamline.family === 'roofline') return [x, y + distance * taper, z]
    return [x, y, z + side * distance * taper]
  })
}

function FlowStreamline({ streamline }: { streamline: AeroStreamline }) {
  const presentation = useMemo(() => flowPresentation(streamline), [streamline])
  const points = useMemo(
    () => streamline.points.map((point) => [...point] as [number, number, number]),
    [streamline],
  )
  const ribbons = useMemo(
    () => Array.from({ length: presentation.ribbonCount }, (_, index) => surfaceRibbonPoints(streamline, index)),
    [presentation.ribbonCount, streamline],
  )
  const color = flowFamilyColor[streamline.family]
  return (
    <group name={`surface-flow-${streamline.family}`}>
      {ribbons.map((ribbon, index) => (
        <Line
          key={`${streamline.id}-ribbon-${index}`}
          points={ribbon}
          color={color}
          lineWidth={Math.max(0.8, presentation.lineWidth * (0.46 - index * 0.1))}
          transparent
          opacity={presentation.opacity * (0.24 - index * 0.05)}
          depthWrite={false}
        />
      ))}
      <Line
        points={points}
        color={color}
        lineWidth={presentation.lineWidth}
        transparent
        opacity={presentation.opacity}
        depthWrite={false}
      />
    </group>
  )
}

type FlowTracer = {
  id: string
  points: readonly [number, number, number][]
  speed: number
  phase: number
  color: string
  size: number
  opacity: number
}

function FlowTracerField({ streamlines }: { streamlines: readonly AeroStreamline[] }) {
  const refs = useRef<Array<Mesh | null>>([])
  const tracers = useMemo<readonly FlowTracer[]>(
    () => {
      const ordered = [...streamlines].sort((left, right) => {
        const priority = (streamline: AeroStreamline) => streamline.family === 'sidewash' ? 0 : streamline.family === 'aero-surface' ? 1 : 2
        return priority(left) - priority(right)
      })
      return ordered
        .flatMap((streamline, index) => {
          const presentation = flowPresentation(streamline)
          const count = streamline.family === 'sidewash' ? 2 : 1
          return Array.from({ length: count }, (_, copy) => ({
            id: `${streamline.id}-tracer-${copy}`,
            points: streamline.points,
            speed: 0.16 + streamline.speedMultiplier * 0.22 + copy * 0.035,
            phase: (index * 0.173 + copy * 0.47) % 1,
            color: flowFamilyColor[streamline.family],
            size: (0.018 + (index % 3) * 0.004) * presentation.tracerScale,
            opacity: streamline.family === 'sidewash' ? 0.98 : 0.92,
          }))
        })
        .slice(0, 42)
    },
    [streamlines],
  )

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    tracers.forEach((tracer, index) => {
      const marker = refs.current[index]
      if (!marker || tracer.points.length < 2) return
      const phase = (time * tracer.speed + tracer.phase) % 1
      const distance = phase * (tracer.points.length - 1)
      const segment = Math.min(tracer.points.length - 2, Math.floor(distance))
      const local = distance - segment
      const from = tracer.points[segment]
      const to = tracer.points[segment + 1]
      marker.position.set(
        from[0] + (to[0] - from[0]) * local,
        from[1] + (to[1] - from[1]) * local,
        from[2] + (to[2] - from[2]) * local,
      )
      marker.scale.setScalar(0.84 + Math.sin((phase + tracer.phase) * Math.PI * 2) * 0.16)
    })
  })

  return (
    <group name="aero-flow-tracers">
      {tracers.map((tracer, index) => (
        <mesh key={tracer.id} ref={(node) => { refs.current[index] = node }}>
          <sphereGeometry args={[tracer.size, 6, 6]} />
          <meshBasicMaterial color={tracer.color} transparent opacity={tracer.opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function PressureCues({ zones }: { zones: readonly AeroPressureZone[] }) {
  const cues = useMemo(
    () => [...zones].sort((left, right) => right.strength - left.strength).slice(0, 14),
    [zones],
  )
  return (
    <group name="component-pressure-cues">
      {cues.map((zone) => {
        const color = zone.kind === 'low-pressure'
          ? '#55dfff'
          : zone.kind === 'stagnation'
            ? '#ffbb68'
            : '#ff789b'
        return (
          <mesh key={zone.id} name={zone.componentId} position={zone.anchor} scale={[zone.radius * 1.16, zone.radius * 0.42, zone.radius]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.06 + zone.strength * 0.12} depthWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}

function WakeCues({ zones }: { zones: readonly AeroWakeZone[] }) {
  const cues = useMemo(
    () => [...zones].sort((left, right) => right.severity - left.severity).slice(0, 8),
    [zones],
  )
  return (
    <group name="component-wake-cues">
      {cues.map((zone) => (
        <mesh
          key={zone.id}
          name={zone.componentId}
          position={[zone.anchor[0] - zone.length * 0.5, zone.anchor[1], zone.anchor[2]]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <coneGeometry args={[zone.radius, zone.length, 9, 1, true]} />
          <meshBasicMaterial color="#a868ff" transparent opacity={0.025 + zone.severity * 0.075} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function FlowField({ spec, visible }: { spec: VehicleSpec; visible: boolean }) {
  const plan = useMemo(() => buildAeroFlowPlan(spec), [spec])
  if (!visible) return null
  return (
    <group name="surface-flow-v2-estimate-not-cfd">
      <WakeCues zones={plan.wakeZones} />
      {plan.streamlines.map((streamline) => <FlowStreamline key={streamline.id} streamline={streamline} />)}
      <FlowTracerField streamlines={plan.streamlines} />
      <PressureCues zones={plan.pressureZones} />
    </group>
  )
}

function ProceduralVehicle({ spec, mode, exploded, airflow }: { spec: VehicleSpec; mode: ViewMode; exploded: boolean; airflow: boolean }) {
  const profile = useMemo(() => getGeometryProfile(spec), [spec])
  const wheelX = spec.wheelbase / 2
  const frontZ = spec.frontTrack / 2
  const rearZ = spec.rearTrack / 2
  const wheelY = spec.wheelRadius
  const { bodyY, bodyLength, bodyWidth, bodyHeight } = profile
  const isFormula = spec.vehicleClass === 'formula'
  const isMonster = spec.vehicleClass === 'monster'
  const explode = exploded ? 1 : 0
  const showAero = !isFormula && !isMonster
    && (((spec.vehicleClass === 'gt' || spec.vehicleClass === 'rally') && spec.rearWing > 0.26)
    || (spec.frontWing > 0.28 && spec.rearWing > 0.38)
    )
  const aeroColor = spec.accentColor

  return (
    <group rotation={[0, -0.42, 0]}>
      <AnimatedPart target={[0, explode * 0.12, 0]}>
        {!isFormula && !isMonster && (
          <>
            <SilhouetteShell profile={profile} color={spec.bodyColor} mode={mode} />
            <CabinAndDetails profile={profile} spec={spec} mode={mode} />
            <PassengerBodyDetails profile={profile} spec={spec} mode={mode} />
          </>
        )}
        {profile.hasCargoBed && !isMonster && (
          <RoundedBox args={[spec.overallLength * 0.31, 0.35, bodyWidth * 0.98]} radius={0.04} smoothness={2} position={[spec.overallLength * 0.25, bodyY + 0.05, 0]} castShadow>
            <BodyMaterial color={spec.bodyColor} mode={mode} />
          </RoundedBox>
        )}
        {!isFormula && !isMonster && !showAero && (
          <>
            <RoundedBox args={[bodyLength * 0.19, 0.035, bodyWidth * 0.66]} radius={0.012} smoothness={2} position={[-bodyLength * 0.42, bodyY + bodyHeight * 0.42, 0]}>
              <meshStandardMaterial color={mode === 'blueprint' ? '#67dfff' : spec.accentColor} emissive={mode === 'blueprint' ? '#167f9e' : spec.accentColor} emissiveIntensity={0.25} wireframe={mode === 'wireframe'} />
            </RoundedBox>
            <RoundedBox args={[bodyLength * 0.12, 0.028, bodyWidth * 0.8]} radius={0.01} smoothness={2} position={[bodyLength * 0.46, bodyY - bodyHeight * 0.4, 0]}>
              <meshStandardMaterial color={mode === 'blueprint' ? '#55cae8' : '#17212a'} wireframe={mode === 'wireframe' || mode === 'blueprint'} metalness={0.65} roughness={0.3} />
            </RoundedBox>
          </>
        )}
        {!isFormula && !isMonster && (
          <>
            <WheelArch position={[wheelX, wheelY, frontZ]} radius={spec.wheelRadius} color={spec.bodyColor} mode={mode} />
            <WheelArch position={[wheelX, wheelY, -frontZ]} radius={spec.wheelRadius} color={spec.bodyColor} mode={mode} />
            <WheelArch position={[-wheelX, wheelY, rearZ]} radius={spec.wheelRadius} color={spec.bodyColor} mode={mode} />
            <WheelArch position={[-wheelX, wheelY, -rearZ]} radius={spec.wheelRadius} color={spec.bodyColor} mode={mode} />
          </>
        )}
      </AnimatedPart>

      {isFormula && <FormulaCar spec={spec} profile={profile} mode={mode} exploded={exploded} />}
      {isMonster && <MonsterTruck spec={spec} profile={profile} mode={mode} exploded={exploded} />}

      <AnimatedPart target={[wheelX * 0.14 * explode, 0, 0]}>
        {isMonster ? (
          <>
            <MonsterWheel position={[wheelX, wheelY, frontZ]} radius={spec.wheelRadius} width={spec.tireWidth} accent={spec.accentColor} mode={mode} />
            <MonsterWheel position={[wheelX, wheelY, -frontZ]} radius={spec.wheelRadius} width={spec.tireWidth} accent={spec.accentColor} mode={mode} />
          </>
        ) : isFormula ? (
          <>
            <FormulaWheel position={[wheelX, wheelY, frontZ]} radius={spec.wheelRadius} width={spec.tireWidth} accent={spec.accentColor} mode={mode} />
            <FormulaWheel position={[wheelX, wheelY, -frontZ]} radius={spec.wheelRadius} width={spec.tireWidth} accent={spec.accentColor} mode={mode} />
          </>
        ) : (
          <>
            <Wheel position={[wheelX, wheelY, frontZ]} radius={spec.wheelRadius} width={spec.tireWidth} mode={mode} />
            <Wheel position={[wheelX, wheelY, -frontZ]} radius={spec.wheelRadius} width={spec.tireWidth} mode={mode} />
          </>
        )}
      </AnimatedPart>
      <AnimatedPart target={[-wheelX * 0.14 * explode, 0, 0]}>
        {isMonster ? (
          <>
            <MonsterWheel position={[-wheelX, wheelY, rearZ]} radius={spec.wheelRadius} width={spec.tireWidth} accent={spec.accentColor} mode={mode} />
            <MonsterWheel position={[-wheelX, wheelY, -rearZ]} radius={spec.wheelRadius} width={spec.tireWidth} accent={spec.accentColor} mode={mode} />
          </>
        ) : isFormula ? (
          <>
            <FormulaWheel position={[-wheelX, wheelY, rearZ]} radius={spec.wheelRadius} width={spec.tireWidth} accent={spec.accentColor} mode={mode} />
            <FormulaWheel position={[-wheelX, wheelY, -rearZ]} radius={spec.wheelRadius} width={spec.tireWidth} accent={spec.accentColor} mode={mode} />
          </>
        ) : (
          <>
            <Wheel position={[-wheelX, wheelY, rearZ]} radius={spec.wheelRadius} width={spec.tireWidth} mode={mode} />
            <Wheel position={[-wheelX, wheelY, -rearZ]} radius={spec.wheelRadius} width={spec.tireWidth} mode={mode} />
          </>
        )}
      </AnimatedPart>

      {showAero && (
        <>
          <AnimatedPart target={[explode * 0.62, explode * 0.1, 0]}>
            <AeroWing position={[wheelX + 0.34, bodyY + 0.03, 0]} width={Math.max(spec.frontTrack * 1.1, 1.28)} chord={0.36 + spec.frontWing * 0.34} mode={mode} color={aeroColor} rotate={0.08} />
          </AnimatedPart>
          <AnimatedPart target={[-explode * 0.62, explode * 0.34, 0]}>
            <AeroWing position={[-wheelX - 0.35, bodyY + 0.38, 0]} width={Math.max(spec.rearTrack * 0.94, 1.14)} chord={0.32 + spec.rearWing * 0.33} mode={mode} color={aeroColor} rotate={-0.12} />
          </AnimatedPart>
        </>
      )}
      {!isFormula && !isMonster && (
        <AnimatedPart target={[0, -explode * 0.38, 0]}>
          <RoundedBox args={[spec.wheelbase * 0.65, 0.08 + spec.diffuserDepth * 0.35, bodyWidth * 0.72]} radius={0.02} smoothness={2} position={[-spec.wheelbase * 0.22, bodyY - 0.28, 0]}>
            <BodyMaterial color={aeroColor} mode={mode} />
          </RoundedBox>
        </AnimatedPart>
      )}

      <StructuralFrame spec={spec} mode={mode} />
      <FlowField spec={spec} visible={airflow} />
    </group>
  )
}

function StudioStage() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#17191d" roughness={0.68} metalness={0.18} />
      </mesh>
      <mesh position={[0, 6, -9]} receiveShadow>
        <planeGeometry args={[40, 16]} />
        <meshStandardMaterial color="#121417" roughness={0.92} />
      </mesh>
      <ContactShadows position={[0, 0.006, 0]} opacity={0.68} scale={14} blur={2.6} far={5} color="#000000" />
      <spotLight position={[5, 8, 5]} intensity={120} angle={0.48} penumbra={0.8} color="#fff2da" castShadow />
      <spotLight position={[-6, 4, -3]} intensity={70} angle={0.62} penumbra={0.92} color="#72c7ff" />
      <pointLight position={[0, 4, 7]} intensity={26} color="#f8b86e" />
    </>
  )
}

function Scene({ spec, viewMode, exploded, airflow, resetToken }: ViewportProps) {
  const orbit = useRef<React.ElementRef<typeof OrbitControls>>(null)
  useEffect(() => {
    orbit.current?.reset()
  }, [resetToken])
  const blueprint = viewMode === 'blueprint'
  const studio = viewMode === 'studio'
  const background = blueprint ? '#07121a' : studio ? '#111317' : '#090d13'
  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, studio ? 18 : 12, studio ? 38 : 31]} />
      <ambientLight intensity={studio ? 0.32 : blueprint ? 0.68 : 0.48} />
      <directionalLight position={[7, 9, 5]} intensity={studio ? 1.2 : blueprint ? 0.75 : 2.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      {!studio && <pointLight position={[-5, 3, -6]} color="#3ab4ff" intensity={1.1} />}
      {!studio && <pointLight position={[5, 2, 5]} color="#f0ad3d" intensity={0.6} />}
      {studio && <StudioStage />}
      <ProceduralVehicle spec={spec} mode={viewMode} exploded={exploded} airflow={airflow} />
      {!studio && <Grid
        position={[0, 0, 0]}
        args={[26, 26]}
        cellSize={0.5}
        cellThickness={0.45}
        cellColor={blueprint ? '#15506a' : '#17212d'}
        sectionSize={2.5}
        sectionThickness={0.8}
        sectionColor={blueprint ? '#2ea6c9' : '#2a394a'}
        fadeDistance={19}
        fadeStrength={1.2}
        infiniteGrid
      />}
      <OrbitControls ref={orbit} enablePan={false} minDistance={4.2} maxDistance={18} enableDamping dampingFactor={0.08} target={[0, 1.1, 0]} />
    </>
  )
}

export function VehicleViewport({ spec, viewMode, exploded, airflow, resetToken }: ViewportProps) {
  return (
    <Canvas
      className="vehicle-canvas"
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [7.4, 4.1, 7.4], fov: 42 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Scene spec={spec} viewMode={viewMode} exploded={exploded} airflow={airflow} resetToken={resetToken} />
    </Canvas>
  )
}
