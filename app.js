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
  setInterval(() => {
    rots[ri].classList.remove('on');
    ri = (ri + 1) % rots.length;
    setTimeout(() => rots[ri].classList.add('on'), 750);
  }, 4200);

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
      p: { en: 'A space where you pause, look and enjoy. An experience that begins before the first taste.',
           es: 'Un espacio donde te detienes, miras y disfrutas. Una experiencia que empieza antes de probar.' },
      data: [{ en: 'Remodeling', es: 'Remodelación' }, { en: 'Açaí bowl shop', es: 'Venta de açaí bowls' }, 'Mosquera, Cundinamarca', { en: 'June 2026', es: 'Junio 2026' }], cortes: true },
    { img: 'kf_aereo', k: { en: 'Organic', es: 'Orgánico' },
      t: { en: 'Curves that guide', es: 'Curvas que guían' },
      p: { en: 'The wall unfolds into curves. The space tightens and opens, and form leads you to the counter.',
           es: 'El muro se extrae en curvas. El espacio se comprime y se abre, y la forma te guía hasta la barra.' } },
    { img: 'kf_interior', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'The ceiling as the center', es: 'El techo como centro' },
      p: { en: 'What descends from the ceiling, with plants and light, orders the whole space. It is the “sky” that names the project.',
           es: 'Lo que desciende del techo, con plantas y luz, ordena todo el espacio. Es el “cielo” que da nombre al proyecto.' } },
    { img: 'kf_circulos', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'Circles as thresholds', es: 'Círculos como umbrales' },
      p: { en: 'You see the next plane before reaching it. A halo of light marks each threshold.',
           es: 'Ves el siguiente plano antes de llegar a él. Un halo de luz marca cada umbral.' },
      data: ['Ø 0.70 m'] },
    { img: 'kf_counter', k: { en: 'Balance', es: 'Equilibrio' },
      t: { en: 'The organic and the graphic', es: 'Lo orgánico y lo gráfico' },
      p: { en: 'Wood and native plants against curves, circles and the color of blueberries: a balance you can feel.',
           es: 'Madera y plantas autóctonas frente a curvas, círculos y el color de los arándanos: un equilibrio que se siente.' },
      data: ['h 0.90 m'] },
    { img: 'kf_plantas', k: { en: 'Bioclimatic', es: 'Bioclimática' },
      t: { en: 'Air and native plants', es: 'Aire y plantas autóctonas' },
      p: { en: 'A lattice grille in the door renews the air naturally. Native plants bring freshness with less upkeep.',
           es: 'Una celosía en la puerta renueva el aire de forma natural. Las plantas autóctonas aportan frescura con menos mantenimiento.' } },
    { img: 'kf_toppings', k: { en: 'Phenomenology', es: 'Fenomenología' },
      t: { en: 'An experience that begins before the first taste', es: 'Una experiencia que empieza antes de probar' },
      p: { en: 'Warm light, texture and color: the palette is born from the fruit itself, linking the space with the product.',
           es: 'Luz cálida, textura y color: la paleta nace de la propia fruta y vincula el espacio con el producto.' } },
    { img: 'kf_neon', side: 'l', narrow: true, k: { en: 'Dwelling', es: 'Habitar' },
      t: { en: 'Habitar en equilibrio', es: 'Habitar en equilibrio' },
      p: { en: 'A place to stay: benches, greenery and warm light. The ceiling centers, the counter serves, the bench rests.',
           es: 'Un lugar para quedarse: bancas, vegetación y luz cálida. El techo centra, la barra sirve, la banca descansa.' } },
  ];
  const CLIPS = ['clip00_planta-a-render', 'clip01_aereo-a-entrada', 'clip02_entrada-a-circulos',
                 'clip03_circulos-a-mostrador', 'clip04_mostrador-a-plantas', 'clip05_plantas-a-toppings', 'clip06_toppings-a-neon'];
  const RAIL = { en: ['Plan', 'Curves', 'Ceiling', 'Circles', 'Balance', 'Climate', 'Senses', 'Dwelling'],
                 es: ['Planta', 'Curvas', 'Techo', 'Círculos', 'Equilibrio', 'Clima', 'Sentidos', 'Habitar'] };

  /* ---------- FINCA LOMIX (proyecto-02, Cumaca): 7 renders from Luisa's Drive, no plan yet ---------- */
  const LOMIX_STOPS = [
    { img: 'kf_01', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'FINCA LOMIX · Habitar en equilibrio', es: 'FINCA LOMIX · Habitar en equilibrio' },
      p: { en: 'A family retreat open to its surroundings. A journey by levels: from private to social, and from social to the deck.',
           es: 'Una casa familiar de retiro abierta a su entorno. Un recorrido por niveles: de lo privado a lo social, y de lo social al deck.' },
      data: [{ en: 'New build', es: 'Obra nueva' }, { en: 'Country house', es: 'Finca campestre' }, 'Cumaca, Cundinamarca', { en: 'November 2022', es: 'Noviembre 2022' }] },
    { img: 'kf_02', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'Why is the living room lower?', es: '¿Por qué la sala está más abajo?' },
      p: { en: 'To meet the deck. The descent is gradual, from the most private to the most open: you step down toward the landscape.',
           es: 'Para conectar con el deck. El descenso es progresivo, de lo más privado a lo más abierto: se baja hacia el paisaje.' } },
    { img: 'kf_03', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'One social room', es: 'Un solo ambiente social' },
      p: { en: 'Living and dining share one level, no steps. The dining room works as an outdoor space: inside and outside, together.',
           es: 'Sala y comedor comparten el mismo nivel, sin escalones. El comedor funciona como espacio exterior: interior y exterior, juntos.' } },
    { img: 'kf_04', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'What does a low wall do?', es: '¿Qué hace un muro bajo?' },
      p: { en: 'It orders the path without blocking the view. From the hallway you already sense the living room before you reach it.',
           es: 'Ordena el recorrido sin interrumpir la visual. Desde el pasillo ya se percibe la sala antes de llegar a ella.' } },
    { img: 'kf_05', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'How do you set the kitchen apart without closing it?', es: '¿Cómo se separa la cocina sin cerrarla?' },
      p: { en: 'With a visual barrier more than a spatial one. The kitchen stays sheltered from view, yet connected to everything.',
           es: 'Con una barrera más visual que espacial. La cocina queda resguardada a la vista, pero conectada con todo.' } },
    { img: 'kf_06', k: { en: 'Phenomenology', es: 'Fenomenología' },
      t: { en: 'Bright, natural, warm, open', es: 'Luminosa, natural, cálida, abierta' },
      p: { en: 'Sunlight reflects on colors and objects and fills the space with warmth. Glass sliding doors bring the landscape inside.',
           es: 'La luz del sol se refleja en colores y objetos y llena el espacio de calidez. Las puertas correderas de vidrio traen el paisaje adentro.' } },
    { img: 'kf_07', k: { en: 'Bioclimatic', es: 'Bioclimática' },
      t: { en: 'Designed with sun and wind', es: 'Diseñada con el sol y el viento' },
      p: { en: 'Sited by wind and sun path. Cross ventilation, rainwater for irrigation and bathrooms, and local stone on the façade.',
           es: 'Implantada según los vientos y la carta solar. Ventilación cruzada, agua lluvia para riego y baños, y roca del lugar en la fachada.' } },
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
      p: { en: 'A family home that grows without losing its identity: old and new, synchronized through levels, controlled light and views to the landscape.',
           es: 'Una casa familiar que se amplía sin perder su identidad: lo existente y lo nuevo, sincronizados por niveles, luz controlada y visuales al entorno.' },
      data: [{ en: 'Extension & remodel', es: 'Ampliación y remodelación' }, { en: 'Country family home', es: 'Vivienda familiar campestre' }, 'Pacho, Cundinamarca', { en: 'November 2025', es: 'Noviembre 2025' }] },
    { img: 'kf_05', k: { en: 'Bioclimatic', es: 'Bioclimática' },
      t: { en: 'How does light come in without excess?', es: '¿Cómo entra la luz sin exceso?' },
      p: { en: 'Pergola and glass curtain with tinted solar-control glass. Above it, a lattice lets hot air out and renews the air naturally.',
           es: 'Pérgola y cortina de cristal con vidrio de control solar tintado. Arriba, una celosía deja salir el aire caliente y lo renueva de forma natural.' } },
    { img: 'kf_06', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'Why does the deck have two levels?', es: '¿Por qué el deck tiene dos niveles?' },
      p: { en: 'One for passing through, level with the interior. One for staying, lower, so the view from inside stays free and the deck feels sheltered.',
           es: 'Uno de tránsito, al nivel del interior. Otro de permanencia, más bajo, para no tapar la visual desde adentro y sentirse resguardado.' } },
    { img: 'kf_07', k: { en: 'Phenomenology', es: 'Fenomenología' },
      t: { en: 'Warm and close', es: 'Cálida y cercana' },
      p: { en: 'Transparency lets direct light in and brings the landscape near: warmth and closeness at once.',
           es: 'La transparencia deja entrar la luz directa y acerca el paisaje: calidez y cercanía a la vez.' } },
    { img: 'kf_02', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'How do you separate social and private without walls?', es: '¿Cómo se separa lo social de lo privado sin muros?' },
      p: { en: 'With one level of difference. The social extension sits apart from the remodeled private zone: the level does the separating, and you can read what is new.',
           es: 'Con un nivel de diferencia. La ampliación social queda aparte de la zona privada remodelada: la separación la hace el nivel, y se lee qué es lo nuevo.' } },
    { img: 'kf_03', k: { en: 'Phenomenology', es: 'Fenomenología' },
      t: { en: 'New, without breaking with the old', es: 'Lo nuevo, sin romper con lo anterior' },
      p: { en: 'The palette comes from the existing building: one homogeneous pattern, so the whole house feels like a single ensemble.',
           es: 'La paleta se toma de la edificación existente: un patrón homogéneo para que toda la casa se sienta como un solo conjunto.' } },
    { img: 'kf_04', k: { en: 'Balance', es: 'Equilibrio' },
      t: { en: 'Habitar en equilibrio', es: 'Habitar en equilibrio' },
      p: { en: 'Old and new, light and air, rainwater that waters the gardens: a home that is warm, fresh and close to its surroundings.',
           es: 'Lo existente y lo nuevo, la luz y el aire, el agua lluvia que riega los jardines: una casa cálida, fresca y cercana al entorno.' } },
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
      p: { en: 'A home that opens to the garden and gathers inward at once. Its new purpose: to stay, to enjoy and to contemplate.',
           es: 'Una casa que se abre al jardín y se recoge a la vez. Su nuevo propósito: la permanencia, el disfrute y la contemplación.' },
      data: [{ en: 'Remodel', es: 'Remodelación' }, { en: 'Home', es: 'Vivienda' }, 'Anapoima, Cundinamarca', { en: 'January 2024', es: 'Enero 2024' }] },
    { img: 'kf_02', k: { en: 'Phenomenology', es: 'Fenomenología' },
      t: { en: 'A garden that embraces the house', es: 'Un jardín que abraza la casa' },
      p: { en: 'Local vegetation turns the way to the patio into a sensory journey: color and scent, the shade of trees, the sounds around.',
           es: 'La vegetación del sector convierte el camino al patio en una experiencia sensorial: color y aroma, sombra de los árboles y sonidos del entorno.' } },
    { img: 'kf_06', k: { en: 'Bioclimatic', es: 'Bioclimática' },
      t: { en: 'A patio made to stay', es: 'Un patio para quedarse' },
      p: { en: 'A pergola with plants gives shade and ventilation. The outdoor lighting runs on solar panels.',
           es: 'Una pérgola con vegetación da sombra y ventilación. La iluminación exterior funciona con paneles solares.' } },
    { img: 'kf_04', k: { en: 'Hierarchy', es: 'Jerarquía' },
      t: { en: 'The glass façade as a threshold', es: 'La fachada de vidrio como umbral' },
      p: { en: 'Glass doors with black frames. The lintel lowers the height: as you cross, the space releases toward the garden.',
           es: 'Puertas de vidrio con perfiles negros. El dintel baja la altura: al cruzar, el espacio se libera hacia el jardín.' } },
    { img: 'kf_01', k: { en: 'Environment', es: 'Entorno' },
      t: { en: 'Where does the living room end?', es: '¿Dónde termina la sala?' },
      p: { en: 'The doors open completely: living room and patio become one space, with natural light and air.',
           es: 'Las puertas se abren por completo: sala y patio funcionan como un solo espacio, con luz y ventilación natural.' } },
    { img: 'kf_03', k: { en: 'Levels', es: 'Niveles' },
      t: { en: 'Why a small change of level?', es: '¿Por qué un pequeño cambio de nivel?' },
      p: { en: 'It drains water from outside and marks the line between covered and open. There, a channel collects rainwater for the bathrooms.',
           es: 'Resuelve el desagüe desde el exterior y marca el límite entre lo cubierto y lo abierto. Ahí, un canal recoge el agua lluvia para los baños.' } },
    { img: 'kf_05', k: { en: 'Balance', es: 'Equilibrio' },
      t: { en: 'Habitar en equilibrio', es: 'Habitar en equilibrio' },
      p: { en: 'The warmth of wood, color and light, with the nature of the garden: a nest that gathers and protects without isolating.',
           es: 'Lo cálido de la madera, el color y la luz, con lo natural del jardín: un nido que recoge y protege sin aislar.' } },
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
          ${s.data ? `<div class="card__data">${s.data.map(d => `<span>${typeof d === 'object' ? d[lang] : (lang === 'es' ? d.replace(/(\d)\.(\d)/g, '$1,$2') : d)}</span>`).join('')}</div>` : ''}
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
