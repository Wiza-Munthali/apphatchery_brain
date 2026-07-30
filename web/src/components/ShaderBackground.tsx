import { useEffect, useRef } from 'react'

const VERTEX_SRC = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

// Soft gradient with slow-drifting brand navy/orange blobs, ambient rather
// than distracting. Follows the OS/browser color scheme (uDark uniform) so
// it stays a backdrop instead of washing out theme-aware text sitting on it —
// near-white base in light mode, near-black in dark mode (matching the
// design system's own --color-background-body dark value, #1b1b1b).
const FRAGMENT_SRC = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDark;

// Brand palette — dark-mode variants are lightened/desaturated slightly so
// they still read against a near-black base instead of disappearing into it.
const vec3 navyLight = vec3(0.106, 0.298, 0.510);   // #1b4c82
const vec3 navyDark = vec3(0.290, 0.470, 0.700);
const vec3 orangeLight = vec3(0.961, 0.573, 0.118); // #f5921e
const vec3 orangeDark = vec3(0.980, 0.650, 0.280);
const vec3 baseLight = vec3(0.976, 0.980, 0.992);   // near-white
const vec3 baseDark = vec3(0.106, 0.106, 0.106);    // #1b1b1b

float blob(vec2 p, vec2 center, float radius) {
  return smoothstep(radius, 0.0, length(p - center));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uResolution.x / uResolution.y;

  float t = uTime * 0.05;

  vec3 navy = mix(navyLight, navyDark, uDark);
  vec3 orange = mix(orangeLight, orangeDark, uDark);
  vec3 base = mix(baseLight, baseDark, uDark);
  // Dark backgrounds need slightly stronger blobs to read at the same visual weight.
  float strength = mix(1.0, 1.3, uDark);

  // Five soft blobs loosely ringed around the center, each drifting slowly
  // on its own phase so the color spots feel alive without being busy.
  vec2 c1 = vec2(-1.0,  0.65) + 0.16 * vec2(sin(t * 1.00),        cos(t * 0.80));
  vec2 c2 = vec2( 1.05, 0.60) + 0.16 * vec2(cos(t * 0.90 + 1.0),  sin(t * 1.10 + 0.5));
  vec2 c3 = vec2(-1.05,-0.60) + 0.16 * vec2(sin(t * 0.70 + 2.0),  cos(t * 0.60 + 1.5));
  vec2 c4 = vec2( 1.00,-0.65) + 0.16 * vec2(cos(t * 0.85 + 3.0),  sin(t * 0.75 + 2.5));
  vec2 c5 = vec2( 0.0,  1.10) + 0.16 * vec2(sin(t * 0.60 + 4.0),  cos(t * 0.65 + 3.5));

  float b1 = blob(p, c1, 0.85) * 0.16 * strength;
  float b2 = blob(p, c2, 0.80) * 0.14 * strength;
  float b3 = blob(p, c3, 0.90) * 0.15 * strength;
  float b4 = blob(p, c4, 0.78) * 0.13 * strength;
  float b5 = blob(p, c5, 0.75) * 0.12 * strength;

  vec3 color = base;
  color = mix(color, navy, b1);
  color = mix(color, orange, b2);
  color = mix(color, navy, b3);
  color = mix(color, orange, b4);
  color = mix(color, orange, b5);

  gl_FragColor = vec4(color, 1.0);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export function ShaderBackground({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')
    if (!gl || !(gl instanceof WebGLRenderingContext)) return

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC)
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC)
    if (!vertexShader || !fragmentShader) return

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )

    const aPosition = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(aPosition)
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

    const uResolution = gl.getUniformLocation(program, 'uResolution')
    const uTime = gl.getUniformLocation(program, 'uTime')
    const uDark = gl.getUniformLocation(program, 'uDark')

    const darkMode = window.matchMedia('(prefers-color-scheme: dark)')

    let animationFrame: number
    let startTime: number | null = null

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = canvas.clientWidth * dpr
      const height = canvas.clientHeight * dpr
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
    }

    const render = (time: number) => {
      if (startTime === null) startTime = time
      resize()
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uTime, (time - startTime) / 1000)
      gl.uniform1f(uDark, darkMode.matches ? 1.0 : 0.0)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      animationFrame = requestAnimationFrame(render)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    animationFrame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteBuffer(positionBuffer)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  )
}
