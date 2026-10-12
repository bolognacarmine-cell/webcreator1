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

  /* ---- Portrait: light parallax on scroll ---- */
  const portrait = document.querySelector('.media-card img')
  if (portrait) {
    gsapSafe.fromTo(
      portrait,
      { yPercent: -4 },
      {
        yPercent: 4,
        ease: 'none',
        scrollTrigger: {
          trigger: '.media-card',
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

  /* ---- Project image parallax ---- */
  document.querySelectorAll('.project-media img').forEach((img) => {
    gsapSafe.fromTo(
      img,
      { yPercent: -6, scale: 1.06 },
      {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('.project'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8,
        },
      }
    )
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

  /* ---- Refresh ScrollTrigger after load (images) ---- */
  window.addEventListener('load', () => {
    ScrollTrigger.refresh()
  })
})()