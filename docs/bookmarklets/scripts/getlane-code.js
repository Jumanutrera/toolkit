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
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }

    const lnEl = await waitFor('.load-overview-header__load-status span');
    const loadNumber = lnEl.innerText.match(/#(\d+)/)?.[1] || '----';

    const stopCards = document.querySelectorAll('[id^="stop-card-container--"]');
    if (!stopCards.length) {
      alert('No stops found');
      return;
    }

    const milesEl = document.querySelector('#stop-card__miles');
    const miles = milesEl ? milesEl.innerText.trim() : '';

    // ===== CARD =====
    const card = document.createElement('div');
    card.style.cssText = `
      width:480px;
      background:#f2f4f7;
      font-family:Arial,sans-serif;
      padding:12px;
      border-radius:6px;
    `;

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

    stopCards.forEach((sc, i) => {
      const city = sc.querySelector('.stop-card-header__info__header__top > div:first-child');
      const facility = sc.querySelector('.stop-card-header__name');
      const date = sc.querySelector('p.appointment');
      const apptType = sc.querySelector('.stop-card-header__info__appointment__time');
      const commodity = sc.querySelector('.stop-card-header__commodity span');

      if (!city) return;

      const isPickup = i === 0;

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
            <strong>Appt:</strong> ${date ? date.innerText : ''}
          </div>

          <div style="font-size:11px;color:#777;">
            ${apptType ? apptType.innerText : ''}
          </div>

          <div style="font-size:12px;color:#333;margin-top:4px;">
            <strong>Commodity:</strong> ${commodity ? commodity.innerText : '-'}
          </div>
        </div>
      `;

      card.appendChild(stop);

      if (i === 0 && miles) {
        const milesDiv = document.createElement('div');
        milesDiv.style.cssText = `
          text-align:center;
          font-size:12px;
          color:#666;
          margin:4px 0 6px;
        `;
        milesDiv.innerText = miles;
        card.appendChild(milesDiv);
      }
    });

    card.style.position = 'fixed';
    card.style.left = '-9999px';
    document.body.appendChild(card);

    const canvas = await html2canvas(card, { scale: 1.15 });
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
          <div class="hint">Right click and copy image or drag the image</div>
          <img src="${imgData}">
        </body>
      </html>
    `);
    w.document.close();
  })();
})();
