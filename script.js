/* ---------------------------------------------
   Manuel — Web Developer · Animations (GSAP)
   --------------------------------------------- */
(function () {
  const year = document.getElementById('year')
  if (year) year.textContent = String(new Date().getFullYear())

  const hasGsap = typeof window.gsap !== 'undefined'
  const hasST = typeof window.ScrollTrigger !== 'undefined'
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!hasGsap || !hasST || reduceMotion) {
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      el.style.opacity = '1'
      el.style.transform = 'none'
    })
    document.querySelectorAll('.bar-fill').forEach((el) => {
      el.style.transform = 'scaleX(1)'
    })
    return
  }

  gsap.registerPlugin(ScrollTrigger)

  const gsapSafe = gsap

  /* ---- Hero intro ---- */
  const hero = document.querySelector('.hero')
  if (hero) {
    const title = document.querySelector('.hero-title')
    const kicker = document.querySelector('.kicker')
    const lead = document.querySelector('.hero-lead')
    const cta = document.querySelector('.hero-cta')

    const intro = gsapSafe.timeline({ defaults: { ease: 'power3.out' } })

    if (title) {
      const words = title.textContent.trim().split(/\s+/)
      title.innerHTML = words.map((w) => `<span class="word">${w}</span>`).join(' ')
      intro.from(
        title.querySelectorAll('.word'),
        { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.07 },
        0.15
      )
    }

    if (kicker) intro.from(kicker, { y: 24, opacity: 0, duration: 0.7 }, 0.05)
    if (lead) intro.from(lead, { y: 26, opacity: 0, duration: 0.8 }, 0.55)
    if (cta)
      intro.from(
        cta.children,
        { y: 20, opacity: 0, duration: 0.6, stagger: 0.12 },
        0.8
      )
  }

  /* ---- Hero background float ---- */
  const heroBg = document.querySelector('.hero-bg')
  if (heroBg) {
    gsapSafe.to(heroBg, {
      y: 40,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6,
      },
    })
  }

  /* ---- Hero visual: gentle orbit + float ---- */
  const heroVisual = document.querySelector('.hero-visual img')
  if (heroVisual) {
    gsapSafe.to(heroVisual, {
      rotate: 360,
      duration: 90,
      repeat: -1,
      ease: 'none',
      transformOrigin: '50% 50%',
    })
    gsapSafe.to(heroVisual, {
      yPercent: 4,
      scale: 1.03,
      duration: 7,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    })
  }

  /* ---- Portrait: slow 2D levitation + Ken Burns zoom + scroll parallax ----
     No 3D/perspective here on purpose: a 3D-composited element inside an
     `overflow: hidden` + `border-radius` parent triggers a Chromium compositor
     bug (black seams). 2D transforms are immune to it. */
  const portraitCard = document.querySelector('.media-card')
  const flipInner = document.querySelector('.flip-inner')
  if (portraitCard) {
    gsapSafe.fromTo(
      portraitCard,
      { y: -6 },
      { y: 6, duration: 7, repeat: -1, yoyo: true, ease: 'sine.inOut', force3D: false }
    )
  }
  if (flipInner) {
    gsapSafe.fromTo(
      flipInner,
      { scale: 0.78 },
      {
        scale: 0.86,
        duration: 11,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        force3D: true,
      }
    )
    gsapSafe.set(flipInner, { rotationX: -18, transformOrigin: '50% 50%' })
    gsapSafe.to(flipInner, {
      rotationY: -360,
      duration: 22,
      repeat: -1,
      ease: 'none',
      transformOrigin: '50% 50%',
      force3D: true,
    })
    gsapSafe.fromTo(
      flipInner,
      { yPercent: -4 },
      {
        yPercent: 4,
        ease: 'none',
        force3D: false,
        scrollTrigger: {
          trigger: portraitCard,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8,
        },
      }
    )
  }

  /* ---- Scroll progress bar ---- */
  const progressBar = document.querySelector('.scroll-progress')
  if (progressBar) {
    gsapSafe.to(progressBar, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        start: 0,
        end: 'max',
        scrub: 0.3,
      },
    })
  }

  /* ---- Header scrolled state ---- */
  const header = document.querySelector('.site-header')
  if (header) {
    ScrollTrigger.create({
      start: 'top -60',
      onUpdate: (self) => {
        header.classList.toggle('scrolled', self.scroll() > 60)
      },
    })
  }

  /* ---- Reveal on scroll helper ---- */
  const reveal = (sel, vars = {}) => {
    const els = gsap.utils.toArray(sel)
    els.forEach((el, i) => {
      const offset = (i % 6) * 0.07
      gsapSafe.from(el, {
        y: 36,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
        ...vars,
        delay: (vars.delay !== undefined ? vars.delay : 0) + offset,
      })
    })
  }

  document.querySelectorAll('.section-head').forEach((head) => reveal(head))
  reveal('.media-card')
  reveal('.feature')
  reveal('.card', { y: 46 })
  reveal('.chip', { y: 18 })
  reveal('.callout', { duration: 1 })
  reveal('.group-head')
  reveal('.project', { y: 50, duration: 1 })
  reveal('.partner-card')
  reveal('.partner-visual')
  reveal('.eco-item')
  reveal('.eco-visual')
  reveal('.contact-card')
  reveal('.site-footer .footer-inner > *', { y: 30 })

  /* ---- Skill bars: draw on scroll ---- */
  const bars = document.querySelectorAll('.bar')
  bars.forEach((bar) => {
    const fill = bar.querySelector('.bar-fill')
    const label = bar.querySelector('.bar-head .muted')
    if (!fill) return

    const inlineStyle = fill.getAttribute('style') || ''
    const match = inlineStyle.match(/width\s*:\s*(\d+(?:\.\d+)?)%/)
    const target = match ? parseFloat(match[1]) / 100 : 1
    fill.removeAttribute('style')

    gsapSafe.fromTo(
      fill,
      { scaleX: 0 },
      {
        scaleX: target,
        duration: 1.4,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: bar,
          start: 'top 90%',
          toggleActions: 'play none none reverse',
        },
      }
    )
  })

  /* ---- Project image parallax + continuous 3D flip ---- */
  document.querySelectorAll('.project-media .flip-inner').forEach((inner) => {
    gsapSafe.fromTo(
      inner,
      { yPercent: -6, scale: 1.04 },
      {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: {
          trigger: inner.closest('.project'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8,
        },
      }
    )
    gsapSafe.set(inner, { rotationX: -10, transformOrigin: '50% 50%' })
    gsapSafe.to(inner, {
      rotationY: 360,
      duration: 26,
      repeat: -1,
      ease: 'none',
      transformOrigin: '50% 50%',
      force3D: true,
    })
  })

  /* ---- Micro-interactions: magnetic buttons ---- */
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
  if (!isCoarsePointer) {
    document.querySelectorAll('.btn, .project-link, .partner-link, .project-meta a').forEach((el) => {
      const strength = el.classList.contains('btn') ? 14 : 6
      let xTo = null
      let yTo = null

      el.addEventListener('pointerenter', () => {
        xTo = gsapSafe.quickTo(el, 'x', { duration: 0.35, ease: 'power3.out' })
        yTo = gsapSafe.quickTo(el, 'y', { duration: 0.35, ease: 'power3.out' })
      })

      el.addEventListener('pointermove', (e) => {
        if (!xTo || !yTo) return
        const r = el.getBoundingClientRect()
        const relX = (e.clientX - (r.left + r.width / 2)) * 0.35
        const relY = (e.clientY - (r.top + r.height / 2)) * 0.35
        const clamp = (v) => Math.max(-strength, Math.min(strength, v))
        xTo(clamp(relX))
        yTo(clamp(relY))
      })

      el.addEventListener('pointerleave', () => {
        gsapSafe.to(el, { x: 0, y: 0, duration: 0.45, ease: 'elastic.out(1, 0.5)' })
        xTo = null
        yTo = null
      })
    })
  }

  /* ---- Micro-interactions: 3D tilt on project cards ---- */
  if (!isCoarsePointer) {
    document.querySelectorAll('.project').forEach((card) => {
      const maxTilt = 6
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        gsapSafe.to(card, {
          rotateY: px * maxTilt,
          rotateX: -py * maxTilt,
          transformPerspective: 900,
          duration: 0.4,
          ease: 'power2.out',
        })
      })
      card.addEventListener('pointerleave', () => {
        gsapSafe.to(card, {
          rotateY: 0,
          rotateX: 0,
          duration: 0.6,
          ease: 'elastic.out(1,0.55)',
        })
      })
    })
  }

  /* ---- Wow: custom glowing cursor ---- */
  if (!isCoarsePointer) {
    const dot = document.createElement('div')
    const ring = document.createElement('div')
    dot.className = 'cursor-dot'
    ring.className = 'cursor-ring'
    document.body.appendChild(dot)
    document.body.appendChild(ring)

    let mx = 0, my = 0
    let dx = 0, dy = 0
    let rx = 0, ry = 0
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX
      my = e.clientY
      if (!dot._init) {
        dx = mx; dy = my; rx = mx; ry = my; dot._init = true
      }
    })

    const cursorTick = () => {
      dx += (mx - dx) * 0.35
      dy += (my - dy) * 0.35
      rx += (mx - rx) * 0.12
      ry += (my - ry) * 0.12
      dot.style.transform = `translate(${dx - 4}px, ${dy - 4}px)`
      ring.style.transform = `translate(${rx}px, ${ry}px)`
      requestAnimationFrame(cursorTick)
    }
    cursorTick()

    const hoverSel = 'a, button, .btn, .project, .feature, .card, .chip, .media-card'
    document.querySelectorAll(hoverSel).forEach((el) => {
      el.addEventListener('pointerenter', () => ring.classList.add('is-hover'))
      el.addEventListener('pointerleave', () => ring.classList.remove('is-hover'))
    })
  }

  /* ---- Wow: GSAP scroll parallax across sections ---- */
  document.querySelectorAll('.section-head').forEach((head) => {
    gsapSafe.fromTo(
      head,
      { yPercent: -12 },
      {
        yPercent: 12,
        ease: 'none',
        scrollTrigger: {
          trigger: head,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      }
    )
  })

  document.querySelectorAll('.project-grid, .feature-grid, .skills-grid').forEach((grid) => {
    gsapSafe.fromTo(
      grid,
      { yPercent: 6 },
      {
        yPercent: -6,
        ease: 'none',
        scrollTrigger: {
          trigger: grid,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      }
    )
  })

  gsapSafe.fromTo(
    '.hero-visual',
    { yPercent: -8 },
    {
      yPercent: 12,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.7,
      },
    }
  )

  /* ---- Wow: 3D flip for ecosystem visual ---- */
  const ecoFlip = document.querySelector('.eco-visual .flip-inner')
  if (ecoFlip) {
    gsapSafe.set(ecoFlip, { rotationX: -12, transformOrigin: '50% 50%', opacity: 0, scale: 0.7, y: 60 })
    const ecoIntro = gsapSafe.timeline({ defaults: { ease: 'power3.out' } })
    ecoIntro.to(ecoFlip, { opacity: 1, scale: 1, y: 0, duration: 1.4 }, 0.2)
    ecoIntro.to(ecoFlip, {
      rotationY: -360,
      duration: 24,
      repeat: -1,
      ease: 'none',
      transformOrigin: '50% 50%',
      force3D: true,
    }, 0.8)
  }

  /* ---- Wow: immersive pointer-reactive background ---- */
  const immersiveLayer = document.createElement('div')
  immersiveLayer.className = 'immersive-layer'
  document.body.prepend(immersiveLayer)
  let ix = 0, iy = 0, cx = 0, cy = 0
  window.addEventListener('pointermove', (e) => {
    ix = (e.clientX / window.innerWidth - 0.5) * 60
    iy = (e.clientY / window.innerHeight - 0.5) * 60
  })
  const layerTick = () => {
    cx += (ix - cx) * 0.06
    cy += (iy - cy) * 0.06
    immersiveLayer.style.transform = `translate(${cx}px, ${cy}px)`
    requestAnimationFrame(layerTick)
  }
  layerTick()

  /* ---- Wow: sweeping scan beam ---- */
  const scanBeam = document.createElement('div')
  scanBeam.className = 'scan-beam'
  document.body.appendChild(scanBeam)

  /* ---- Wow: cursor trail ---- */
  const trailCount = 26
  const trailDots = []
  for (let i = 0; i < trailCount; i++) {
    const d = document.createElement('div')
    d.className = 'trail-dot'
    d.style.opacity = String(1 - i / trailCount)
    d.style.background = i % 2 === 0 ? '#6ee7ff' : '#a78bfa'
    document.body.appendChild(d)
    trailDots.push({ el: d, x: 0, y: 0 })
  }
  let trailX = 0, trailY = 0
  window.addEventListener('pointermove', (e) => { trailX = e.clientX; trailY = e.clientY })
  const trailTick = () => {
    let x = trailX, y = trailY
    trailDots.forEach((t, i) => {
      t.x += (x - t.x) * 0.35
      t.y += (y - t.y) * 0.35
      t.el.style.transform = `translate(${t.x}px, ${t.y}px)`
      x = t.x
      y = t.y
    })
    requestAnimationFrame(trailTick)
  }
  trailTick()

  /* ---- Wow: 3D section enter/exit depth ---- */
  document.querySelectorAll('.section').forEach((sec) => {
    gsapSafe.fromTo(
      sec,
      { rotationX: 6, scale: 0.96, transformPerspective: 1200, transformOrigin: '50% 100%' },
      {
        rotationX: 0,
        scale: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: sec,
          start: 'top 90%',
          end: 'top 30%',
          scrub: 0.6,
        },
      }
    )
    gsapSafe.to(sec, {
      rotationX: -4,
      scale: 0.97,
      ease: 'none',
      scrollTrigger: {
        trigger: sec,
        start: 'bottom 70%',
        end: 'bottom 10%',
        scrub: 0.6,
      },
    })
  })

  /* ---- Wow: cinematic scroll transitions ---- */
  gsapSafe.to('.hero', {
    scale: 1.06,
    opacity: 0.75,
    filter: 'blur(3px)',
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 0.8,
    },
  })

  gsapSafe.to('.scroll-progress', {
    backgroundColor: 'rgba(167, 139, 250, 1)',
    ease: 'none',
    scrollTrigger: {
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
    },
  })

  /* ---- Wow: global mouse parallax for everything ---- */
  const parallaxEls = gsapSafe.utils.toArray('.hero, .section, .media-card, .eco-visual, .project')
  const parallaxQuick = parallaxEls.map((el) => {
    const depth = el.classList.contains('media-card') ? 20
      : el.classList.contains('project') ? 10
      : el.classList.contains('hero') ? 6
      : 8
    return {
      el,
      depth,
      xTo: gsapSafe.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' }),
      yTo: gsapSafe.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' }),
    }
  })
  window.addEventListener('pointermove', (e) => {
    const mx = e.clientX / window.innerWidth - 0.5
    const my = e.clientY / window.innerHeight - 0.5
    parallaxQuick.forEach((p) => {
      p.xTo(mx * p.depth)
      p.yTo(my * p.depth)
    })
  })

  /* ---- Wow: typewriter on kicker ---- */
  const kicker = document.querySelector('.kicker')
  if (kicker) {
    const fullText = kicker.textContent
    kicker.textContent = ''
    let i = 0
    const type = () => {
      if (i <= fullText.length) {
        kicker.textContent = fullText.slice(0, i) + (i < fullText.length ? '▋' : '')
        i++
        setTimeout(type, 45 + Math.random() * 40)
      }
    }
    setTimeout(type, 600)
  }

  /* ---- Wow: 3D tilt on cards & features too ---- */
  if (!isCoarsePointer) {
    document.querySelectorAll('.card, .feature').forEach((card) => {
      const maxTilt = 4
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        gsapSafe.to(card, {
          rotateY: px * maxTilt,
          rotateX: -py * maxTilt,
          transformPerspective: 800,
          duration: 0.35,
          ease: 'power2.out',
        })
      })
      card.addEventListener('pointerleave', () => {
        gsapSafe.to(card, {
          rotateY: 0,
          rotateX: 0,
          duration: 0.6,
          ease: 'elastic.out(1,0.55)',
        })
      })
    })
  }

  /* ---- Refresh ScrollTrigger after load (images) ---- */
  window.addEventListener('load', () => {
    ScrollTrigger.refresh()
  })
})()