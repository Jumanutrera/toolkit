javascript:(function () {
  function loadScript(src) {
    return new Promise((res) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      document.body.appendChild(s);
    });
  }

  const waitFor = (sel) =>
    new Promise((res) => {
      const i = setInterval(() => {
        const el = document.querySelector(sel);
        if (el) {
          clearInterval(i);
          res(el);
        }
      }, 100);
    });

  (async () => {
    if (!window.html2canvas) {
      await loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      );
    }

    const lnEl = await waitFor('.load-overview-header__load-status span');
    const loadNumber = lnEl.innerText.match(/#(\d+)/)?.[1] || '----';

    const container = document.querySelector('#stop-container');
    if (!container) {
      alert('Stop container not found');
      return;
    }

    const nodes = Array.from(container.children);

    // ===== CARD (OFFSCREEN) =====
    const card = document.createElement('div');
    card.style.cssText = `
      width:460px;
      background:#f2f4f7;
      font-family:Arial,sans-serif;
      padding:10px;
      border-radius:6px;
    `;

    const frag = document.createDocumentFragment();

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background:#2fa4e7;
      color:white;
      padding:6px 10px;
      font-size:14px;
      font-weight:bold;
      border-radius:4px;
      margin-bottom:8px;
    `;
    header.textContent = `Stops · L# ${loadNumber}`;
    frag.appendChild(header);

    nodes.forEach((node) => {
      // STOP
      if (node.id && node.id.startsWith('stop-card-container--')) {
        const city = node.querySelector(
          '.stop-card-header__info__header__top > div:first-child'
        );
        if (!city) return;

        const facility = node.querySelector('.stop-card-header__name');
        const apptDate = node.querySelector('p.appointment');
        const apptType = node.querySelector(
          '.stop-card-header__info__appointment__time'
        );
        const commodity = node.querySelector(
          '.stop-card-header__commodity span'
        );

        const isPickup = node.querySelector(
          '.stop-card-header__direction.pickup'
        );

        const stop = document.createElement('div');
        stop.style.cssText = `
          background:#ffffff;
          border-radius:6px;
          padding:8px;
          margin-bottom:6px;
          display:flex;
          gap:8px;
        `;

        // Icon block (FASTER than emoji)
        const icon = document.createElement('div');
        icon.style.cssText = `
          width:60px;
          text-align:center;
          font-size:11px;
          font-weight:bold;
          color:${isPickup ? '#2bb673' : '#e74c3c'};
        `;
        icon.textContent = isPickup ? 'PICKUP' : 'DELIVERY';

        const body = document.createElement('div');
        body.style.cssText = 'flex:1;font-size:12px;color:#333';

        body.innerHTML = `
          <div style="font-weight:bold;font-size:13px;">${city.innerText}</div>
          <div style="color:#666;font-size:12px;">
            ${facility ? facility.innerText : ''}
          </div>
          <div style="margin-top:4px;">
            <strong>Appt:</strong> ${apptDate ? apptDate.innerText : ''}
          </div>
          <div style="font-size:11px;color:#777;">
            ${apptType ? apptType.innerText : ''}
          </div>
          <div style="margin-top:4px;">
            <strong>Commodity:</strong> ${commodity ? commodity.innerText : '-'}
          </div>
        `;

        stop.appendChild(icon);
        stop.appendChild(body);
        frag.appendChild(stop);
      }

      // MILES
      if (node.classList.contains('stop-card-container__miles')) {
        const miles = node.querySelector('.stop-card-container__distance');
        if (!miles) return;

        const milesDiv = document.createElement('div');
        milesDiv.style.cssText = `
          text-align:center;
          font-size:12px;
          color:#666;
          margin:4px 0 6px;
        `;
        milesDiv.textContent = miles.innerText;
        frag.appendChild(milesDiv);
      }
    });

    card.appendChild(frag);

    card.style.position = 'fixed';
    card.style.left = '-9999px';
    document.body.appendChild(card);

    // ===== FAST CANVAS RENDER =====
    const canvas = await html2canvas(card, {
      scale: 1.0,
      backgroundColor: null,
      willReadFrequently: true
    });

    document.body.removeChild(card);

    const imgData = canvas.toDataURL('image/png');

    const w = window.open('');
    w.document.write(`
      <html>
        <head>
          <title>Load ${loadNumber}</title>
          <style>
            body {
              margin:0;
              background:#e5e5e5;
              display:flex;
              flex-direction:column;
              align-items:center;
              padding:12px;
              font-family:Arial;
            }
            img {
              border-radius:6px;
              margin-top:6px;
            }
            .hint {
              font-size:12px;
              color:#333;
            }
          </style>
        </head>
        <body>
          <div class="hint">
            Right click and copy image or drag the image
          </div>
          <img src="${imgData}">
        </body>
      </html>
    `);
    w.document.close();
  })();
})();
