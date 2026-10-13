/**
 * hero-scene.js
 * -----------------------------------------------------------------------------
 * Hero WebGL scene for the "Manuel — Web Developer" landing page.
 *
 * A drifting constellation: one Points cloud + one LineSegments graph, both
 * animated entirely on the GPU with a shared vertex displacement so the edges
 * always stay attached to their particles. The glow is produced with additive
 * blending + soft point sprites — no post-processing / bloom pass.
 *
 * Progressive enhancement:
 *   - If WebGL is unavailable, the module throws early -> the static
 *     `hero-visual.svg` stays in place.
 *   - If `prefers-reduced-motion: reduce` is active, the scene is never built
 *     (and is torn down if the preference turns on at runtime).
 *   - The `<canvas>` is decorative (`aria-hidden`), `pointer-events: none`
 *     and never focusable, so it cannot steal text selection or keyboard nav.
 *
 * Shipped as a plain, unbundled ES module (no build step, CSP `script-src 'self'`).
 * Three.js is pulled in with a dynamic import only when the scene will actually
 * run, so reduced-motion / no-WebGL / Save-Data visitors never download it.
 */

/* -------------------------------------------------------------------------- */
/* Shared GLSL                                                                 */
/* -------------------------------------------------------------------------- */

// Used by both the point and line vertex shaders. Because the displacement is a
// pure function of the *base* position + time, shared edges remain connected.
const SHARED_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uNear;
  uniform float uFar;

  vec3 heroDisplace(vec3 p) {
    float phase = dot(p, vec3(1.7, 2.3, 1.1));
    float a = sin(uTime * 0.55 + phase);
    float b = cos(uTime * 0.42 + phase * 1.31);
    float c = sin(uTime * 0.68 + phase * 0.73);
    return vec3(a, b, c) * uAmp;
  }

  float heroDepthFade(float viewDist) {
    return clamp((uFar - viewDist) / (uFar - uNear), 0.0, 1.0);
  }
`

const POINTS_VERT = /* glsl */ `
  ${SHARED_GLSL}
  attribute float aScale;
  attribute float aSeed;
  attribute float aMix;

  uniform float uSize;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vFade;
  varying float vTwinkle;

  void main() {
    vec3 base = position + heroDisplace(position);
    vec4 mv = modelViewMatrix * vec4(base, 1.0);
    gl_Position = projectionMatrix * mv;

    float viewDist = -mv.z;
    // Perspective size attenuation, normalised to the reference camera distance.
    float pointSize = uSize * aScale * uPixelRatio * (16.0 / max(viewDist, 0.001));
    gl_PointSize = clamp(pointSize, 0.5, 64.0);

    vColor = mix(uColorA, uColorB, aMix);
    vFade = heroDepthFade(viewDist);
    vTwinkle = 0.65 + 0.35 * sin(uTime * (0.7 + aSeed * 0.9) + aSeed * 6.2831853);
  }
`

const POINTS_FRAG = /* glsl */ `
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vFade;
  varying float vTwinkle;

  void main() {
    // Soft radial sprite: squared distance avoids a sqrt, kept cheap on mobile.
    vec2 uv = gl_PointCoord - 0.5;
    float d = dot(uv, uv);
    float alpha = 1.0 - smoothstep(0.0, 0.25, d);
    alpha *= alpha;
    gl_FragColor = vec4(vColor, alpha * vFade * vTwinkle * uOpacity);
  }
`

const LINES_VERT = /* glsl */ `
  ${SHARED_GLSL}
  attribute float aAlpha;
  attribute float aMix;

  varying vec3 vColor;
  varying float vFade;
  varying float vAlpha;

  void main() {
    vec3 base = position + heroDisplace(position);
    vec4 mv = modelViewMatrix * vec4(base, 1.0);
    gl_Position = projectionMatrix * mv;

    vColor = mix(uColorA, uColorB, aMix);
    vFade = heroDepthFade(-mv.z);
    vAlpha = aAlpha;
  }
`

const LINES_FRAG = /* glsl */ `
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vFade;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(vColor, vAlpha * vFade * uOpacity);
  }
`

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function supportsWebGL() {
  try {
    const test = document.createElement('canvas')
    const gl =
      test.getContext('webgl2') ||
      test.getContext('webgl') ||
      test.getContext('experimental-webgl')
    if (!gl) return false
    // Release the throwaway context immediately.
    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose) lose.loseContext()
    return true
  } catch (_) {
    return false
  }
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value
}

// Debug surface is opt-in: `?heroDebug` or a local origin. Never shipped enabled.
function isDebugEnabled() {
  try {
    if (new URLSearchParams(window.location.search).has('heroDebug')) return true
    const host = window.location.hostname
    return host === 'localhost' || host === '127.0.0.1' || host === ''
  } catch (_) {
    return false
  }
}

// Optional permanent quality lock: `?heroQuality=0|1|2`. `auto` / absent = tuner.
function qualityLockFromQuery() {
  try {
    const raw = new URLSearchParams(window.location.search).get('heroQuality')
    if (raw === null || raw === '' || raw === 'auto') return null
    const value = Number.parseInt(raw, 10)
    return Number.isNaN(value) ? null : clamp(value, 0, 2)
  } catch (_) {
    return null
  }
}

// Force the static hero visual: `?heroStatic` (handy for previews / comparisons).
function isStaticForced() {
  try {
    return new URLSearchParams(window.location.search).has('heroStatic')
  } catch (_) {
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                       */
/* -------------------------------------------------------------------------- */

function createScene(THREE, hero, canvas) {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.matchMedia('(max-width: 820px)').matches
  const isMobile = coarse || narrow

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

  // ---- adaptive particle budget (400–800 mobile, 800–1500 desktop) ----
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 4
  let particleCount = isMobile ? 640 : 1200
  if (cores <= 4) particleCount = Math.round(particleCount * 0.9)
  if (cores <= 2) particleCount = Math.round(particleCount * 0.75)
  if (memory <= 2) particleCount = Math.round(particleCount * 0.8)
  particleCount = clamp(
    particleCount,
    isMobile ? 400 : 800,
    isMobile ? 800 : 1500
  )

  // ---- renderer ----
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile, // MSAA is the first thing to drop on mobile
    alpha: true,
    stencil: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100)
  camera.position.set(0, 0, 16)

  const group = new THREE.Group()
  scene.add(group)

  // ---- particle positions (projected onto an ellipsoidal shell) ----
  const rx = isMobile ? 9 : 13
  const ry = isMobile ? 6.5 : 8.5
  const rz = isMobile ? 4.5 : 6

  const positions = new Float32Array(particleCount * 3)
  const scales = new Float32Array(particleCount)
  const seeds = new Float32Array(particleCount)
  const mixes = new Float32Array(particleCount)

  for (let i = 0; i < particleCount; i++) {
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const radial = Math.sqrt(1 - u * u)
    // Bias toward the shell for an open, readable constellation.
    const shell = 0.35 + 0.65 * Math.cbrt(Math.random())

    positions[i * 3] = radial * Math.cos(theta) * rx * shell
    positions[i * 3 + 1] = u * ry * shell
    positions[i * 3 + 2] = radial * Math.sin(theta) * rz * shell

    const r = Math.random()
    scales[i] = 0.55 + r * r * 1.7 // many small nodes, a few bright ones
    seeds[i] = Math.random()
    mixes[i] = Math.random()
  }

  const pointsGeometry = new THREE.BufferGeometry()
  pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  pointsGeometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
  pointsGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  pointsGeometry.setAttribute('aMix', new THREE.BufferAttribute(mixes, 1))

  // ---- proximity graph, built once (capped by degree + edge budget) ----
  const maxDegree = isMobile ? 3 : 4
  const threshold = isMobile ? 3.6 : 4
  const thresholdSq = threshold * threshold
  const edgeBudget = isMobile ? 1800 : 3600

  const edgeData = [] // flat triplets: [i, j, distance, ...]
  const degrees = new Uint8Array(particleCount)

  for (let i = 0; i < particleCount; i++) {
    if (degrees[i] >= maxDegree) continue
    if (edgeData.length / 3 >= edgeBudget) break

    const ix = positions[i * 3]
    const iy = positions[i * 3 + 1]
    const iz = positions[i * 3 + 2]

    for (let j = i + 1; j < particleCount; j++) {
      if (degrees[j] >= maxDegree) continue

      const dx = ix - positions[j * 3]
      const dy = iy - positions[j * 3 + 1]
      const dz = iz - positions[j * 3 + 2]
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq < thresholdSq) {
        edgeData.push(i, j, Math.sqrt(distSq))
        degrees[i]++
        degrees[j]++
        if (degrees[i] >= maxDegree) break
        if (edgeData.length / 3 >= edgeBudget) break
      }
    }
  }

  const edgeCount = edgeData.length / 3
  const linePositions = new Float32Array(edgeCount * 6)
  const lineAlphas = new Float32Array(edgeCount * 2)
  const lineMixes = new Float32Array(edgeCount * 2)

  for (let e = 0; e < edgeCount; e++) {
    const i = edgeData[e * 3]
    const j = edgeData[e * 3 + 1]
    const dist = edgeData[e * 3 + 2]

    const o = e * 6
    linePositions[o] = positions[i * 3]
    linePositions[o + 1] = positions[i * 3 + 1]
    linePositions[o + 2] = positions[i * 3 + 2]
    linePositions[o + 3] = positions[j * 3]
    linePositions[o + 4] = positions[j * 3 + 1]
    linePositions[o + 5] = positions[j * 3 + 2]

    // Closer nodes glow brighter; farther edges fade out.
    const falloff = 1 - dist / threshold
    const alpha = 0.12 + 0.88 * falloff * falloff
    lineAlphas[e * 2] = alpha
    lineAlphas[e * 2 + 1] = alpha
    lineMixes[e * 2] = mixes[i]
    lineMixes[e * 2 + 1] = mixes[j]
  }

  const linesGeometry = new THREE.BufferGeometry()
  linesGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  linesGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(lineAlphas, 1))
  linesGeometry.setAttribute('aMix', new THREE.BufferAttribute(lineMixes, 1))

  // ---- shared uniforms (one reference for both materials) ----
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: isMobile ? 0.45 : 0.55 },
    uOpacity: { value: 0 },
    uColorA: { value: new THREE.Color(0x6ee7ff) }, // --primary
    uColorB: { value: new THREE.Color(0xa78bfa) }, // --primary2
    uNear: { value: 5 },
    uFar: { value: 28 },
    uSize: { value: isMobile ? 1.9 : 1.7 },
    uPixelRatio: { value: pixelRatio },
  }

  const pointsMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: POINTS_VERT,
    fragmentShader: POINTS_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const linesMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: LINES_VERT,
    fragmentShader: LINES_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const points = new THREE.Points(pointsGeometry, pointsMaterial)
  points.frustumCulled = false // vertex displacement can exceed the bounds
  const lines = new THREE.LineSegments(linesGeometry, linesMaterial)
  lines.frustumCulled = false

  group.add(lines, points)

  /* ------------------------------------------------------------------ */
  /* State — everything reused, nothing allocated inside the loop        */
  /* ------------------------------------------------------------------ */
  let disposed = false
  let rafId = 0
  let lastTime = 0
  let elapsed = 0
  let inView = true

  // Orbit state — drag to rotate, with a slow auto-spin that resumes when idle.
  let dragging = false
  let dragId = -1
  let dragX = 0
  let dragY = 0
  let yawTarget = 0
  let yawCurrent = 0
  let yawAuto = 0
  let pitchTarget = 0
  let pitchCurrent = 0
  let scrollTarget = 0
  let scrollCurrent = 0
  let debug = null

  /* ------------------------------------------------------------------ */
  /* Adaptive quality                                                    */
  /* ------------------------------------------------------------------ */
  // Render resolution (DPR) is the dominant cost lever; trimming edges is a
  // cheap secondary one. Points always render whole, so no edge can ever
  // dangle from a hidden node.
  const qualityLevels = [
    { pixelRatio: Math.min(pixelRatio, 2), edgeFraction: 1 },
    { pixelRatio: Math.min(pixelRatio, 1.5), edgeFraction: 0.6 },
    { pixelRatio: 1, edgeFraction: 0.3 },
  ]
  let qualityLevel = 0
  let lastQualityChange = 0
  let qualityCooldown = 0
  const qualityLock = qualityLockFromQuery()

  function setQuality(level, now, direction) {
    qualityLevel = clamp(level, 0, qualityLevels.length - 1)
    const quality = qualityLevels[qualityLevel]
    renderer.setPixelRatio(quality.pixelRatio)
    uniforms.uPixelRatio.value = quality.pixelRatio
    linesGeometry.setDrawRange(0, Math.floor(edgeCount * quality.edgeFraction) * 2)
    lastQualityChange = now
    // Longer settling window after an upgrade avoids up/down oscillation.
    qualityCooldown = direction === 'down' ? 3000 : 7000
    if (debug) debug.level = qualityLevel
  }

  // Real (unclamped) frame-time sampling for the auto-tuner.
  let perfWarmup = 1.5
  let perfTime = 0
  let perfFrames = 0

  /* ------------------------------------------------------------------ */
  /* Sizing                                                              */
  /* ------------------------------------------------------------------ */
  function resize() {
    const width = hero.clientWidth || 1
    const height = hero.clientHeight || 1
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const hasResizeObserver = typeof ResizeObserver !== 'undefined'
  const resizeObserver = hasResizeObserver ? new ResizeObserver(resize) : null
  if (resizeObserver) resizeObserver.observe(hero)
  else window.addEventListener('resize', resize, { passive: true })
  resize()

  /* ------------------------------------------------------------------ */
  /* Interaction — pointer orbit (fine pointers only)                    */
  /* ------------------------------------------------------------------ */
  const canOrbit = !coarse
  const ORBIT_SPEED = 0.006 // radians of rotation per pixel dragged
  const PITCH_LIMIT = 0.85

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Let links/buttons inside the hero keep their default click behaviour.
    if (event.target.closest && event.target.closest('a, button')) return
    dragging = true
    dragId = event.pointerId
    dragX = event.clientX
    dragY = event.clientY
    hero.classList.add('is-orbiting')
    event.preventDefault()
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== dragId) return
    yawTarget += (event.clientX - dragX) * ORBIT_SPEED
    pitchTarget = clamp(pitchTarget + (event.clientY - dragY) * ORBIT_SPEED, -PITCH_LIMIT, PITCH_LIMIT)
    dragX = event.clientX
    dragY = event.clientY
  }

  function onPointerUp(event) {
    if (event.pointerId !== dragId) return
    dragging = false
    dragId = -1
    hero.classList.remove('is-orbiting')
  }

  function onScroll() {
    const height = hero.offsetHeight || 1
    scrollTarget = clamp(window.scrollY / height, 0, 1)
  }

  if (canOrbit) {
    hero.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  /* ------------------------------------------------------------------ */
  /* Render loop                                                         */
  /* ------------------------------------------------------------------ */
  function frame(now) {
    rafId = 0

    const rawDelta = lastTime ? (now - lastTime) / 1000 : 0
    lastTime = now
    const delta = Math.min(rawDelta, 0.05) // clamp only for animation smoothing
    elapsed += delta

    // Ease toward the drag target; a slow auto-spin drifts the constellation
    // while the user isn't actively orbiting. Allocations avoided in the loop.
    if (!dragging) yawAuto += delta * 0.05
    yawCurrent += (yawTarget - yawCurrent) * 0.09
    pitchCurrent += (pitchTarget - pitchCurrent) * 0.09
    scrollCurrent += (scrollTarget - scrollCurrent) * 0.08
    uniforms.uOpacity.value += (1 - uniforms.uOpacity.value) * 0.035

    // Drag orbit + idle drift on Y, gentle tumble/roll for a volumetric read.
    group.rotation.y = yawCurrent + yawAuto
    group.rotation.x = pitchCurrent + Math.sin(elapsed * 0.11) * 0.04 + scrollCurrent * 0.12
    group.rotation.z = Math.sin(elapsed * 0.06) * 0.03
    group.position.y = scrollCurrent * 1.6

    uniforms.uTime.value = elapsed

    renderer.render(scene, camera)

    samplePerformance(now, rawDelta)

    schedule()
  }

  // Measures the real frame rate over ~1s windows and nudges the quality
  // level. Hysteresis (48 / 58 FPS) plus a cooldown keep it from oscillating.
  function samplePerformance(now, rawDelta) {
    if (qualityLock !== null) return // permanent lock requested via ?heroQuality
    if (perfWarmup > 0) {
      perfWarmup -= rawDelta
      return
    }

    perfFrames++
    perfTime += rawDelta
    if (perfTime < 1) return

    const fps = perfFrames / perfTime
    perfFrames = 0
    perfTime = 0

    if (now - lastQualityChange < qualityCooldown) return
    if (fps < 48 && qualityLevel < qualityLevels.length - 1) {
      setQuality(qualityLevel + 1, now, 'down')
    } else if (fps > 58 && qualityLevel > 0) {
      setQuality(qualityLevel - 1, now, 'up')
    }
  }

  function schedule() {
    if (rafId || disposed || !inView || document.hidden) return
    rafId = requestAnimationFrame(frame)
  }

  function onVisibility() {
    if (document.hidden) {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    } else {
      lastTime = 0
      schedule()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  let intersectionObserver = null
  if (typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting
        if (!inView && rafId) {
          cancelAnimationFrame(rafId)
          rafId = 0
        } else if (inView) {
          lastTime = 0
          schedule()
        }
      },
      { rootMargin: '120px' }
    )
    intersectionObserver.observe(hero)
  }

  function onContextLost(event) {
    event.preventDefault()
    dispose()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  function onMotionChange(event) {
    if (event.matches) dispose()
  }
  motionQuery.addEventListener?.('change', onMotionChange)

  /* ------------------------------------------------------------------ */
  /* Teardown                                                            */
  /* ------------------------------------------------------------------ */
  function dispose() {
    if (disposed) return
    disposed = true

    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }

    intersectionObserver?.disconnect()
    resizeObserver?.disconnect()
    if (!hasResizeObserver) window.removeEventListener('resize', resize)

    if (canOrbit) {
      hero.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      hero.classList.remove('is-orbiting')
    }
    window.removeEventListener('scroll', onScroll)
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    motionQuery.removeEventListener?.('change', onMotionChange)

    pointsGeometry.dispose()
    linesGeometry.dispose()
    pointsMaterial.dispose()
    linesMaterial.dispose()
    group.remove(lines, points)
    scene.clear()

    const gl = renderer.getContext()
    const loseContext = gl && gl.getExtension('WEBGL_lose_context')
    renderer.dispose()
    if (loseContext) loseContext.loseContext()

    if (window.__hero === debug) delete window.__hero
    document.documentElement.classList.remove('has-webgl')
  }

  /* ------------------------------------------------------------------ */
  /* Debug hook (opt-in)                                                 */
  /* ------------------------------------------------------------------ */
  if (isDebugEnabled()) {
    debug = {
      renderer,
      scene,
      camera,
      canvas,
      level: qualityLevel,
      lock: qualityLock,
      get info() {
        return renderer.info
      },
      getQuality() {
        return qualityLevels[qualityLevel]
      },
      setQuality(level) {
        setQuality(level, performance.now(), level > qualityLevel ? 'down' : 'up')
      },
      dispose,
    }
    window.__hero = debug
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  if (qualityLock !== null) setQuality(qualityLock, performance.now(), 'lock')
  document.documentElement.classList.add('has-webgl')
  onScroll()
  schedule()

  return dispose
}

/* -------------------------------------------------------------------------- */
/* Entry                                                                       */
/* -------------------------------------------------------------------------- */

function shouldSkipForDataSaver() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  return !!(connection && connection.saveData)
}

async function boot() {
  const hero = document.querySelector('.hero')
  const canvas = document.getElementById('hero-canvas')
  if (!hero || !canvas) return

  // Bail out *before* downloading Three.js — these visitors keep the static SVG.
  if (isStaticForced()) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (shouldSkipForDataSaver()) return
  if (!supportsWebGL()) return

  let THREE
  try {
    THREE = await import('../assets/vendor/three.module.js')
  } catch (_) {
    return // dependency unavailable -> static hero visual, no error surfaced
  }

  try {
    createScene(THREE, hero, canvas)
  } catch (error) {
    // Any failure (context creation, shader compile, …): leave the static
    // hero visual untouched and make sure no half-initialised canvas shows.
    console.warn('[hero] WebGL scene disabled:', error)
    document.documentElement.classList.remove('has-webgl')
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => boot(), { once: true })
} else {
  boot()
}
