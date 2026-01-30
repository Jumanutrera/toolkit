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
    // Load html2canvas once
    if (!window.html2canvas) {
      await loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      );
    }

    // Load #
    const lnEl = await waitFor('.load-overview-header__load-status span');
    const loadNumber = lnEl.innerText.match(/#(\d+)/)?.[1] || '----';

    const container = document.querySelector('#stop-container');
    if (!container) {
      alert('Stop container not found');
      return;
    }

    const nodes = Array.from(container.children);

    // ===== CARD =====
    const card = document.createElement('div');
    card.style.cssText = `
      width:480px;
      background:#f2f4f7;
      font-family:Arial,sans-serif;
      padding:12px;
      border-radius:6px;
    `;

    // Header
    card.innerHTML = `
      <div style="
        background:#2fa4e7;
        color:white;
        padding:6px 10px;
        font-size:14px;
        font-weight:bold;
        border-radius:4px;
        margin-bottom:8px;
      ">
        Stops · L# ${loadNumber}
      </div>
    `;

    // Iterate DOM IN ORDER (this is the key fix)
    nodes.forEach((node) => {
      // ===== STOP =====
      if (node.id && node.id.startsWith('stop-card-container--')) {
        const city = node.querySelector(
          '.stop-card-header__info__header__top > div:first-child'
        );
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

        if (!city) return;

        const stop = document.createElement('div');
        stop.style.cssText = `
          background:#ffffff;
          border-radius:6px;
          padding:10px;
          margin-bottom:6px;
          display:flex;
          gap:10px;
        `;

        stop.innerHTML = `
          <div style="
            width:70px;
            text-align:center;
            font-size:11px;
            color:${isPickup ? '#2bb673' : '#e74c3c'};
          ">
            <div style="font-weight:bold;">
              ${isPickup ? 'Pickup' : 'Delivery'}
            </div>
            <div style="font-size:22px;">
              ${isPickup ? '🏭' : '🏬'}
            </div>
          </div>

          <div style="flex:1;">
            <div style="font-weight:bold;font-size:13px;">
              ${city.innerText}
            </div>

            <div style="font-size:12px;color:#666;">
              ${facility ? facility.innerText : ''}
            </div>

            <div style="font-size:12px;color:#444;margin-top:4px;">
              <strong>Appt:</strong> ${apptDate ? apptDate.innerText : ''}
            </div>

            <div style="font-size:11px;color:#777;">
              ${apptType ? apptType.innerText : ''}
            </div>

            <div style="font-size:12px;color:#333;margin-top:4px;">
              <strong>Commodity:</strong> ${
                commodity ? commodity.innerText : '-'
              }
            </div>
          </div>
        `;

        card.appendChild(stop);
      }

      // ===== MILES BETWEEN STOPS =====
      if (node.classList.contains('stop-card-container__miles')) {
        const miles = node.querySelector(
          '.stop-card-container__distance'
        );
        if (!miles) return;

        const milesDiv = document.createElement('div');
        milesDiv.style.cssText = `
          text-align:center;
          font-size:12px;
          color:#666;
          margin:4px 0 6px;
        `;
        milesDiv.innerText = miles.innerText;

        card.appendChild(milesDiv);
      }
    });

    // Render OFFSCREEN
    card.style.position = 'fixed';
    card.style.left = '-9999px';
    document.body.appendChild(card);

    // Faster render
    const canvas = await html2canvas(card, { scale: 1.0 });
    document.body.removeChild(card);

    const imgData = canvas.toDataURL('image/png');

    // Open tab with image
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
              padding:14px;
              font-family:Arial;
            }
            img {
              border-radius:6px;
              box-shadow:0 4px 12px rgba(0,0,0,.25);
              margin-top:8px;
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
