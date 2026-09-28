/* =========================================================
   Sandro Barber — site dinâmico
   Lê os dados de /dados (gerenciados pelo app Android).
   Sem dependências externas.
   ========================================================= */
(function () {
  'use strict';

  // Data no fuso do visitante (toISOString devolvia o dia em Greenwich).
  const isoLocal = (d) => {
    const x = d || new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')
      + '-' + String(x.getDate()).padStart(2, '0');
  };

  // O site é independente: mostra o conteúdo e manda o pedido de horário pelo
  // WhatsApp da barbearia (a confirmação chega na conversa do dono).
  const APP = { whatsapp: true };
  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));

  /* ---------------------------------------------------------
     0. Leitura dos dados (arquivo local = reserva embutida)
     --------------------------------------------------------- */
  const lerEmbutido = (id) => {
    try { return JSON.parse($('#' + id).textContent); } catch (e) { return null; }
  };

  const buscarJson = async (caminho, reserva) => {
    try {
      const r = await fetch(caminho, { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      return d && Object.keys(d).length ? d : reserva;
    } catch (e) {
      return reserva; // abrindo do arquivo: usa o que está embutido
    }
  };

  /* ---------------------------------------------------------
     1. Horário de atendimento do site

     Regra do dono: das 9h às 17h, de meia em meia hora, e não existe
     horário ao meio-dia (12h) — depois dele, só a partir das 13h.
     A data é livre: o cliente escolhe o dia que quiser no calendário.
     --------------------------------------------------------- */
  const ABRE = 9 * 60;        // 09:00
  const FECHA = 17 * 60;      // 17:00 (último horário oferecido)
  const ALMOCO_INICIO = 12 * 60;
  const ALMOCO_FIM = 13 * 60;
  const PASSO = 30;           // de meia em meia hora

  const emMinutos = (h) => { const [a, b] = h.split(':'); return Number(a) * 60 + Number(b); };
  const emHora = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  /**
   * Horários oferecidos em um dia.
   * O serviço tem de começar e terminar dentro do expediente: o horário serve se
   * couber inteiro na manhã (9h-12h) ou na tarde (13h-17h). Assim ninguém marca
   * um serviço de 90 minutos às 16h30 e fica atendendo depois de fechar.
   */
  const horariosDoDia = (data, duracao) => {
    if (!data) return [];
    const dur = Math.max(5, Number(duracao) || 40);
    const agora = new Date();
    const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
    const hojeZero = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    if (dia < hojeZero) return [];
    const ehHoje = dia.getTime() === hojeZero.getTime();
    const limite = agora.getHours() * 60 + agora.getMinutes() + 30;
    const lista = [];
    [[ABRE, ALMOCO_INICIO], [ALMOCO_FIM, FECHA]].forEach(([ini, fim]) => {
      for (let m = ini; m + dur <= fim; m += PASSO) {
        if (ehHoje && m < limite) continue;                  // hoje: só daqui a meia hora
        lista.push(emHora(m));
      }
    });
    return lista;
  };

  /** Converte "2026-09-26" no dia local (sem o deslocamento de fuso do navegador). */
  const diaDoCampo = (valor) => {
    const p = String(valor || '').split('-');
    if (p.length !== 3) return null;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  };
  const valorDoCampo = (d) =>
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  /* ---------------------------------------------------------
     2. Renderização do conteúdo
     --------------------------------------------------------- */
  const setTexto = (chave, valor) => {
    if (!valor) return;
    $$('[data-t="' + chave + '"]').forEach((el) => { el.textContent = valor; });
  };

  const montarLinkWhats = (texto) =>
    'https://wa.me/' + APP.whatsapp + '?text=' + encodeURIComponent(texto || 'Olá! Gostaria de agendar um horário.');

  const renderizar = (dados, imagens) => {
    const neg = dados.negocio || {};
    if (neg.whatsapp) APP.whatsapp = String(neg.whatsapp).replace(/\D/g, '');

    /* --- contato e links --- */
    $$('[data-wa]').forEach((el) => { el.href = montarLinkWhats('Olá! Gostaria de agendar um horário.'); });
    $$('[data-tel-href]').forEach((el) => {
      if (neg.whatsapp) el.href = 'https://wa.me/' + APP.whatsapp;
    });

    setTexto('negocio.nome', neg.nome);
    setTexto('negocio.slogan', neg.slogan);
    setTexto('negocio.telefone', neg.telefone);
    setTexto('negocio.endereco', neg.endereco);
    setTexto('negocio.cidade', neg.cidade);
    setTexto('negocio.pagamentos', neg.pagamentos);
    if (dados.hero) { setTexto('hero.titulo_linha1', dados.hero.titulo_linha1); setTexto('hero.subtitulo', dados.hero.subtitulo); }
    if (dados.sobre) {
      setTexto('sobre.titulo', dados.sobre.titulo);
      setTexto('sobre.paragrafo1', dados.sobre.paragrafo1);
      setTexto('sobre.paragrafo2', dados.sobre.paragrafo2);
    }

    /* --- Instagram (só aparece se estiver preenchido) --- */
    const insta = $('#insta');
    if (neg.instagram) {
      const arroba = String(neg.instagram).replace(/^@/, '');
      insta.innerHTML = '<a href="https://instagram.com/' + arroba + '" target="_blank" rel="noopener">@' + arroba + '</a>';
      insta.hidden = false;
    }

    /* --- horários --- */
    if (Array.isArray(dados.horarios) && dados.horarios.length) {
      $('#tabela-horarios').innerHTML = dados.horarios
        .map((h) => '<tr><td>' + h.dias + '</td><td>' + h.faixas + '</td></tr>').join('');
    }

    /* --- faixa animada: derivada dos serviços --- */
    const nomes = [];
    (dados.servicos || []).forEach((g) => (g.itens || []).forEach((i) => nomes.push(i.nome)));
    const base = nomes.length ? nomes : ['Corte', 'Barba', 'Sobrancelha'];
    const bloco = base.map((n) => '<span>' + n + '</span><i>◆</i>').join('');
    $('#strip').innerHTML = bloco + bloco;

    /* --- serviços --- */
    const icones = {
      'Cortes': '<path d="M6 4l9 12M18 4L9 16M7.5 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm14 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/>',
      'Acabamento': '<path d="M3 12h18M7 12V8m4 4V6m4 6v-3"/>',
      'Tratamentos & cor': '<path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-4.5 5-9 5-9Z"/>'
    };
    $('#lista-servicos').innerHTML = (dados.servicos || []).map((grupo) => {
      const itens = (grupo.itens || []).map((s) => {
        const destaque = s.destaque ? ' svc--featured' : '';
        const selo = s.destaque ? '<span class="svc__ribbon">Mais pedido</span>' : '';
        return '<article class="svc' + destaque + '">' + selo +
          '<div class="svc__main"><h4>' + s.nome + '</h4><p>' + (s.descricao || '') + '</p></div>' +
          '<span class="chip">' + (s.duracao || 40) + ' min</span>' +
          '<span class="svc__price">R$ ' + s.preco + '</span>' +
          '<button class="svc__add" type="button" data-open-booking data-service="' + s.nome + '" aria-label="Agendar ' + s.nome + '">+</button>' +
        '</article>';
      }).join('');
      return '<div class="services__group reveal">' +
        '<h3 class="services__title"><svg class="ico ico--gold" viewBox="0 0 24 24" aria-hidden="true">' +
        (icones[grupo.categoria] || icones['Acabamento']) + '</svg> ' + grupo.categoria + '</h3>' + itens + '</div>';
    }).join('');

    /* --- destaques do "sobre" --- */
    const destaques = (dados.sobre && dados.sobre.destaques) || [];
    $('#sobre-destaques').innerHTML = destaques.map((d) => '<li>' + d + '</li>').join('');

    /* --- produtos (com ou sem imagem) --- */
    const produtos = dados.produtos || [];
    const secProdutos = $('#produtos');
    if (!produtos.length) {
      secProdutos.hidden = true;
      const link = $('[data-menu="produtos"]'); if (link) link.parentElement.hidden = true;
    } else {
      $('#lista-produtos').innerHTML = produtos.map((p) => {
        const inicial = (p.nome || '?').replace(/^[^A-Za-zÀ-ú]*/, '').charAt(0).toUpperCase();
        const midia = p.imagem
          ? '<div class="prod__media"><img src="' + p.imagem + '" width="760" height="760" loading="lazy" decoding="async" alt="' + p.nome + '"></div>'
          : '<div class="prod__seal" aria-hidden="true">' + inicial + '</div>';
        return '<article class="prod reveal' + (p.imagem ? '' : ' prod--sem-imagem') + '">' + midia +
          '<div class="prod__body"><h3>' + p.nome + '</h3><p>' + (p.descricao || '') + '</p>' +
          '<p class="prod__tag">Disponível no balcão</p></div></article>';
      }).join('');
    }

    /* --- galeria: só aparece quando o dono enviar fotos pelo app --- */
    const fotos = (imagens && imagens.imagens) || [];
    const secGaleria = $('#galeria');
    const menuGaleria = $('[data-menu="galeria"]');
    if (fotos.length) {
      $('#lista-galeria').innerHTML = fotos.map((f, i) =>
        '<figure class="gal reveal' + (i % 3 === 0 ? ' gal--wide' : '') + '">' +
        '<img src="' + f.arquivo + '" width="900" height="900" loading="lazy" decoding="async" alt="' + (f.titulo || 'Trabalho da barbearia') + '">' +
        (f.titulo ? '<figcaption>' + f.titulo + '</figcaption>' : '') + '</figure>').join('');
      secGaleria.hidden = false;
      if (menuGaleria) menuGaleria.hidden = false;
    }

    /* --- depoimentos --- */
    const dep = dados.depoimentos || [];
    if (dep.length) {
      $('#lista-depoimentos').innerHTML = dep.map((d) =>
        '<article class="quote-card reveal"><div class="quote-card__stars" aria-hidden="true"></div>' +
        '<p class="quote-card__texto">“' + d.texto + '”</p>' +
        '<p class="quote-card__tag">' + (d.nome || 'Cliente') + '</p></article>').join('');
      $('#depoimentos').hidden = false;
    }

    /* --- dados estruturados + rodapé --- */
    const ano = new Date().getFullYear();
    $('#ano').textContent = ano;
    const ld = $('#json-ld');
    if (ld && neg.nome) {
      const j = JSON.parse(ld.textContent);
      j.name = neg.nome; j.telephone = '+' + APP.whatsapp;
      if (neg.endereco) j.address.streetAddress = neg.endereco;
      if (neg.cidade) j.address.addressLocality = String(neg.cidade).split('—')[0].trim();
      if (Array.isArray(dados.servicos)) {
        j.hasOfferCatalog = { '@type': 'OfferCatalog', name: 'Serviços', itemListElement: [] };
        dados.servicos.forEach((g) => (g.itens || []).forEach((s) => {
          j.hasOfferCatalog.itemListElement.push({
            '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.nome },
            price: Number(s.preco).toFixed(2), priceCurrency: 'BRL'
          });
        }));
      }
      ld.textContent = JSON.stringify(j);
    }
    const fe = $('#footer-endereco');
    if (fe && neg.endereco) fe.innerHTML = neg.endereco + '<br>' + (neg.cidade || '');

    const mapa = $('#link-mapa');
    if (mapa && neg.endereco) {
      mapa.href = 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(neg.endereco + ', ' + (neg.cidade || '').replace('—', ','));
    }
  };

  /* ---------------------------------------------------------
     3. Interface geral (header, menu, animações)
     --------------------------------------------------------- */
  const header = $('.header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  const burger = $('.burger'), nav = $('.nav');
  const fecharMenu = () => {
    nav.classList.remove('is-open'); burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menu');
  };
  burger.addEventListener('click', () => {
    const aberto = nav.classList.toggle('is-open');
    burger.classList.toggle('is-open', aberto);
    burger.setAttribute('aria-expanded', String(aberto));
    burger.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  });
  $$('.nav a').forEach((a) => a.addEventListener('click', fecharMenu));
  window.addEventListener('resize', () => { if (window.innerWidth > 900) fecharMenu(); });

  const observarReveals = () => {
    const alvos = $$('.reveal');
    if (!('IntersectionObserver' in window) || reduzirMovimento) {
      alvos.forEach((el) => el.classList.add('is-in')); return;
    }
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        const irmaos = $$('.reveal', e.target.parentElement);
        const i = Math.min(irmaos.indexOf(e.target), 4);
        e.target.style.transitionDelay = (i > 0 ? i * 80 : 0) + 'ms';
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    alvos.forEach((el) => io.observe(el));
  };

  /* ---------------------------------------------------------
     4. Lightbox
     --------------------------------------------------------- */
  const lightbox = $('#lightbox'), lightboxImg = $('#lightbox-img');
  const abrirLightbox = (img) => {
    lightboxImg.src = img.currentSrc || img.src; lightboxImg.alt = img.alt || '';
    lightbox.hidden = false; document.body.classList.add('is-locked'); $('.lightbox__close').focus();
  };
  const fecharLightbox = () => {
    lightbox.hidden = true; lightboxImg.src = '';
    if (booking.hidden) document.body.classList.remove('is-locked');
  };
  document.addEventListener('click', (ev) => {
    const img = ev.target.closest('#lista-galeria img');
    if (img) abrirLightbox(img);
  });
  $$('[data-close-lightbox]').forEach((el) => el.addEventListener('click', fecharLightbox));
  lightbox.addEventListener('click', (ev) => { if (ev.target === lightbox) fecharLightbox(); });

  /* ---------------------------------------------------------
     5. Agendamento
     --------------------------------------------------------- */
  const booking   = $('#booking');
  const hint      = $('#booking-hint');
  const btnNext   = $('#booking-next');
  const btnBack   = $('#booking-back');
  const btnSend   = $('#booking-send');
  const inputNome = $('#booking-name');
  const inputFone = $('#booking-phone');
  const resumoSel = $('#booking-summary');
  const avisoFalha = $('#booking-falha');

  let SERVICOS = [];
  let passo = 1;
  let escolha = { servico: null, dia: null, hora: null };

  const campData = $('#picker-data');
  const fmtLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const fmtCurto = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

  const carregarServicos = (dados) => {
    SERVICOS = [];
    (dados.servicos || []).forEach((g) => (g.itens || []).forEach((s) => SERVICOS.push(s)));
    $('#picker-services').innerHTML = SERVICOS.map((s) =>
      '<button type="button" class="pick" data-servico="' + s.nome + '">' + s.nome + ' · R$ ' + s.preco + '</button>').join('');
  };

  /* O calendário aceita qualquer dia a partir de hoje — sem limite de prazo. */
  const hojeZero = () => { const a = new Date(); return new Date(a.getFullYear(), a.getMonth(), a.getDate()); };
  campData.min = valorDoCampo(hojeZero());

  const pickerHoras = $('#picker-times');
  const renderHorarios = (lista) => {
    if (!lista || !lista.length) {
      pickerHoras.innerHTML = '<p class="tiny muted">Nenhum horário disponível para este dia. Escolha outra data.</p>';
      escolha.hora = null; return;
    }
    pickerHoras.innerHTML = lista.map((h) =>
      '<button type="button" class="pick" data-hora="' + h + '">' + h + '</button>').join('');
    escolha.hora = null;
  };

  const marcarUnico = (container, alvo) => {
    $$('.pick', container).forEach((b) => b.classList.toggle('is-selected', b === alvo));
  };

  $('#picker-services').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-servico]'); if (!b) return;
    marcarUnico($('#picker-services'), b);
    escolha.servico = SERVICOS.find((s) => s.nome === b.dataset.servico) || null;
    // mudou o serviço, muda o tempo de cadeira: refaz a lista de horários do dia
    if (escolha.dia) {
      escolha.hora = null;
      const lista = horariosDoDia(escolha.dia, escolha.servico ? escolha.servico.duracao : 40);
      renderHorarios(lista);
    }
    irPara(passo);
  });

  const escolherDia = (data) => {
    escolha.dia = data;
    escolha.hora = null;
    const lista = horariosDoDia(data, escolha.servico ? escolha.servico.duracao : 40);
    if (!lista.length) {
      pickerHoras.innerHTML = '<p class="tiny muted">' +
        (data < hojeZero() ? 'Essa data já passou. Escolha outro dia.' : 'Não há mais horário livre neste dia. Escolha outro dia.') +
        '</p>';
    } else {
      renderHorarios(lista);
    }
    irPara(passo);
  };

  campData.addEventListener('change', () => {
    const data = diaDoCampo(campData.value);
    if (!data) { escolha.dia = null; escolha.hora = null; irPara(passo); return; }
    escolherDia(data);
  });

  pickerHoras.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-hora]'); if (!b || b.disabled) return;
    marcarUnico(pickerHoras, b); escolha.hora = b.dataset.hora; irPara(passo);
  });

  const irPara = (n) => {
    passo = Math.max(1, Math.min(3, n));
    $$('.step').forEach((s) => s.classList.toggle('is-active', Number(s.dataset.step) === passo));
    $$('.steps__dot').forEach((d) => {
      const v = Number(d.dataset.stepDot);
      d.classList.toggle('is-active', v === passo);
      d.classList.toggle('is-done', v < passo);
    });
    btnBack.hidden = passo === 1;
    btnNext.hidden = passo === 3;
    btnSend.hidden = passo !== 3;
    avisoFalha.hidden = true;
    if (passo === 1) { hint.textContent = 'Escolha o serviço para começar'; btnNext.disabled = !escolha.servico; }
    if (passo === 2) {
      hint.textContent = 'Escolha a data e o horário';
      btnNext.disabled = !(escolha.dia && escolha.hora);
    }
    if (passo === 3) { hint.textContent = 'Tudo pronto para enviar'; montarResumo(); inputNome.focus(); }
    btnNext.style.opacity = btnNext.disabled ? '.55' : '';
    btnNext.style.cursor = btnNext.disabled ? 'not-allowed' : '';
  };

  const montarResumo = () => {
    resumoSel.innerHTML = '<dl>' +
      '<dt>Serviço</dt><dd>' + (escolha.servico ? escolha.servico.nome + ' — R$ ' + escolha.servico.preco : '—') + '</dd>' +
      '<dt>Data</dt><dd>' + (escolha.dia ? fmtLongo.format(escolha.dia) : '—') + '</dd>' +
      '<dt>Horário</dt><dd>' + (escolha.hora || '—') + '</dd>' +
      '<dt>Duração</dt><dd>' + (escolha.servico ? escolha.servico.duracao || 40 : '—') + ' min</dd>' +
      '</dl>';
  };

  const textoWhats = () =>
    'Olá, Sandro! Quero agendar um horário na barbearia.\n\n' +
    '• Serviço: ' + (escolha.servico ? escolha.servico.nome + ' (R$ ' + escolha.servico.preco + ')' : '-') + '\n' +
    '• Data: ' + (escolha.dia ? fmtLongo.format(escolha.dia) : '-') + '\n' +
    '• Horário: ' + (escolha.hora || '-') + '\n' +
    (inputNome.value.trim() ? '• Nome: ' + inputNome.value.trim() + '\n' : '') +
    '\nPode confirmar, por favor?';

  btnNext.addEventListener('click', () => { if (!btnNext.disabled) irPara(passo + 1); });
  btnBack.addEventListener('click', () => irPara(passo - 1));
  inputNome.addEventListener('input', () => { if (passo === 3) montarResumo(); });

  /* Envio: abre o WhatsApp da barbearia com o pedido já escrito */
  btnSend.addEventListener('click', () => {
    if (!escolha.servico || !escolha.dia || !escolha.hora) return;
    const nome = inputNome.value.trim();
    if (nome.length < 2) {
      avisoFalha.hidden = false; avisoFalha.textContent = 'Por favor, informe seu nome.';
      inputNome.focus(); return;
    }
    btnSend.textContent = 'Abrindo o WhatsApp…';
    avisoFalha.hidden = false;
    avisoFalha.textContent = 'Tudo certo. Envie a mensagem na conversa que abriu.';
    window.open(montarLinkWhats(textoWhats()), '_blank');
    setTimeout(() => { btnSend.textContent = 'Enviar solicitação'; }, 2500);
  });

  const abrirBooking = (servico, el) => {
    if (el && el.dataset && el.dataset.servico) servico = el.dataset.servico;
    escolha = { servico: null, dia: null, hora: null };
    marcarUnico($('#picker-services'), null);
    campData.value = '';
    pickerHoras.innerHTML = '<p class="tiny muted">Escolha uma data para ver os horários.</p>';
    if (servico) {
      const btn = $('[data-servico="' + servico + '"]', $('#picker-services'));
      if (btn) { btn.classList.add('is-selected'); escolha.servico = SERVICOS.find((s) => s.nome === servico) || null; }
    }
    booking.hidden = false; document.body.classList.add('is-locked');
    irPara(escolha.servico ? 2 : 1);
  };
  function fecharBooking() {
    booking.hidden = true;
    if (lightbox.hidden) document.body.classList.remove('is-locked');
    fecharMenu();
  }
  document.addEventListener('click', (ev) => {
    const gatilho = ev.target.closest('[data-open-booking]');
    if (gatilho) { ev.preventDefault(); abrirBooking(gatilho.dataset.service || null, gatilho); }
    if (ev.target.closest('[data-close-booking]')) fecharBooking();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (!lightbox.hidden) return fecharLightbox();
      if (!booking.hidden) return fecharBooking();
      return fecharMenu();
    }
    if (ev.key === 'Tab' && !booking.hidden) {
      const foco = $$('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])', booking)
        .filter((el) => el.offsetParent !== null);
      if (!foco.length) return;
      const primeiro = foco[0], ultimo = foco[foco.length - 1];
      if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
    }
  });

  /* ---------------------------------------------------------
     6. Início
     --------------------------------------------------------- */
  (async () => {
    const conteudo = await buscarJson('dados/conteudo.json', lerEmbutido('dados-conteudo'));
    const imagens  = await buscarJson('dados/imagens.json', lerEmbutido('dados-imagens'));
    renderizar(conteudo, imagens);
    carregarServicos(conteudo);
    observerStart();
    irPara(1);
  })();

  function observerStart() { observarReveals(); }
})();
