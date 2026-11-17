/* Levels Architecture — site behaviour (vanilla, no dependencies) */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 760px)').matches;

  /* ---------- images: retry a few times if a load fails (flaky networks) ---------- */
  function retryImg(img) {
    img.addEventListener('error', () => {
      img._tries = (img._tries || 0) + 1;
      if (img._tries > 12) return;
      setTimeout(() => { img.src = img.src.split('?')[0] + '?r=' + Date.now(); }, Math.min(400 * img._tries, 3000));
    });
    if (img.complete && img.naturalWidth === 0 && img.src) img.dispatchEvent(new Event('error'));
  }
  $$('img').forEach(retryImg);

  /* ---------- language (EN default) ---------- */
  let lang = 'en';
  try { lang = localStorage.getItem('levels-lang') || 'en'; } catch (e) {}
  function applyLang(l) {
    lang = l;
    document.documentElement.lang = l;
    $$('[data-en]').forEach(el => { el.innerHTML = el.dataset[l]; });
    try { localStorage.setItem('levels-lang', l); } catch (e) {}
    renderTourText();
    // WhatsApp: the message arrives already written, in the visitor's language
    const WA_MSG = {
      es: 'Hola, Luisa. Vi tu portafolio en Levels Architecture y me encantaría conversar sobre un proyecto. ¿Tienes un momento?',
      en: "Hi Luisa, I saw your portfolio at Levels Architecture and I'd love to talk about a project. Do you have a moment?",
    };
    $$('[data-wa]').forEach(a => { a.href = 'https://wa.me/17877106964?text=' + encodeURIComponent(WA_MSG[l]); });
  }
  $('#lang').addEventListener('click', () => applyLang(lang === 'en' ? 'es' : 'en'));

  /* ---------- page texture (stone/sand): load with retry, then apply ---------- */
  (function loadTexture(n = 0) {
    fetch('assets/textures/tex_piedra-arena-seamless.webp')
      .then(r => { if (!r.ok) throw 0; return r.blob(); })
      .then(b => {
        const s = document.createElement('style');
        s.textContent = `body::before{background-image:url(${URL.createObjectURL(b)})}`;
        document.head.appendChild(s);
      })
      .catch(() => { if (n < 60) setTimeout(() => loadTexture(n + 1), Math.min(500 * (n + 1), 3000)); });   // keep trying until it arrives
  })();

  /* ---------- hero video: always keep it playing (retry if the network drops it) ---------- */
  const heroVid = $('.hero__video');
  let heroTries = 0;
  function heroRetry() {
    if (heroTries++ > 8) return;
    setTimeout(() => { heroVid.load(); heroVid.play().catch(() => {}); }, 600 * heroTries);
  }
  heroVid.addEventListener('error', heroRetry, true);              // capture <source> errors too
  heroVid.addEventListener('stalled', () => { if (heroVid.readyState < 3) heroRetry(); });
  heroVid.play().catch(() => {});

  /* ---------- hero intro: logo in centre → moves aside → copy ---------- */
  // The logo sits at its final place; we only move it with transform (smooth, never torn).
  const logo = $('.hero__logo');
  const finalT = () => `translate3d(0, ${-logo.offsetHeight / 2}px, 0)`;            // vertically centred on its 31% line
  function centreT(extra = 1) {
    const w = logo.offsetWidth, h = logo.offsetHeight;
    const big = Math.min(innerWidth * (mobile ? 0.88 : 0.74), innerHeight * 1.05, 1080) / w * extra;   // big, owns the centre
    const tx = innerWidth / 2 - logo.offsetLeft - (w * big) / 2;
    const ty = innerHeight / 2 - logo.offsetTop - (h * big) / 2;
    return `translate3d(${tx}px, ${ty}px, 0) scale(${big})`;
  }
  let introDone = reduced, introStarted = false;
  function snapLogo() {                                          // re-measure without animating
    logo.style.transition = 'none';
    logo.style.transform = introDone ? finalT() : centreT(introStarted ? 1 : 0.96);
    logo.offsetWidth; logo.style.transition = '';
  }
  snapLogo();
  // 1) logo appears alone, big, in the centre  2) after a beat it glides left  3) then the text appears
  function startIntro() {
    if (introStarted) return; introStarted = true;
    snapLogo();
    setTimeout(() => {                                           // (timers, not rAF: rAF can arrive late in a hidden tab)
      document.body.classList.add('intro-in');
      if (!introDone) logo.style.transform = centreT(1);        // gentle grow while it fades in
    }, 30);
    setTimeout(() => {
      introDone = true;
      document.body.classList.add('intro-done');
      logo.style.transform = finalT();                           // glide to the left
    }, reduced ? 0 : 3200);
  }
  addEventListener('resize', snapLogo);
  const logoImg = $('img', logo);
  if (logoImg.complete && logoImg.naturalWidth) startIntro();
  else {
    logoImg.addEventListener('load', startIntro, { once: true });   // wait for the logo so its moment isn't lost
    setTimeout(startIntro, 2500);                                    // never wait forever
  }

  const rots = $$('.hero__phrase .rot');
  let ri = 0;
  rots[0].classList.add('on');
  // one phrase fully leaves before the next one enters (no overlapping text)
  if (rots.length > 1) setInterval(() => {   // a single phrase (Luisa's slogan) stays fixed
    rots[ri].classList.remove('on');
    ri = (ri + 1) % rots.length;
    setTimeout(() => rots[ri].classList.add('on'), 750);
  }, 4200);

  /* ---------- Concepto: Luisa's three pillars light up and explain themselves over a project image ---------- */
  const CONCEPTS = {
    fen: { img: 'assets/proyecto-04/img/kf_02.webp',
      w: { en: 'Phenomenology', es: 'Fenomenología' },
      k: { en: 'Casa Nido · a garden that embraces the house', es: 'Casa Nido · un jardín que abraza la casa' },
      p: { en: 'The built environment directly shapes human development: how we rest, relate, work and feel. That is why experience is my starting point. Every project begins with one question: what does the person who will inhabit this place want to experience?',
           es: 'El entorno construido influye directamente en el desarrollo humano: cómo descansamos, nos relacionamos, trabajamos y nos sentimos. Por eso la experiencia es mi punto de partida. En cada proyecto parto de una pregunta: ¿qué quiere experimentar quien habite este lugar?' } },
    bio: { img: 'assets/proyecto-03/img/kf_05.webp',
      w: { en: 'Bioclimatic', es: 'Bioclimática' },
      k: { en: 'El Refugio · solar-control glass and cross ventilation', es: 'El Refugio · vidrio de control solar y ventilación cruzada' },
      p: { en: 'It is part of the design from the very first line. I study the sun, winds, temperature, humidity and rainfall of the site, and with that data I define orientation, openings, cross ventilation, natural light and local materials. Every decision serves the climate and improves how the space feels.',
           es: 'Es parte del diseño desde el primer trazo. Estudio el sol, los vientos, la temperatura, la humedad y las lluvias del sitio, y con esos datos defino orientación, aberturas, ventilación cruzada, luz natural y materiales del lugar. Cada decisión cumple una función climática y mejora cómo se siente el espacio.' } },
    jer: { img: 'assets/proyecto-02/img/kf_02.webp',
      w: { en: 'Hierarchy', es: 'Jerarquía' },
      k: { en: 'Finca Lomix · the social level, lower, toward the deck', es: 'Finca Lomix · el nivel social, más abajo, hacia el deck' },
      p: { en: 'LEVELS starts from hierarchy: I set each space apart according to the importance it should have, through heights and level changes: double heights, platforms and transitions. Each level has an intention, and together they form a balanced whole.',
           es: 'LEVELS parte del concepto de jerarquía: diferencio cada espacio según la importancia que se quiere generar, a través de alturas y desniveles: dobles alturas, plataformas y transiciones. Cada nivel tiene una intención, y juntos forman un conjunto equilibrado.' } },
  };
  const conceptBox = $('.concepts'), pop = $('.concept-pop'), keys = $('.manifesto__keys');
  if (conceptBox && pop && keys) {
    Object.values(CONCEPTS).forEach(c => { const i = new Image(); i.src = c.img; });   // preload so it appears instantly
    let current = null;
    const show = k => {
      const c = CONCEPTS[k]; if (!c) return;
      current = k;
      const im = $('.concept-pop__img', pop);
      im.src = c.img; im.alt = c.k[lang];
      $('.concept-pop__mast', pop).textContent = c.w[lang];
      $('.concept-pop__k', pop).textContent = c.k[lang];
      $('.concept-pop__p', pop).textContent = c.p[lang];
      pop.classList.add('open');
      $$('button', keys).forEach(b => b.classList.toggle('on', b.dataset.k === k));
    };
    const hide = () => { current = null; pop.classList.remove('open'); $$('button', keys).forEach(b => b.classList.remove('on')); };
    const touch = matchMedia('(hover: none)');
    keys.addEventListener('mouseover', e => { if (touch.matches) return; const b = e.target.closest('button[data-k]'); if (b) show(b.dataset.k); });
    keys.addEventListener('mouseleave', () => { if (!touch.matches) hide(); });
    keys.addEventListener('focusin', e => { if (touch.matches) return; const b = e.target.closest('button[data-k]'); if (b) show(b.dataset.k); });
    keys.addEventListener('focusout', () => { if (!touch.matches) hide(); });
    keys.addEventListener('click', e => {   // touch screens: tap to open, tap again (or anywhere else) to close
      const b = e.target.closest('button[data-k]'); if (!b) return;
      e.stopPropagation();
      if (current === b.dataset.k && touch.matches) hide(); else show(b.dataset.k);
    });
    document.addEventListener('click', e => { if (current && !keys.contains(e.target)) hide(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    $$('.lang [data-l]').forEach(b => b.addEventListener('click', hide));
  }

  /* ---------- dot nav active state ---------- */
  const navLinks = $$('.dots a');
  const sections = navLinks.map(a => $(a.getAttribute('href')));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    let id = '#' + e.target.id;
    if (e.target.classList.contains('tour')) id = '#levels';
    navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === id));
  }), { rootMargin: '-50% 0px -50% 0px' });   // whichever section crosses the middle of the screen
  sections.concat($$('.tour')).forEach(s => s && io.observe(s));

  /* ---------- levels: B&W → colour on click, then walk through ---------- */
  $$('.tile[data-target]').forEach(t => t.addEventListener('click', e => {
    const btn = e.currentTarget, target = $(btn.dataset.target);
    target.hidden = false;                       // the immersive tour opens only on click
    $$('.tile').forEach(x => x.classList.toggle('is-open', x === btn));   // its number stays lit
    frameAll(true);
    setTimeout(() => { target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); }, reduced ? 0 : 600);
  }));

  /* ---------- "Enter the walkthrough" button opens Cielo's tour ---------- */
  $$('[data-open]').forEach(b => b.addEventListener('click', () => $(b.dataset.open).click()));

  /* ---------- reveal: slide in from the side and stay ---------- */
  const rio = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); }
  }), { threshold: 0.3 });
  $$('.reveal').forEach(el => reduced ? el.classList.add('in') : rio.observe(el));

  /* ---------- gallery for projects without a walkthrough yet ---------- */
  const lb = $('#lightbox'), lbImg = $('.lightbox__img', lb), lbCount = $('.lightbox__count', lb);
  let gal = null, gi = 0;
  function show(i) {
    gi = (i + gal.count) % gal.count;
    lbImg.src = `assets/${gal.id}/img/render-${String(gi + 1).padStart(2, '0')}.webp`;
    lbCount.textContent = `${gi + 1} / ${gal.count}`;
  }
  $$('[data-gallery]').forEach(b => b.addEventListener('click', () => {
    gal = { id: b.dataset.gallery, count: +b.dataset.count };
    lb.hidden = false; document.body.style.overflow = 'hidden'; show(0);
  }));
  const closeLb = () => { lb.hidden = true; document.body.style.overflow = ''; };
  $('.lightbox__x', lb).addEventListener('click', closeLb);
  $('.lightbox__prev', lb).addEventListener('click', () => show(gi - 1));
  $('.lightbox__next', lb).addEventListener('click', () => show(gi + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowRight') show(gi + 1);
    if (e.key === 'ArrowLeft') show(gi - 1);
  });

  /* =========================================================
     TOUR — scroll drives the camera through the shop.
     8 stops (stills) joined by 7 transition clips.
     Each stop is a "hold" where the camera rests and the
     design card appears; each clip is a "move".
     ========================================================= */
  const IMG = 'assets/heladeria/img/', VID = 'assets/heladeria/vid/';
  const STOPS = [
    { img: 'kf_planta', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'CIELO · Habitar en equilibrio', es: 'CIELO · Habitar en equilibrio' },
      p: { en: 'A space where people stop, look and enjoy. It reads as a sequence of pauses: warm light, texture and color, and an experience that begins before the first taste of ice cream.',
            es: 'Un espacio donde el usuario se detiene, mira y disfruta. Se lee como una secuencia de pausas: luz cálida, textura y color, y una experiencia que empieza antes de probar el helado.' },
      data: [{ l: { en: 'Type', es: 'Tipo de obra' }, v: { en: 'Remodeling', es: 'Remodelación' } }, { l: { en: 'Use', es: 'Uso del proyecto' }, v: { en: 'Açaí bowl shop', es: 'Venta de açaí bowls' } }, { l: { en: 'Location', es: 'Ubicación' }, v: 'Mosquera, Cundinamarca' }, { l: { en: 'Delivered', es: 'Fecha de entrega' }, v: { en: 'June 2026', es: 'Junio 2026' } }], cortes: true },
    { img: 'kf_aereo', k: { en: 'Organic', es: 'Orgánico' },
      t: { en: 'Curves that guide', es: 'Curvas que guían' },
      p: { en: 'The curves are drawn out of the wall and create a transition of breadth and visual order. The space tightens and opens gradually, and you reach the counter guided by form, with nothing in the way.',
            es: 'Las curvas se extraen de la pared y generan una transición de amplitud y orden visual. El espacio se comprime y se abre de forma gradual, y el usuario llega a la barra guiado por la forma, sin que nada lo interrumpa.' } },
    { img: 'kf_interior', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'The ceiling as the center', es: 'El techo como centro' },
      p: { en: 'The element that descends from the ceiling, with the plants and the lamp, is the most important space in the shop: it centers and orders everything else. Greenery overhead brings air quality and comfort. It is the “sky” that names the project.',
            es: 'El elemento que desciende del techo, junto con las plantas y la lámpara, es el espacio más importante del lugar: centra y ordena todo lo demás. La vegetación en altura conecta con la calidad del aire y el confort. Es el “cielo” que da nombre al proyecto.' } },
    { img: 'kf_circulos', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'Circles as thresholds', es: 'Círculos como umbrales' },
      p: { en: 'The views filtered through the circles in the wall work as a transition between levels: you see the next plane before reaching it, and a halo of light marks each threshold.',
            es: 'Las vistas filtradas por los círculos del muro funcionan como transición entre niveles: el usuario ve el siguiente plano antes de llegar a él, y el halo de luz marca los umbrales.' },
      data: ['Ø 0.70 m'] },
    { img: 'kf_counter', k: { en: 'Balance', es: 'Equilibrio' },
      t: { en: 'The organic and the graphic', es: 'Lo orgánico y lo gráfico' },
      p: { en: 'A balance between the organic (wood and native plants) and the graphic (curves, circles and the color of blueberries). The counter serves, and everything around it falls into order.',
            es: 'Un balance entre lo orgánico (madera y plantas autóctonas) y lo gráfico (curvas, círculos y el color de los arándanos). La barra sirve, y alrededor de ella todo se ordena.' },
      data: ['h 0.90 m'] },
    { img: 'kf_plantas', k: { en: 'Bioclimatic', es: 'Bioclimática' },
      t: { en: 'Air and native plants', es: 'Aire y plantas autóctonas' },
      p: { en: 'The shop lacked proper ventilation. The answer was a lattice grille in the door that renews the air naturally while keeping access and privacy under control: a simple closure became part of the climate strategy. Native plants bring freshness with less upkeep.',
            es: 'El local no contaba con la ventilación adecuada. La respuesta fue una rejilla tipo celosía en la puerta, que renueva el aire de forma natural y mantiene el control del acceso y la privacidad: un cierre pasó a ser parte de la estrategia climática. Las plantas autóctonas aportan frescura con menos mantenimiento.' } },
    { img: 'kf_toppings', k: { en: 'Phenomenology', es: 'Fenomenología' },
      t: { en: 'An experience that begins before the first taste', es: 'Una experiencia que empieza antes de probar' },
      p: { en: 'What does the person who will inhabit this place want to experience? A warm, fluid, natural and light space. The palette is born from the natural color of blueberries, against the green of native plants, linking the space with the product. Warm light sets the mood from the moment you walk in.',
            es: '¿Qué quiere experimentar quien habite este lugar? Un espacio cálido, fluido, natural y liviano. La gama de colores nace del color natural de los arándanos, en contraste con el verde de las plantas autóctonas, y vincula el espacio con el producto. La luz cálida define cómo se siente desde que se entra.' } },
    { img: 'kf_neon', side: 'l', narrow: true, k: { en: 'Dwelling', es: 'Habitar' },
      t: { en: 'Habitar en equilibrio', es: 'Habitar en equilibrio' },
      p: { en: 'CIELO is not just a point of sale: it is a place to stay. The upholstered bench creates a resting level where the gaze lowers and settles. The ceiling centers, the counter serves, the bench rests, and the curves and circles connect them.',
            es: 'CIELO no es solo un punto de venta: es un lugar para quedarse. La banca tapizada crea un nivel de descanso donde la mirada se baja y se aquieta. El techo centra, la barra sirve, la banca descansa, y las curvas y los círculos los conectan.' } },
  ];
  const CLIPS = ['clip00_planta-a-render', 'clip01_aereo-a-entrada', 'clip02_entrada-a-circulos',
                 'clip03_circulos-a-mostrador', 'clip04_mostrador-a-plantas', 'clip05_plantas-a-toppings', 'clip06_toppings-a-neon'];
  const RAIL = { en: ['Plan', 'Curves', 'Ceiling', 'Circles', 'Balance', 'Climate', 'Senses', 'Dwelling'],
                 es: ['Planta', 'Curvas', 'Techo', 'Círculos', 'Equilibrio', 'Clima', 'Sentidos', 'Habitar'] };

  /* ---------- FINCA LOMIX (proyecto-02, Cumaca): 7 renders from Luisa's Drive, no plan yet ---------- */
  const LOMIX_STOPS = [
    { img: 'kf_01', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'FINCA LOMIX · Habitar en equilibrio', es: 'FINCA LOMIX · Habitar en equilibrio' },
      p: { en: 'A family retreat open to its surroundings. A journey by levels leads from private to social and from social to the deck, and natural light and landscape order the experience.',
            es: 'Una casa familiar de retiro abierta a su entorno. Un recorrido por niveles lleva de lo privado a lo social y de lo social al deck, y la luz natural y el paisaje ordenan la experiencia.' },
      data: [{ l: { en: 'Type', es: 'Tipo de obra' }, v: { en: 'New build', es: 'Obra nueva' } }, { l: { en: 'Use', es: 'Uso del proyecto' }, v: { en: 'Country house', es: 'Finca campestre' } }, { l: { en: 'Location', es: 'Ubicación' }, v: 'Cumaca, Cundinamarca' }, { l: { en: 'Delivered', es: 'Fecha de entrega' }, v: { en: 'November 2022', es: 'Noviembre 2022' } }] },
    { img: 'kf_02', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'Why is the living room lower?', es: '¿Por qué la sala está más abajo?' },
      p: { en: 'The social level sits lower than the transition and private spaces, to connect with the outdoor deck. The descent is gradual, from the most private to the most open: you step down toward the landscape as you reach the social area.',
            es: 'El nivel social se genera más abajo que el espacio de transición y el privado, para conectar con el deck exterior. El descenso es progresivo, de lo más privado a lo más abierto, y el usuario baja hacia el paisaje al llegar a la zona social.' } },
    { img: 'kf_03', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'One social room', es: 'Un solo ambiente social' },
      p: { en: 'The dining room was not treated as an interior but as an outdoor space. Living and dining share one level, with no steps to break the continuity: inside and outside become one social room, where gathering and contemplating happen in the same place.',
            es: 'El comedor no se manejó como un espacio interior, sino como uno exterior. La sala y el comedor quedan al mismo nivel, sin escalones que interrumpan: interior y exterior funcionan como un solo ambiente, donde reunirse y contemplar el entorno ocurren en un mismo lugar.' } },
    { img: 'kf_04', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'What does a low wall do?', es: '¿Qué hace un muro bajo?' },
      p: { en: 'Between the hallway and the living room, the low wall creates separation and orders the path without blocking the view. You sense the social area from the hallway before you reach it.',
            es: 'Entre el pasillo y la sala, el muro bajo crea la separación y ordena el recorrido sin interrumpir la visual. La zona social se percibe desde el pasillo antes de llegar a ella.' } },
    { img: 'kf_05', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'How do you set the kitchen apart without closing it?', es: '¿Cómo se separa la cocina sin cerrarla?' },
      p: { en: 'Between the kitchen and the hallway, the wall is a visual barrier more than a spatial one. The kitchen stays sheltered from view, yet remains connected to the rest of the house.',
            es: 'Entre la cocina y el pasillo, el muro genera una barrera más visual que espacial. La cocina queda resguardada a la vista, pero sigue conectada con el resto del espacio.' } },
    { img: 'kf_06', k: { en: 'Phenomenology', es: 'Fenomenología' },
      t: { en: 'Bright, natural, warm, open', es: 'Luminosa, natural, cálida, abierta' },
      p: { en: 'The house wants to be felt as bright, natural, warm, open and connected. The rear entrance offers a full view of the integrated space as you walk in, and the glass sliding doors make the landscape part of the design. Sunlight reflects on colors and objects and adds warmth.',
            es: 'La finca quiere experimentarse luminosa, natural, cálida, abierta y conectada con su entorno. El acceso posterior regala una visual completa del espacio integrado al entrar, y las puertas correderas de vidrio hacen del paisaje parte del diseño. La luz solar se refleja en los colores y objetos, y aporta calidez.' } },
    { img: 'kf_07', k: { en: 'Bioclimatic', es: 'Bioclimática' },
      t: { en: 'Designed with sun and wind', es: 'Diseñada con el sol y el viento' },
      p: { en: 'A study of winds and the sun chart defined where the house sits on the lot. Its height creates cross ventilation: warm air rises and escapes, fresh air comes in. Gutters collect rainwater for bathrooms and irrigation, and local split stone ties the façade to its land.',
            es: 'Un estudio de vientos y carta solar definió la implantación en el lote. La altura genera ventilación cruzada: el aire caliente asciende y sale, y el fresco se renueva. Las canaletas recogen el agua lluvia para baños y riego, y la roca fraccionada del lugar vincula la fachada con su territorio.' } },
  ];
  // null = clip not generated yet → the stills crossfade instead
  const LOMIX_CLIPS = ['clip01b_render01-a-render02', 'clip02_render02-a-render03', 'clip03_render03-a-render04', 'clip04_render04-a-render05', 'clip05_render05-a-render06', 'clip06b_render06-a-render07'];
  const LOMIX_INTRO = 'intro_render01', LOMIX_OUTRO = 'outro_render07';   // Kling + real zoom on its own pixels
  const LOMIX_RAIL = { en: ['Arrival', 'Living', 'Social', 'Low wall', 'Kitchen', 'Light', 'Climate'],
                       es: ['Llegada', 'Sala', 'Social', 'Muro bajo', 'Cocina', 'Luz', 'Clima'] };

  /* ---------- EL REFUGIO (proyecto-03, Pacho) — story: arrive → fire → sofa → table → dining → kitchen → detail ---------- */
  const PACHO_STOPS = [
    { img: 'kf_01', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'EL REFUGIO · Habitar en equilibrio', es: 'EL REFUGIO · Habitar en equilibrio' },
      p: { en: 'A family home that grows without losing its identity. The project synchronizes the existing and the new through levels, controlled light and views to the surroundings, so that every space is lived as part of one whole.',
            es: 'Una casa familiar que se amplía sin perder su identidad. El proyecto sincroniza lo existente con lo nuevo a través de niveles, luz controlada y visuales hacia el entorno, para que cada espacio se viva como parte de un mismo conjunto.' },
      data: [{ l: { en: 'Type', es: 'Tipo de obra' }, v: { en: 'Extension & remodel', es: 'Ampliación y remodelación' } }, { l: { en: 'Use', es: 'Uso del proyecto' }, v: { en: 'Country family home', es: 'Vivienda familiar campestre' } }, { l: { en: 'Location', es: 'Ubicación' }, v: 'Pacho, Cundinamarca' }, { l: { en: 'Delivered', es: 'Fecha de entrega' }, v: { en: 'November 2025', es: 'Noviembre 2025' } }] },
    { img: 'kf_05', k: { en: 'Bioclimatic', es: 'Bioclimática' },
      t: { en: 'How does light come in without excess?', es: '¿Cómo entra la luz sin exceso?' },
      p: { en: 'The pergola and the glass curtain light the space and give it warmth, with tinted solar-control glass that avoids excess direct light. Above, a lattice lintel creates cross ventilation with the round window: warm air leaves from the top and the air renews itself.',
            es: 'La pérgola y la cortina de cristal iluminan el espacio y le dan calidez, con vidrio de control solar tintado que evita el exceso de luz directa. Encima, una celosía como dintel genera ventilación cruzada con la ventana circular: el aire caliente sale por arriba y se renueva de forma natural.' } },
    { img: 'kf_06', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'Why does the deck have two levels?', es: '¿Por qué el deck tiene dos niveles?' },
      p: { en: 'Two spaces, each with its own role. One for passing through, level with the interior, extends the living area outdoors. One for staying, a level lower so it does not block the view from inside: whoever stays there feels more sheltered and gathered.',
            es: 'Dos espacios, cada uno con su función. Uno transitorio, al mismo nivel social del interior, prolonga la sala hacia afuera. Otro de permanencia, más bajo, para no afectar la visual desde adentro: quien se queda en él lo hace en un lugar más resguardado y recogido.' } },
    { img: 'kf_07', k: { en: 'Phenomenology', es: 'Fenomenología' },
      t: { en: 'Warm and close', es: 'Cálida y cercana' },
      p: { en: 'Outside, transparency creates two sensations: warmth, from the direct light, and closeness to the landscape, from the views that open from inside. The round window creates a visual hierarchy and breaks through the brick side wall.',
            es: 'En el exterior, la transparencia crea dos sensaciones: calidez, por la entrada directa de la luz, y cercanía con el paisaje, por las visuales que se abren desde el interior. La ventana circular genera una jerarquía visual y rompe con la barrera del muro de ladrillo lateral.' } },
    { img: 'kf_02', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'How do you separate social and private without walls?', es: '¿Cómo se separa lo social de lo privado sin muros?' },
      p: { en: 'The extension sits one level apart from the existing structure. It separates the social zone (extension) from the private one (remodel) without walls: the level does the separating, and you can read what is new and what was there. The hallway joins them gradually, without either losing its character.',
            es: 'La ampliación tiene un nivel de diferencia respecto a la estructura existente. Separa la zona social (ampliación) de la privada (remodelación) sin muros: la separación la hace el nivel, y se lee qué es lo nuevo y qué lo existente. El pasillo las articula de forma gradual, sin que pierdan su carácter.' } },
    { img: 'kf_03', k: { en: 'Phenomenology', es: 'Fenomenología' },
      t: { en: 'New, without breaking with the old', es: 'Lo nuevo, sin romper con lo anterior' },
      p: { en: 'The color palette is taken from the existing building, creating a homogeneous visual pattern: the new is recognized without breaking with the old, and the whole house feels like a single ensemble.',
            es: 'Se toma la paleta de colores de la edificación existente, que crea un patrón visual homogéneo: lo nuevo se reconoce sin romper con lo anterior, y toda la casa se siente como un solo conjunto.' } },
    { img: 'kf_04', k: { en: 'Balance', es: 'Equilibrio' },
      t: { en: 'Habitar en equilibrio', es: 'Habitar en equilibrio' },
      p: { en: 'A gutter joins the new roof with the existing one in a single reading and collects rainwater to irrigate the gardens. Old and new, controlled light and renewed air: a space that is warm, fresh and close to its surroundings at once.',
            es: 'Una canaleta une la cubierta nueva con la existente en una sola lectura y recoge el agua lluvia para el riego de los jardines. Lo existente y lo nuevo, luz controlada y aire renovado: un espacio cálido, fresco y cercano al entorno a la vez.' } },
  ];
  // every connector is real camera movement between two of Luisa's renders (reviewed frame by frame)
  const PACHO_CLIPS = ['r01_sala-a-fuego', 'r02_fuego-a-sofa', 'clip06_sofa-a-mesa',
                       'r04_mesa-a-comedor', 'clip02_comedor-a-cocina', 'clip03_cocina-a-detalle'];
  const PACHO_INTRO = 'intro_render01';
  const PACHO_RAIL = { en: ['Arrival', 'Fire', 'Deck', 'Warmth', 'Dining', 'Palette', 'Balance'],
                       es: ['Llegada', 'Fuego', 'Deck', 'Calidez', 'Comedor', 'Paleta', 'Equilibrio'] };

  /* ---------- CASA NIDO (proyecto-04, Anapoima) — story: plan → garden → fire pit → pergola → glass doors → inside → detail ---------- */
  const NIDO_STOPS = [
    { img: 'kf_planta', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'CASA NIDO · Habitar en equilibrio', es: 'CASA NIDO · Habitar en equilibrio' },
      p: { en: 'A home that opens to the garden and gathers inward at once. The remodel gives it a new purpose, to stay, to enjoy and to contemplate, and integrates the interior with its natural surroundings.',
            es: 'Una casa que se abre al jardín y se recoge a la vez. La remodelación le da un nuevo propósito, la permanencia, el disfrute y la contemplación, e integra el interior con el entorno natural.' },
      data: [{ l: { en: 'Type', es: 'Tipo de obra' }, v: { en: 'Remodel', es: 'Remodelación' } }, { l: { en: 'Use', es: 'Uso del proyecto' }, v: { en: 'Home', es: 'Vivienda' } }, { l: { en: 'Location', es: 'Ubicación' }, v: 'Anapoima, Cundinamarca' }, { l: { en: 'Delivered', es: 'Fecha de entrega' }, v: { en: 'January 2024', es: 'Enero 2024' } }] },
    { img: 'kf_02', k: { en: 'Phenomenology', es: 'Fenomenología' },
      t: { en: 'A garden that embraces the house', es: 'Un jardín que abraza la casa' },
      p: { en: 'Local vegetation was chosen so the garden embraces the house and the way to the patio becomes a sensory experience: the color and scent of plants, the shade of trees, the sounds around. Being native species, they need less water and upkeep.',
            es: 'Se seleccionó vegetación del sector para que el jardín abrace la casa y el recorrido al patio sea una experiencia sensorial: el color y el aroma de las plantas, la sombra de los árboles y los sonidos del entorno. Al ser especies del lugar, requieren menos agua y mantenimiento.' } },
    { img: 'kf_06', k: { en: 'Bioclimatic', es: 'Bioclimática' },
      t: { en: 'A patio made to stay', es: 'Un patio para quedarse' },
      p: { en: 'Outside, a pergola with vegetation gives shade and ventilation, so you can stay on the patio in comfort. The outdoor lighting runs on renewable energy from solar panels.',
            es: 'En el exterior, una pérgola acompañada de vegetación genera sombra y ventilación, para permanecer en el patio de forma confortable. La iluminación exterior utiliza energía renovable mediante paneles solares.' } },
    { img: 'kf_04', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'The glass façade as a threshold', es: 'La fachada de vidrio como umbral' },
      p: { en: 'Glass doors with black frames mark the passage between interior and garden. The lintel sets a visual level: the height drops at the frame, and that brief compression makes the space release toward the garden as you cross, feeling wider.',
            es: 'Las puertas de vidrio con perfiles negros marcan el paso entre el interior y el jardín. El dintel define un nivel visual: la altura disminuye en el marco, y esa compresión puntual hace que, al cruzar, el espacio se libere hacia el jardín y se perciba más amplio.' } },
    { img: 'kf_01', k: { en: 'Environment', es: 'Entorno' },
      t: { en: 'Where does the living room end?', es: '¿Dónde termina la sala?' },
      p: { en: 'The doors open completely: living room and patio work as a single room, with natural light and ventilation that reduce the need for artificial light. Transparency lets you read the space as one.',
            es: 'Las puertas se abren por completo: sala y patio funcionan como un solo ambiente, con ventilación e iluminación natural que reducen la dependencia de la luz artificial. La transparencia permite leer el espacio como uno solo.' } },
    { img: 'kf_03', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'Why a small change of level?', es: '¿Por qué un pequeño cambio de nivel?' },
      p: { en: 'A small change of level drains water from outside without affecting the interior and marks the line between covered and open: a technical decision that becomes part of the hierarchy. Right there, a channel collects rainwater for the bathrooms.',
            es: 'Un pequeño cambio de nivel resuelve el desagüe desde el exterior sin afectar el interior y marca el límite entre lo cubierto y lo abierto: una decisión técnica que se vuelve parte de la jerarquía. Justo ahí, un canal recoge el agua lluvia para los baños.' } },
    { img: 'kf_05', k: { en: 'Balance', es: 'Equilibrio' },
      t: { en: 'Habitar en equilibrio', es: 'Habitar en equilibrio' },
      p: { en: 'The warmth of wood, color and light, natural by day and artificial as evening falls, with the nature of the garden. Warm, organic, versatile and natural: a nest that gathers and protects without isolating from its surroundings.',
            es: 'Lo cálido de la madera, el color y la luz, natural de día y artificial al caer la tarde, junto a lo natural del jardín. Cálido, orgánico, versátil y natural: un nido que recoge y protege sin aislar del entorno.' } },
  ];
  // every clip reviewed frame by frame: real camera moves between Luisa's renders
  const NIDO_CLIPS = ['n00_planta-a-jardin', 'n01_jardin-a-fogata', 'n02_fogata-a-pergola',
                      'n03_pergola-a-puertas', 'n04_umbral-360', 'n05_sala-a-mesa'];
  const NIDO_OUTRO = 'outro_mesa';
  const NIDO_INTRO = 'intro_planos';   // Luisa's drawings: plans → façade → section → 3D → plan in color (no AI)
  const NIDO_RAIL = { en: ['Plan', 'Garden', 'Patio', 'Threshold', 'Living', 'Level', 'Balance'],
                      es: ['Planta', 'Jardín', 'Patio', 'Umbral', 'Sala', 'Nivel', 'Equilibrio'] };

  /* =========================================================
     Tour engine — one instance per project walkthrough.
     ========================================================= */
  const HOLD = 0.75, MOVE = 1.15, FADE = 0.10;      // in viewport-heights of scroll
  const inTour = new Set();

  function makeTour(tour, cfg) {
    const { stops: STOPS, clips: CLIPS, rail: RAIL, fadeOut: FADE_OUT = {} } = cfg;
    const IMG = cfg.base + 'img/', VID = cfg.base + 'vid/';
    // optional opening / closing camera moves (intro lands on the first stop, outro leaves from the last)
    const PRE = cfg.intro ? (cfg.introLen || MOVE) : 0, POST = cfg.outro ? MOVE : 0;   // a long intro can take more scroll
    const TOTAL = PRE + STOPS.length * HOLD + CLIPS.length * MOVE + POST;
    const media = $('.tour__media', tour), cards = $('.tour__cards', tour), rail = $('.tour__rail', tour), bar = $('.tour__bar i', tour);
    tour.style.height = `calc(${TOTAL * 100}svh + 100svh)`;

    // stills (instant poster for every stop)
    const stills = STOPS.map(s => {
      const im = new Image(); im.alt = ''; im.decoding = 'async'; retryImg(im);
      im.src = IMG + s.img + '.webp';
      media.appendChild(im); return im;
    });
    // videos (lazy, loaded as blobs so seeking always works)
    const vids = CLIPS.map(() => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      media.appendChild(v); v._state = 'idle'; return v;
    });
    const mkVid = () => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      media.appendChild(v); v._state = 'idle'; return v;
    };
    const introV = cfg.intro ? mkVid() : null, outroV = cfg.outro ? mkVid() : null;
    let tourNear = false;           // don't compete with the hero video on first load
    function load(i) { loadV(vids[i], CLIPS[i]); }
    function loadV(v, name) {
      if (!v || !name || v._state !== 'idle' || reduced || !tourNear) return;
      v._state = 'loading';
      const url = VID + name + (mobile ? '-m' : '') + '.mp4';
      const attempt = n => {
        const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 30000);
        fetch(url, { signal: ctrl.signal })
          .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
          .then(b => {
            clearTimeout(to);
            v.addEventListener('loadeddata', () => { v._state = 'ready'; }, { once: true });
            v.src = URL.createObjectURL(b); v.load();
          })
          .catch(() => {
            clearTimeout(to);
            if (n < 4) setTimeout(() => attempt(n + 1), 500 * (n + 1)); else v._state = 'idle';
          });
      };
      attempt(0);
    }

    // text side per stop: alternate, unless a stop overrides it to keep clear of the design (e.g. the neon)
    const sideOf = i => STOPS[i].side || (i % 2 ? 'r' : 'l');

    function renderText() {
      // magazine cover layout (ref. Hospitality Design): huge sans keyword, thin kicker, rule, serif title
      cards.innerHTML = STOPS.map((s, i) => `
        <article class="card card--${sideOf(i)}${s.narrow ? ' card--narrow' : ''}" data-i="${i}">
          <p class="card__mast">${s.k[lang]}</p>
          <p class="card__k">${String(i + 1).padStart(2, '0')} / ${String(STOPS.length).padStart(2, '0')}</p>
          <h3>${s.t[lang]}</h3>
          ${s.p[lang] ? `<p class="card__p">${s.p[lang]}</p>` : ''}
          ${s.data ? `<div class="card__data">${s.data.map(d => { const t = x => typeof x === 'object' ? x[lang] : (lang === 'es' ? x.replace(/(\d)\.(\d)/g, '$1,$2') : x); return d && d.l ? `<span class="is-l"><small>${d.l[lang]}</small>${t(d.v)}</span>` : `<span>${t(d)}</span>`; }).join('')}</div>` : ''}
          ${s.cortes ? `<div class="card__cortes">${['a1', 'a2', 'b1', 'b2'].map(c => `<img src="${IMG}corte-${c}.webp" alt="Corte ${c.toUpperCase()}">`).join('')}</div>` : ''}
        </article>`).join('');
      rail.innerHTML = RAIL[lang].map((n, i) => `<li data-i="${i}">${n}</li>`).join('');
      $$('li', rail).forEach(li => li.addEventListener('click', () => jumpTo(+li.dataset.i)));
      lastStop = -1; frame(true);
    }

    function jumpTo(i) {
      const top = tour.offsetTop + (PRE + i * (HOLD + MOVE) + HOLD * 0.35) * innerHeight;
      scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    }

    // map scroll → { stop being held | clip being played }
    function locate(u) {           // u in viewport-heights
      if (PRE) { if (u < PRE) return { intro: true, t: u / PRE }; u -= PRE; }
      for (let i = 0; i < STOPS.length; i++) {
        if (u < HOLD) return { hold: i, h: u / HOLD };
        u -= HOLD;
        if (i < CLIPS.length) { if (u < MOVE) return { clip: i, t: u / MOVE }; u -= MOVE; }
      }
      if (POST) return { outro: true, t: Math.min(u / POST, 1) };
      return { hold: STOPS.length - 1, h: 1 };
    }

    let lastStop = -1, target = 0, smooth = 0;
    function frame(force) {
      if (tour.hidden) { inTour.delete(tour); return; }
      const r = tour.getBoundingClientRect();
      const u = Math.min(Math.max(-r.top / innerHeight, 0), TOTAL);
      target = u;
      if (force) smooth = u;
      if (r.top < innerHeight * 2.5) tourNear = true;
      if (r.top < innerHeight * .5 && r.bottom > innerHeight * .5) inTour.add(tour); else inTour.delete(tour);
    }

    function tick() {
      if (tour.hidden) return;
      smooth += (target - smooth) * (reduced ? 1 : 0.14);
      const L = locate(smooth);
      const last = STOPS.length - 1;
      const stop = L.intro ? 0 : L.outro ? last : L.hold ?? (L.t < 0.5 ? L.clip : L.clip + 1);
      const near = L.intro ? 0 : L.outro ? last : L.hold ?? L.clip;
      for (let j = near - 1; j <= near + 2; j++) load(j);
      loadV(introV, cfg.intro);
      if (near >= last - 1) loadV(outroV, cfg.outro);

      // reset visibility
      stills.forEach(s => s.style.opacity = 0);
      vids.forEach(v => v.style.opacity = 0);
      if (introV) introV.style.opacity = 0;
      if (outroV) outroV.style.opacity = 0;
      const scrub = (v, t) => { const tt = t * (v.duration || 5); if (!v.seeking && Math.abs(v.currentTime - tt) > 1 / 48) v.currentTime = tt; };

      if (L.intro) {
        // opening move: the camera arrives and lands exactly on the first render
        if (introV._state === 'ready') {
          scrub(introV, L.t); introV.style.opacity = 1;
          if (L.t > 1 - FADE) stills[0].style.opacity = (L.t - (1 - FADE)) / FADE;
        } else stills[0].style.opacity = 1;
      } else if (L.outro) {
        // closing move: from the last render into its details
        stills[last].style.opacity = 1;
        if (outroV._state === 'ready') { scrub(outroV, L.t); outroV.style.opacity = Math.min(1, L.t / FADE); }
      } else if (L.hold !== undefined) {
        stills[L.hold].style.opacity = 1;                 // exact keyframe, always crisp
      } else {
        const i = L.clip, v = vids[i];
        // fade from the still into the clip, and from the clip into the next still
        stills[i].style.opacity = 1;
        if (v._state === 'ready') {
          const tt = L.t * (v.duration || 5);
          if (!v.seeking && Math.abs(v.currentTime - tt) > 1 / 48) v.currentTime = tt;
          v.style.opacity = Math.min(1, L.t / FADE);
          const out = FADE_OUT[i] || FADE;     // some clips end on a soft dissolve into the next stop
          if (L.t > 1 - out) { stills[i + 1].style.opacity = (L.t - (1 - out)) / out; }
        } else {
          // clip not loaded (or not made yet): crossfade stills so the page never looks frozen
          stills[i + 1].style.opacity = L.t;
        }
      }

      if (stop !== lastStop) {
        tour.classList.toggle('side-r', sideOf(stop) === 'r');   // scrim follows the text side
        $$('.card', cards).forEach(c => c.classList.toggle('on', +c.dataset.i === stop && L.hold !== undefined));
        $$('li', rail).forEach(li => li.classList.toggle('on', +li.dataset.i <= stop));
        lastStop = stop;
      }
      // card only shows while the camera rests
      const card = $(`.card[data-i="${stop}"]`, cards);
      if (card) card.classList.toggle('on', L.hold !== undefined);
      bar.style.width = (smooth / TOTAL * 100) + '%';
    }

    return { renderText, frame, tick };
  }

  const tours = [
    makeTour($('#cielo'), { base: 'assets/heladeria/', stops: STOPS, clips: CLIPS, rail: RAIL,
                            fadeOut: { 1: 0.38 } }),   // drone descent (clip01) dissolves gently into the arrival view
    makeTour($('#lomix'), { base: 'assets/proyecto-02/', stops: LOMIX_STOPS, clips: LOMIX_CLIPS, rail: LOMIX_RAIL,
                            intro: LOMIX_INTRO, outro: LOMIX_OUTRO }),
    makeTour($('#pacho'), { base: 'assets/proyecto-03/', stops: PACHO_STOPS, clips: PACHO_CLIPS, rail: PACHO_RAIL,
                            intro: PACHO_INTRO }),
    makeTour($('#nido'), { base: 'assets/proyecto-04/', stops: NIDO_STOPS, clips: NIDO_CLIPS, rail: NIDO_RAIL,
                           intro: NIDO_INTRO, introLen: 3.4, outro: NIDO_OUTRO }),
  ];
  function renderTourText() { tours.forEach(t => t.renderText()); }
  function frameAll(force) {
    tours.forEach(t => t.frame(force));
    document.body.classList.toggle('in-tour', inTour.size > 0);
  }
  function loop() { tours.forEach(t => t.tick()); requestAnimationFrame(loop); }

  addEventListener('scroll', () => { frameAll(); document.body.classList.toggle('scrolled', scrollY > innerHeight * .6); }, { passive: true });
  addEventListener('resize', () => frameAll(true));

  applyLang(lang);
  frameAll(true);
  requestAnimationFrame(loop);
})();
