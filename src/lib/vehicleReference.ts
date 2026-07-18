import type { VehicleSpec } from '../types'
import { getGeometryProfile } from './vehicleGeometry'
import { getRequiredComponents, getVehicleKnowledgePack } from './vehicleKnowledge'

const cyan = '#72e7de'
const dim = '#6d9fad'
const ink = '#061016'

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = cyan, width = 2) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

function dimension(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, label: string) {
  line(ctx, x1, y, x2, y, dim, 1)
  line(ctx, x1, y - 6, x1, y + 6, dim, 1)
  line(ctx, x2, y - 6, x2, y + 6, dim, 1)
  ctx.fillStyle = '#b5dce0'
  ctx.font = '600 12px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(label, (x1 + x2) / 2, y - 8)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number) {
  const words = text.split(' ')
  let row = ''
  let cursor = y
  for (const word of words) {
    const next = row ? `${row} ${word}` : word
    if (ctx.measureText(next).width > width && row) {
      ctx.fillText(row, x, cursor)
      row = word
      cursor += lineHeight
    } else row = next
  }
  if (row) ctx.fillText(row, x, cursor)
  return cursor
}

function drawEndView(
  ctx: CanvasRenderingContext2D,
  frame: { x: number; y: number; width: number; height: number },
  spec: VehicleSpec,
  rear: boolean,
) {
  const profile = getGeometryProfile(spec)
  ctx.strokeStyle = '#23515c'
  ctx.lineWidth = 1
  ctx.strokeRect(frame.x, frame.y, frame.width, frame.height)
  const track = rear ? spec.rearTrack : spec.frontTrack
  const maxWidth = Math.max(track * 1.15, spec.overallWidth * 0.75)
  const maxHeight = profile.bodyY + profile.bodyHeight * 0.58 + profile.cabin.y + profile.cabin.height * 0.35
  const scale = Math.min((frame.width - 76) / maxWidth, (frame.height - 64) / Math.max(maxHeight, 0.5))
  const centerX = frame.x + frame.width / 2
  const groundY = frame.y + frame.height - 32
  const x = (z: number) => centerX + z * scale
  const y = (height: number) => groundY - height * scale
  const bodyWidth = profile.bodyWidth * 0.56
  const bodyTop = profile.bodyY + profile.bodyHeight * 0.52
  ctx.beginPath()
  ctx.moveTo(x(-bodyWidth), y(profile.bodyY - profile.bodyHeight * 0.45))
  ctx.lineTo(x(-bodyWidth * 0.76), y(bodyTop))
  ctx.lineTo(x(bodyWidth * 0.76), y(bodyTop))
  ctx.lineTo(x(bodyWidth), y(profile.bodyY - profile.bodyHeight * 0.45))
  ctx.closePath()
  ctx.fillStyle = `${spec.bodyColor}55`
  ctx.fill()
  ctx.strokeStyle = cyan
  ctx.lineWidth = 2.5
  ctx.stroke()
  for (const z of [-track / 2, track / 2]) {
    ctx.beginPath()
    ctx.arc(x(z), y(spec.wheelRadius), spec.wheelRadius * scale, 0, Math.PI * 2)
    ctx.strokeStyle = '#d9f5f2'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  if (spec.vehicleClass === 'formula') {
    const wingY = rear ? bodyTop + 0.13 : profile.bodyY - profile.bodyHeight * 0.16
    line(ctx, x(-track * (rear ? 0.57 : 0.62)), y(wingY), x(track * (rear ? 0.57 : 0.62)), y(wingY), '#b8fff7', 4)
    line(ctx, x(-track * 0.4), y(bodyTop + 0.18), x(track * 0.4), y(bodyTop + 0.18), dim, 2)
    if (rear) {
      line(ctx, x(-bodyWidth * 0.55), y(profile.bodyY - profile.bodyHeight * 0.32), x(bodyWidth * 0.55), y(profile.bodyY - profile.bodyHeight * 0.32), '#7fe9d5', 2)
      ctx.fillStyle = '#ff5c46'
      ctx.fillRect(centerX - 4, y(profile.bodyY - profile.bodyHeight * 0.17), 8, 8)
    }
  }
  ctx.fillStyle = cyan
  ctx.font = '700 12px monospace'
  ctx.textAlign = 'left'
  ctx.fillText(rear ? 'REAR ELEVATION' : 'FRONT ELEVATION', frame.x + 16, frame.y + 23)
  dimension(ctx, x(-track / 2), x(track / 2), frame.y + frame.height - 12, `${Math.round(track * 1000)} mm TRACK`)
}

/**
 * Renders a compact technical reference from the exact procedural recipe.
 * It is only used as an image-to-image guide for the photo renderer; the AI
 * never receives editable mesh data.
 */
export function createGeometryReferenceImage(spec: VehicleSpec): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 930
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create the geometry reference sheet')

  const profile = getGeometryProfile(spec)
  const knowledgePack = getVehicleKnowledgePack(spec.vehicleClass)
  const requiredSystems = getRequiredComponents(spec).map((component) => component.label).slice(0, 12).join('  /  ')
  ctx.fillStyle = ink
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#163640'
  ctx.lineWidth = 1
  for (let x = 0; x < canvas.width; x += 32) line(ctx, x, 72, x, canvas.height - 32, '#0e2730', 1)
  for (let y = 72; y < canvas.height; y += 32) line(ctx, 32, y, canvas.width - 32, y, '#0e2730', 1)

  ctx.fillStyle = '#e8fffb'
  ctx.font = '700 18px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('AETHER  //  PHOTO GEOMETRY LOCK', 40, 42)
  ctx.fillStyle = cyan
  ctx.font = '600 12px monospace'
  ctx.fillText(`${profile.recipe.toUpperCase()}  ·  ${knowledgePack.title.toUpperCase()}  ·  ALL DIMENSIONS IN MILLIMETRES`, 40, 62)

  const side = { x: 58, y: 110, width: 700, height: 390 }
  const top = { x: 810, y: 110, width: 390, height: 390 }
  ctx.strokeStyle = '#23515c'
  ctx.strokeRect(side.x, side.y, side.width, side.height)
  ctx.strokeRect(top.x, top.y, top.width, top.height)

  const bodyTop = profile.bodyY + Math.max(profile.bodyHeight * 0.58, profile.cabin.y + profile.cabin.height * 0.55) + 0.28
  const xSpan = Math.max(spec.overallLength, profile.bodyLength, spec.wheelbase + spec.wheelRadius * 1.8)
  const sideScale = Math.min((side.width - 72) / xSpan, (side.height - 96) / Math.max(bodyTop, 1))
  const sideCenterX = side.x + side.width / 2
  const groundY = side.y + side.height - 52
  const sideX = (x: number) => sideCenterX + x * sideScale
  const sideY = (y: number) => groundY - y * sideScale

  ctx.setLineDash([5, 7])
  line(ctx, side.x + 24, groundY, side.x + side.width - 24, groundY, '#375661', 1)
  ctx.setLineDash([])
  ctx.beginPath()
  profile.contour.forEach(([relativeX, relativeY], index) => {
    const x = sideX(relativeX * profile.bodyLength)
    const y = sideY(profile.bodyY + relativeY * profile.bodyHeight)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.fillStyle = `${spec.bodyColor}55`
  ctx.fill()
  ctx.strokeStyle = cyan
  ctx.lineWidth = 3
  ctx.stroke()

  const cabinX = sideX(profile.cabin.x)
  const cabinY = sideY(profile.bodyY + profile.cabin.y)
  const cabinWidth = profile.cabin.length * sideScale
  const cabinHeight = profile.cabin.height * sideScale
  ctx.save()
  ctx.translate(cabinX, cabinY)
  ctx.rotate(-profile.cabin.tilt)
  ctx.strokeStyle = '#b8fff7'
  ctx.lineWidth = 2
  ctx.strokeRect(-cabinWidth / 2, -cabinHeight / 2, cabinWidth, cabinHeight)
  ctx.restore()

  const wheelX = spec.wheelbase / 2
  for (const x of [-wheelX, wheelX]) {
    ctx.beginPath()
    ctx.arc(sideX(x), sideY(spec.wheelRadius), spec.wheelRadius * sideScale, 0, Math.PI * 2)
    ctx.strokeStyle = '#d9f5f2'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(sideX(x), sideY(spec.wheelRadius), spec.wheelRadius * sideScale * 0.54, 0, Math.PI * 2)
    ctx.strokeStyle = dim
    ctx.lineWidth = 1.5
    ctx.stroke()
    line(ctx, sideX(x), sideY(0), sideX(x), sideY(bodyTop + 0.07), '#3b6d75', 1)
  }

  dimension(ctx, sideX(-wheelX), sideX(wheelX), side.y + side.height - 20, `WHEELBASE  ${Math.round(spec.wheelbase * 1000)} mm`)
  dimension(ctx, sideX(-spec.overallLength / 2), sideX(spec.overallLength / 2), side.y + side.height + 28, `OVERALL LENGTH  ${Math.round(spec.overallLength * 1000)} mm`)
  ctx.fillStyle = cyan
  ctx.font = '700 12px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('SIDE ELEVATION', side.x + 16, side.y + 24)

  const topScale = Math.min((top.width - 60) / spec.overallLength, (top.height - 92) / spec.overallWidth)
  const topCenterX = top.x + top.width / 2
  const topCenterY = top.y + top.height / 2
  const topX = (x: number) => topCenterX + x * topScale
  const topY = (z: number) => topCenterY + z * topScale
  const halfBodyLength = profile.bodyLength / 2
  const halfBodyWidth = profile.bodyWidth / 2
  ctx.beginPath()
  ctx.moveTo(topX(-halfBodyLength), topY(-halfBodyWidth * 0.72))
  ctx.lineTo(topX(halfBodyLength * 0.78), topY(-halfBodyWidth))
  ctx.lineTo(topX(halfBodyLength), topY(0))
  ctx.lineTo(topX(halfBodyLength * 0.78), topY(halfBodyWidth))
  ctx.lineTo(topX(-halfBodyLength), topY(halfBodyWidth * 0.72))
  ctx.closePath()
  ctx.fillStyle = `${spec.bodyColor}55`
  ctx.fill()
  ctx.strokeStyle = cyan
  ctx.lineWidth = 3
  ctx.stroke()
  const cabinTopLength = profile.cabin.length * topScale
  const cabinTopWidth = profile.cabin.width * topScale
  ctx.strokeStyle = '#b8fff7'
  ctx.lineWidth = 2
  ctx.strokeRect(topX(profile.cabin.x) - cabinTopLength / 2, topY(0) - cabinTopWidth / 2, cabinTopLength, cabinTopWidth)
  for (const [x, z] of [[-wheelX, -spec.rearTrack / 2], [-wheelX, spec.rearTrack / 2], [wheelX, -spec.frontTrack / 2], [wheelX, spec.frontTrack / 2]]) {
    ctx.fillStyle = '#0c161c'
    ctx.strokeStyle = '#d9f5f2'
    ctx.lineWidth = 2
    ctx.fillRect(topX(x) - spec.wheelRadius * topScale * 0.42, topY(z) - spec.tireWidth * topScale / 2, spec.wheelRadius * topScale * 0.84, spec.tireWidth * topScale)
    ctx.strokeRect(topX(x) - spec.wheelRadius * topScale * 0.42, topY(z) - spec.tireWidth * topScale / 2, spec.wheelRadius * topScale * 0.84, spec.tireWidth * topScale)
  }
  dimension(ctx, topX(-spec.overallLength / 2), topX(spec.overallLength / 2), top.y + top.height - 18, `${Math.round(spec.overallLength * 1000)} mm`)
  ctx.fillStyle = cyan
  ctx.font = '700 12px monospace'
  ctx.fillText('PLAN VIEW', top.x + 16, top.y + 24)

  ctx.fillStyle = '#99cbd0'
  ctx.font = '600 12px monospace'
  ctx.textAlign = 'left'
  drawEndView(ctx, { x: 58, y: 560, width: 520, height: 235 }, spec, false)
  drawEndView(ctx, { x: 680, y: 560, width: 520, height: 235 }, spec, true)

  const footer = `${Math.round(spec.overallWidth * 1000)} mm W  ·  ${Math.round(spec.overallHeight * 1000)} mm H  ·  ${Math.round(spec.frontTrack * 1000)} / ${Math.round(spec.rearTrack * 1000)} mm TRACK  ·  ${Math.round(spec.wheelRadius * 2000)} mm WHEEL Ø  ·  ${Math.round(spec.rideHeight * 1000)} mm RIDE HEIGHT`
  ctx.fillStyle = '#89c7c4'
  ctx.font = '600 11px monospace'
  wrap(ctx, `REQUIRED SYSTEMS: ${requiredSystems}`, 58, 826, 1140, 17)
  wrap(ctx, footer, 58, 878, 1140, 18)
  ctx.fillStyle = '#4d7e85'
  ctx.font = '500 11px monospace'
  ctx.fillText('REFERENCE USE: PRESERVE SHAPE, PROPORTIONS, AND REQUIRED SYSTEMS. RENDER AS A PHOTOREAL CAR, NOT AS THIS DRAWING.', 58, 916)

  return canvas.toDataURL('image/png')
}
