/* ==========================================================================
   NEXO · Estúdio Digital: interações e animações
   Vanilla JS, sem dependências.
   ========================================================================== */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------------------------------------------------------------- *
   * 1. Loader + entrada do hero
   * ---------------------------------------------------------------- */
  const loader = $("#loader");
  const heroTitle = $(".hero__title");

  // Envolve cada palavra em <span class="word"><span>palavra</span></span>,
  // para que ela possa subir de baixo da máscara com atraso escalonado.
  function wrapWords(target, text, state) {
    // split mantendo os espaços originais, para não criar/eliminar lacunas
    text.split(/(\s+)/).forEach((token) => {
      if (!token) return;
      if (/^\s+$/.test(token)) {
        target.appendChild(document.createTextNode(token));
        return;
      }
      const outer = document.createElement("span");
      outer.className = "word";
      const inner = document.createElement("span");
      inner.textContent = token;
      inner.style.transitionDelay = `${state.base + state.i++ * 70}ms`;
      outer.appendChild(inner);
      target.appendChild(outer);
    });
  }

  function splitWords(el, base = 0) {
    const state = { base, i: 0 };
    const nodes = Array.from(el.childNodes);
    el.innerHTML = "";
    nodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        wrapWords(el, node.textContent, state);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // preserva a tag interna (ex.: <em>) mantendo a animação por palavra
        const clone = node.cloneNode(true);
        const label = clone.textContent;
        clone.textContent = "";
        wrapWords(clone, label, state);
        el.appendChild(clone);
      }
    });
  }

  function initSplit() {
    $$("[data-split]").forEach((el) => {
      const base = parseInt(el.dataset.delay || "0", 10);
      splitWords(el, base);
    });
    // linhas que se revelam inteiras (aplicam o atraso do data-delay)
    $$("[data-fade]").forEach((el) => {
      el.style.transitionDelay = `${parseInt(el.dataset.delay || "0", 10)}ms`;
    });
  }

  function revealHero() {
    loader.classList.add("is-hidden");
    document.body.classList.add("is-locked");
    setTimeout(() => document.body.classList.remove("is-locked"), 60);
    if (heroTitle) heroTitle.classList.add("is-revealed");
    setTimeout(() => {
      $$(".hero .reveal").forEach((el) => el.classList.add("is-in"));
    }, 250);
  }

  window.addEventListener("load", () => {
    initSplit();
    if (reduced) {
      if (loader) loader.classList.add("is-hidden");
      if (heroTitle) heroTitle.classList.add("is-revealed");
      return;
    }
    setTimeout(revealHero, 900);
  });

  // Salvaguarda: se o load demorar, libera a tela mesmo assim
  window.setTimeout(() => {
    if (loader && !loader.classList.contains("is-hidden")) revealHero();
  }, 3500);

  /* ---------------------------------------------------------------- *
   * 2. Reveal no scroll + timeline + contadores
   * ---------------------------------------------------------------- */
  // Revela um elemento uma única vez (com ou sem animação).
  function revealEl(el, animate = true) {
    if (el.dataset.in) return;
    el.dataset.in = "1";
    el.classList.add("is-in");
    if (el.classList.contains("stat")) countUp($(".stat__num", el));
    revealObserver.unobserve(el);
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        if (!entry.isIntersecting) {
          // Já ficou acima da tela (ex.: abertura por link âncora):
          // revela na hora, sem animação.
          if (entry.boundingClientRect.top < 0) revealEl(el, false);
          return;
        }
        const delay = parseInt(el.dataset.delay || "0", 10);
        if (reduced || !delay) revealEl(el);
        else setTimeout(() => revealEl(el), delay);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );

  function countUp(node) {
    if (!node || node.dataset.done) return;
    node.dataset.done = "1";
    const target = parseFloat(node.dataset.count || "0");
    const suffix = node.dataset.suffix || "";
    if (reduced) {
      node.textContent = target + suffix;
      return;
    }
    const duration = 1600;
    const start = performance.now();
    (function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  // O IntersectionObserver não dispara quando um elemento salta de "abaixo"
  // para "acima" da tela (barra de rolagem arrastada, tecla End, link âncora).
  // Esta rede de segurança garante que nada fique invisível ou em zero.
  const revealTargets = $$(".reveal, .timeline, .stat");

  function catchPassedElements() {
    const limit = window.innerHeight * 0.92;
    for (const el of revealTargets) {
      // o hero tem entrada própria e nunca fica acima da dobra
      if (el.dataset.in || el.closest(".hero")) continue;
      if (el.getBoundingClientRect().top < limit) revealEl(el, false);
    }
  }

  revealTargets.forEach((el) => revealObserver.observe(el));

  /* ---------------------------------------------------------------- *
   * 3. Canvas de partículas (hero)
   * ---------------------------------------------------------------- */
  const canvas = $("#particles");

  if (canvas && !reduced) {
    const ctx = canvas.getContext("2d");
    const pointer = { x: -999, y: -999 };
    let dots = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let running = true;

    const COLORS = ["78, 227, 255", "139, 92, 246", "255, 78, 205"];

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const density = w < 700 ? 16000 : 11000;
      const count = Math.max(28, Math.min(110, Math.round((w * h) / density)));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.36,
        vy: (Math.random() - 0.5) * 0.36,
        r: Math.random() * 1.9 + 0.9,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        ph: Math.random() * Math.PI * 2,
      }));
    }

    function frame(t) {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.x += d.vx;
        d.y += d.vy + Math.sin(t / 1400 + d.ph) * 0.12;

        if (d.x < -20) d.x = w + 20;
        if (d.x > w + 20) d.x = -20;
        if (d.y < -20) d.y = h + 20;
        if (d.y > h + 20) d.y = -20;

        // repulsão suave do cursor
        const dx = d.x - pointer.x;
        const dy = d.y - pointer.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < 20250) {
          const dist = Math.sqrt(dist2) || 1;
          const force = (150 - dist) / 150;
          d.x += (dx / dist) * force * 2.4;
          d.y += (dy / dist) * force * 2.4;
        }

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${d.c}, 0.9)`;
        ctx.fill();

        // conexões
        for (let j = i + 1; j < dots.length; j++) {
          const o = dots[j];
          const ox = d.x - o.x;
          const oy = d.y - o.y;
          const dd = ox * ox + oy * oy;
          if (dd < 23000) {
            const alpha = (1 - dd / 23000) * 0.3;
            ctx.strokeStyle = `rgba(${d.c}, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(o.x, o.y);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    });
    window.addEventListener("mouseout", () => {
      pointer.x = pointer.y = -999;
    });

    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          requestAnimationFrame(frame);
        } else if (!entry.isIntersecting) {
          running = false;
        }
      },
      { threshold: 0 }
    ).observe(canvas);

    resize();
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- *
   * 4. Brilho do cursor (lerp) + barra de progresso
   * ---------------------------------------------------------------- */
  const glow = $("#cursorGlow");
  const progressBar = $("#progressBar");

  if (glow && finePointer && !reduced) {
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;

    window.addEventListener("mousemove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      glow.classList.add("is-on");
    });

    (function loop() {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      glow.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------------------------------------------------------- *
   * 5. Barra de navegação, links ativos, menu e "voltar ao topo"
   * ---------------------------------------------------------------- */
  const nav = $("#nav");
  const toTop = $("#toTop");
  const navLinks = $$("[data-nav]");
  const sections = navLinks
    .map((a) => $(a.getAttribute("href")))
    .filter(Boolean);

  function onScroll() {
    const y = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;

    if (progressBar) progressBar.style.width = `${total > 0 ? (y / total) * 100 : 0}%`;
    if (nav) nav.classList.toggle("is-stuck", y > 30);
    if (toTop) toTop.classList.toggle("is-on", y > window.innerHeight * 0.9);

    let current = "";
    sections.forEach((sec) => {
      if (y >= sec.offsetTop - window.innerHeight * 0.35) current = `#${sec.id}`;
    });
    navLinks.forEach((a) =>
      a.classList.toggle("is-active", a.getAttribute("href") === current)
    );

    // parallax dos orbes
    if (!reduced) {
      const shift = y * 0.06;
      $$(".orb").forEach((orb, i) => {
        orb.style.transform = `translate3d(0, ${shift * (i + 1) * 0.6}px, 0)`;
      });
    }

    catchPassedElements();
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
    },
    { passive: true }
  );
  onScroll();

  if (toTop) {
    toTop.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
    );
  }

  const burger = $("#burger");
  const menu = $(".nav__links");

  function closeMenu() {
    if (!menu) return;
    menu.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-locked");
  }

  if (burger && menu) {
    burger.addEventListener("click", () => {
      const open = menu.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("is-locked", open);
    });
    menu.addEventListener("click", (e) => {
      if (e.target.tagName === "A") closeMenu();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---------------------------------------------------------------- *
   * 6. Tilt 3D + spotlight nos cards
   * ---------------------------------------------------------------- */
  if (finePointer && !reduced) {
    $$(".tilt").forEach((el) => {
      let raf = null;

      el.addEventListener("mousemove", (e) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;

        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);

        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          const rx = (0.5 - py) * 9;
          const ry = (px - 0.5) * 11;
          el.style.transform =
            `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-6px)`;
        });
      });

      el.addEventListener("mouseleave", () => {
        el.style.transform = "perspective(900px) rotateX(0) rotateY(0) translateY(0)";
      });
    });

    /* Botões magnéticos */
    $$(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = `translate(${x * 0.18}px, ${y * 0.3}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "translate(0, 0)";
      });
    });
  }

  /* ---------------------------------------------------------------- *
   * 7. Filtro de projetos
   * ---------------------------------------------------------------- */
  const chips = $$(".chip");
  const projects = $$(".project");
  const emptyNote = $("#filtersEmpty");

  if (chips.length && projects.length) {
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const filter = chip.dataset.filter;

        chips.forEach((c) => {
          const on = c === chip;
          c.classList.toggle("is-active", on);
          c.setAttribute("aria-pressed", String(on));
        });

        let visible = 0;
        projects.forEach((card) => {
          const match = filter === "todos" || card.dataset.stack === filter;
          card.classList.toggle("is-hidden", !match);
          card.classList.remove("pop");
          if (match) {
            visible++;
            // reinicia a animação de entrada sem bloquear o layout
            void card.offsetWidth;
            card.classList.add("pop");
          }
        });

        if (emptyNote) emptyNote.hidden = visible > 0;
      });
    });

    // estado inicial acessível
    chips.forEach((c) =>
      c.setAttribute("aria-pressed", String(c.classList.contains("is-active")))
    );
  }

  /* ---------------------------------------------------------------- *
   * 8. Formulário de contato (abre o cliente de e-mail com a mensagem)
   * ---------------------------------------------------------------- */
  // Troque pelo seu e-mail para receber as mensagens do formulário.
  const CONTACT_EMAIL = "seu-email@exemplo.com";

  const form = $("#messageForm");
  const note = $("#formNote");
  const defaultNote = note ? note.textContent : "";

  if (form && note) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = ($("#nome")?.value || "").trim();
      const mensagem = ($("#mensagem")?.value || "").trim();

      note.classList.remove("is-ok", "is-error");

      if (nome.length < 2 || mensagem.length < 10) {
        note.textContent =
          mensagem.length < 10 && mensagem.length > 0
            ? "Conte um pouco mais, pelo menos 10 caracteres."
            : "Preencha seu nome e uma mensagem.";
        note.classList.add("is-error");
        return;
      }

      const assunto = `Contato do portfólio: ${nome}`;
      const corpo = `${mensagem}\n\n${nome}`;
      window.location.href =
        `mailto:${CONTACT_EMAIL}` +
        `?subject=${encodeURIComponent(assunto)}` +
        `&body=${encodeURIComponent(corpo)}`;

      note.textContent = "Abrindo seu aplicativo de e-mail…";
      note.classList.add("is-ok");
      setTimeout(() => {
        note.textContent = defaultNote;
        note.classList.remove("is-ok");
      }, 4000);
      form.reset();
    });
  }

  /* ---------------------------------------------------------------- *
   * 9. Rodapé
   * ---------------------------------------------------------------- */
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* Rolagem suave com compensação da barra fixa */
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      history.replaceState(null, "", id);
    });
  });
})();
