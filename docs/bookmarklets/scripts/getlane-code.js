javascript:(function () {

  const waitFor = (sel) =>
    new Promise((res) => {
      const i = setInterval(() => {
        const el = document.querySelector(sel);
        if (el) {
          clearInterval(i);
          res(el);
        }
      }, 50);
    });

  (async () => {
    // ===== GET LOAD NUMBER =====
    const lnEl = await waitFor('.load-overview-header__load-status span');
    const loadNumber = lnEl.innerText.match(/#(\d+)/)?.[1] || '----';

    const container = document.querySelector('#stop-container');
    if (!container) {
      alert('Stop container not found');
      return;
    }

    const nodes = Array.from(container.children);

    // ===== COLLECT DATA IN ORDER =====
    const rows = [];

    nodes.forEach((node) => {
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

        rows.push({
          type: 'stop',
          role: isPickup ? 'Pickup' : 'Delivery',
          city: city ? city.innerText : '',
          facility: facility ? facility.innerText : '',
          appt: apptDate ? apptDate.innerText : '',
          apptType: apptType ? apptType.innerText : '',
          commodity: commodity ? commodity.innerText : ''
        });
      }

      if (node.classList.contains('stop-card-container__miles')) {
        const miles = node.querySelector('.stop-card-container__distance');
        if (miles) {
          rows.push({
            type: 'miles',
            value: miles.innerText
          });
        }
      }
    });

    // ===== CANVAS SETUP =====
    const width = 460;
    const lineHeight = 16;
    const padding = 12;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Estimate height
    let height = padding * 2 + 30;
    rows.forEach(r => {
      height += r.type === 'stop' ? 90 : 24;
    });

    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#f2f4f7';
    ctx.fillRect(0, 0, width, height);

    let y = padding;

    // Header
    ctx.fillStyle = '#2fa4e7';
    ctx.fillRect(0, y, width, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`Stops · L# ${loadNumber}`, padding, y + 18);

    y += 36;

    // ===== DRAW ROWS =====
    rows.forEach(r => {
      if (r.type === 'stop') {
        // Card bg
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(padding, y, width - padding * 2, 80);

        // Role
        ctx.fillStyle = r.role === 'Pickup' ? '#2bb673' : '#e74c3c';
        ctx.font = 'bold 11px Arial';
        ctx.fillText(r.role.toUpperCase(), padding + 6, y + 16);

        // City
        ctx.fillStyle = '#000';
        ctx.font = 'bold 13px Arial';
        ctx.fillText(r.city, padding + 90, y + 16);

        // Facility
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText(r.facility, padding + 90, y + 32);

        // Appt
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('Appt:', padding + 90, y + 48);

        ctx.font = '12px Arial';
        ctx.fillText(r.appt, padding + 135, y + 48);

        // Appt type
        ctx.fillStyle = '#777';
        ctx.font = '11px Arial';
        ctx.fillText(r.apptType, padding + 90, y + 64);

        // Commodity
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('Commodity:', padding + 90, y + 78);

        ctx.font = '12px Arial';
        ctx.fillText(r.commodity, padding + 170, y + 78);

        y += 90;
      }

      if (r.type === 'miles') {
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText(r.value, width / 2 - 20, y + 16);
        y += 24;
      }
    });

    // ===== OPEN IMAGE =====
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
              margin-top:6px;
              border-radius:4px;
            }
            .hint {
              font-size:12px;
              color:#333;
            }
          </style>
        </head>
        <body>
          <div class="hint">
            Left click and copy image or drag the image
          </div>
          <img src="${imgData}">
        </body>
      </html>
    `);
    w.document.close();

  })();
})();
