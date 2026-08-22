import type { FAState, FATransition } from '../hooks/useAutomaton'
import { FINAL_GAP, STATE_R } from '../hooks/useAutomaton'

interface ExportModel {
  name: string
  states: FAState[]
  transitions: FATransition[]
  initialId: string | null
}

const CURVE_OFF = 32
const LOOP_R = 46
const MARGIN = 110

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function norm(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy) || 1
  return [dx / len, dy / len]
}

// Kept in step with DiagramCanvas: a self-loop is the major arc of a circle
// that overlaps the state, and `curve` carries that circle's radius.
function transitionPath(
  from: FAState,
  to: FAState,
  isTwin: boolean,
  isForward: boolean,
  curve?: number
) {
  if (from.id === to.id) {
    const r = Math.min(
      STATE_R * 4,
      Math.max(20, curve ?? LOOP_R)
    )

    const dist = STATE_R + r * 0.55

    const a =
      (dist * dist +
        STATE_R * STATE_R -
        r * r) /
      (2 * dist)

    const half = Math.sqrt(
      Math.max(
        STATE_R * STATE_R - a * a,
        1
      )
    )

    const ay = from.y - a
    const topY = from.y - dist - r

    return {
      d: `M ${from.x - half},${ay} A ${r} ${r} 0 1 1 ${from.x + half},${ay}`,
      lx: from.x,
      ly: topY - 12,
      extra: [
        { x: from.x - r, y: topY },
        { x: from.x + r, y: topY },
      ],
    }
  }

  const dx = to.x - from.x
  const dy = to.y - from.y
  const [ux, uy] = norm(dx, dy)
  const [px, py] = [-uy, ux]

  if (curve === undefined && !isTwin) {
    const x1 = from.x + ux * STATE_R
    const y1 = from.y + uy * STATE_R
    const x2 = to.x - ux * STATE_R
    const y2 = to.y - uy * STATE_R

    return {
      d: `M ${x1},${y1} L ${x2},${y2}`,
      lx: (x1 + x2) / 2 + px * -14,
      ly: (y1 + y2) / 2 + py * -14,
      extra: [] as { x: number; y: number }[],
    }
  }

  // A hand-dragged bend is stored along the canonical (lower id → higher id)
  // perpendicular, so mirror the canvas and read it from that direction rather
  // than from this edge's own from→to orientation.
  const sign = isForward ? 1 : -1

  const [cux, cuy] = isForward
    ? [ux, uy]
    : [-ux, -uy]

  const [cpxUnit, cpyUnit] = [-cuy, cux]

  const bend =
    curve ?? CURVE_OFF * sign

  const cpx =
    (from.x + to.x) / 2 +
    cpxUnit * bend
  const cpy =
    (from.y + to.y) / 2 +
    cpyUnit * bend

  const [fd0, fd1] = norm(
    cpx - from.x,
    cpy - from.y
  )

  const [td0, td1] = norm(
    to.x - cpx,
    to.y - cpy
  )

  const x1 = from.x + fd0 * STATE_R
  const y1 = from.y + fd1 * STATE_R
  const x2 = to.x - td0 * STATE_R
  const y2 = to.y - td1 * STATE_R

  const bx =
    0.25 * x1 +
    0.5 * cpx +
    0.25 * x2

  const by =
    0.25 * y1 +
    0.5 * cpy +
    0.25 * y2

  const [nx, ny] =
    bend > 0
      ? [cpxUnit, cpyUnit]
      : bend < 0
        ? [-cpxUnit, -cpyUnit]
        : [-px, -py]

  return {
    d: `M ${x1},${y1} Q ${cpx},${cpy} ${x2},${y2}`,
    lx: bx + nx * 14,
    ly: by + ny * 14,
    extra: [{ x: cpx, y: cpy }],
  }
}

function bounds(model: ExportModel) {
  if (!model.states.length) return null

  const xs: number[] = []
  const ys: number[] = []

  for (const st of model.states) {
    const r =
      STATE_R +
      (st.isFinal ? FINAL_GAP : 0)

    xs.push(st.x - r, st.x + r)
    ys.push(st.y - r, st.y + r)

    if (st.id === model.initialId) {
      xs.push(st.x - STATE_R - 30)
    }
  }

  for (const t of model.transitions) {
    const from = model.states.find(
      st => st.id === t.fromId
    )

    const to = model.states.find(
      st => st.id === t.toId
    )

    if (!from || !to) continue

    const isTwin = model.transitions.some(
      r =>
        r.id !== t.id &&
        r.fromId === t.toId &&
        r.toId === t.fromId
    )

    const isForward =
      !isTwin || t.fromId < t.toId

    const p = transitionPath(
      from,
      to,
      isTwin,
      isForward,
      t.curve
    )

    xs.push(
      p.lx,
      ...p.extra.map(q => q.x)
    )

    ys.push(
      p.ly,
      ...p.extra.map(q => q.y)
    )
  }

  const minX =
    Math.min(...xs) - MARGIN

  const minY =
    Math.min(...ys) - MARGIN

  const maxX =
    Math.max(...xs) + MARGIN

  const maxY =
    Math.max(...ys) + MARGIN

  return {
    minX,
    minY,
    width: Math.max(
      1,
      maxX - minX
    ),
    height: Math.max(
      1,
      maxY - minY
    ),
  }
}

export function buildAutomatonSvg(
  model: ExportModel
): string {
  const b = bounds(model)

  if (!b) {
    throw new Error(
      'There are no states to export.'
    )
  }

  const markers = `
    <defs>
      <marker
        id="arrow"
        markerWidth="8"
        markerHeight="7"
        refX="7"
        refY="3.5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path
          d="M0,0.5 L0,6.5 L7.5,3.5 z"
          fill="#6B6459"
        />
      </marker>
    </defs>
  `

  const transitions =
    model.transitions
      .map(t => {
        const from =
          model.states.find(
            st => st.id === t.fromId
          )

        const to =
          model.states.find(
            st => st.id === t.toId
          )

        if (!from || !to) return ''

        const isTwin =
          model.transitions.some(
            r =>
              r.id !== t.id &&
              r.fromId === t.toId &&
              r.toId === t.fromId
          )

        const isForward =
          !isTwin || t.fromId < t.toId

        const p = transitionPath(
          from,
          to,
          isTwin,
          isForward,
          t.curve
        )

        return `
          <path
            d="${p.d}"
            stroke="#C8C3BA"
            stroke-width="1.8"
            fill="none"
            marker-end="url(#arrow)"
          />

          <text
            x="${p.lx}"
            y="${p.ly}"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="14"
            font-family="JetBrains Mono, monospace"
            fill="#6B6459"
          >${esc(t.label)}</text>
        `
      })
      .join('')

  const states =
    model.states
      .map(st => {
        const final = st.isFinal
          ? `
            <circle
              cx="${st.x}"
              cy="${st.y}"
              r="${STATE_R + FINAL_GAP}"
              fill="none"
              stroke="#6B6459"
              stroke-width="1.8"
            />
          `
          : ''

        const initial =
          st.id === model.initialId
            ? `
              <line
                x1="${st.x - STATE_R - 34}"
                y1="${st.y}"
                x2="${st.x - STATE_R - 2}"
                y2="${st.y}"
                stroke="#6B6459"
                stroke-width="1.8"
              />

              <path
                d="
                  M${st.x - STATE_R - 11},${st.y - 6}
                  L${st.x - STATE_R - 2},${st.y}
                  L${st.x - STATE_R - 11},${st.y + 6}
                "
                fill="none"
                stroke="#6B6459"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            `
            : ''

        return `
          ${final}

          <circle
            cx="${st.x}"
            cy="${st.y}"
            r="${STATE_R}"
            fill="#FFFFFF"
            stroke="#6B6459"
            stroke-width="1.8"
          />

          <text
            x="${st.x}"
            y="${st.y}"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="22"
            font-family="Inter, Arial, sans-serif"
            font-weight="600"
            fill="#1A1814"
          >${esc(st.label)}</text>

          ${initial}
        `
      })
      .join('')

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${b.width}"
      height="${b.height}"
      viewBox="${b.minX} ${b.minY} ${b.width} ${b.height}"
    >
      ${markers}
      <g>
        ${transitions}
        ${states}
      </g>
    </svg>
  `
}

async function svgToCanvas(
  svgText: string,
  width: number,
  height: number,
  scale: number,
  background?: string
): Promise<HTMLCanvasElement> {
  const canvas =
    document.createElement('canvas')

  canvas.width =
    Math.ceil(width * scale)

  canvas.height =
    Math.ceil(height * scale)

  const ctx =
    canvas.getContext('2d')

  if (!ctx) {
    throw new Error(
      'Canvas is not available in this browser.'
    )
  }

  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    )
  }

  const blob = new Blob(
    [svgText],
    {
      type: 'image/svg+xml;charset=utf-8',
    }
  )

  const url =
    URL.createObjectURL(blob)

  try {
    const image = new Image()

    image.decoding = 'async'

    await new Promise<void>(
      (resolve, reject) => {
        image.onload = () =>
          resolve()

        image.onerror = () =>
          reject(
            new Error(
              'Could not render the automaton image.'
            )
          )

        image.src = url
      }
    )

    ctx.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    )
  } finally {
    URL.revokeObjectURL(url)
  }

  return canvas
}

function downloadBlob(
  blob: Blob,
  filename: string
) {
  const url =
    URL.createObjectURL(blob)

  const a =
    document.createElement('a')

  a.href = url
  a.download = filename

  document.body.appendChild(a)
  a.click()
  a.remove()

  setTimeout(
    () => URL.revokeObjectURL(url),
    0
  )
}

export function downloadAutomatonJson(
  model: ExportModel
) {
  const payload = {
    name: model.name,
    states: model.states,
    transitions: model.transitions,
    initialId: model.initialId,
  }

  downloadBlob(
    new Blob(
      [
        JSON.stringify(
          payload,
          null,
          2
        ),
      ],
      {
        type: 'application/json',
      }
    ),
    `${model.name || 'automaton'}.json`
  )
}

export async function downloadAutomatonPng(
  model: ExportModel
) {
  const b = bounds(model)

  if (!b) {
    throw new Error(
      'There are no states to export.'
    )
  }

  const svg =
    buildAutomatonSvg(model)

  const canvas =
    await svgToCanvas(
      svg,
      b.width,
      b.height,
      3
    )

  const blob =
    await new Promise<Blob | null>(
      resolve =>
        canvas.toBlob(
          resolve,
          'image/png'
        )
    )

  if (!blob) {
    throw new Error(
      'Could not create the PNG export.'
    )
  }

  downloadBlob(
    blob,
    `${model.name || 'automaton'}.png`
  )
}

function base64ToBytes(
  dataUrl: string
): Uint8Array {
  const base64 =
    dataUrl.split(',')[1] ?? ''

  const binary = atob(base64)

  const bytes =
    new Uint8Array(binary.length)

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i)
  }

  return bytes
}

function buildJpegPdf(
  jpeg: Uint8Array,
  imageWidth: number,
  imageHeight: number
): Uint8Array {
  const pageW = 841.89
  const pageH = 595.28
  const margin = 28

  const scale = Math.min(
    (pageW - margin * 2) /
      imageWidth,

    (pageH - margin * 2) /
      imageHeight
  )

  const drawW =
    imageWidth * scale

  const drawH =
    imageHeight * scale

  const x =
    (pageW - drawW) / 2

  const y =
    (pageH - drawH) / 2

  const encoder =
    new TextEncoder()

  const chunks: Uint8Array[] = []

  const offsets: number[] = [0]

  let length = 0

  const push = (
    data: Uint8Array | string
  ) => {
    const bytes =
      typeof data === 'string'
        ? encoder.encode(data)
        : data

    chunks.push(bytes)
    length += bytes.length
  }

  push(
    '%PDF-1.4\n%âãÏÓ\n'
  )

  const object = (
    id: number,
    body: string | Uint8Array
  ) => {
    offsets[id] = length

    push(`${id} 0 obj\n`)
    push(body)
    push('\nendobj\n')
  }

  object(
    1,
    '<< /Type /Catalog /Pages 2 0 R >>'
  )

  object(
    2,
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'
  )

  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  )

  offsets[4] = length

  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  )

  push(jpeg)

  push(
    '\nendstream\nendobj\n'
  )

  const content =
    `q\n${drawW} 0 0 ${drawH} ${x} ${y} cm\n/Im0 Do\nQ\n`

  object(
    5,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`
  )

  const xref = length

  push(
    'xref\n0 6\n0000000000 65535 f \n'
  )

  for (let i = 1; i <= 5; i++) {
    push(
      `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
    )
  }

  push(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  )

  const out =
    new Uint8Array(length)

  let offset = 0

  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }

  return out
}

export async function downloadAutomatonPdf(
  model: ExportModel
) {
  const b = bounds(model)

  if (!b) {
    throw new Error(
      'There are no states to export.'
    )
  }

  const svg =
    buildAutomatonSvg(model)

  const canvas =
    await svgToCanvas(
      svg,
      b.width,
      b.height,
      3,
      '#FFFFFF'
    )

  const jpeg =
    base64ToBytes(
      canvas.toDataURL(
        'image/jpeg',
        0.95
      )
    )

  const pdf =
    buildJpegPdf(
      jpeg,
      canvas.width,
      canvas.height
    )

  // Cloudflare/TypeScript puede inferir pdf.buffer como
  // ArrayBufferLike (que incluye SharedArrayBuffer), mientras
  // que BlobPart requiere un ArrayBuffer compatible.
  // Creamos un ArrayBuffer nuevo para garantizar compatibilidad.
  const pdfBuffer =
    new ArrayBuffer(pdf.byteLength)

  new Uint8Array(pdfBuffer).set(pdf)

  downloadBlob(
    new Blob(
      [pdfBuffer],
      {
        type: 'application/pdf',
      }
    ),
    `${model.name || 'automaton'}.pdf`
  )
}
