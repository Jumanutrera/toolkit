(() => {
  const q = s => document.querySelector(s);
  const wait = (s, t = 5000) => new Promise((r, j) => {
    const el = q(s);
    if (el) return r(el);
    let e = 0;
    const i = setInterval(() => {
      const el = q(s);
      if (el) return clearInterval(i), r(el);
      if ((e += 50) >= t) return clearInterval(i), j(new Error(`No se encontró: ${s}`));
    }, 50);
  });

  try {
    const now = Date.now();
    const hour = 3600000;

    const run = async () => {
      const customerNameEl = q('.customer-card-header__title-name') || await wait('.customer-card-header__title-name');
      const customerCodeEl = q('.customer-card-header__title-code') || await wait('.customer-card-header__title-code');
      const loadNumberEl = q('.load-overview-header__load-status') || await wait('.load-overview-header__load-status');
      const carrierNameEl = q('.carrier-header__title-name--link') || await wait('.carrier-header__title-name--link');

      const customerCode = customerCodeEl.innerText.trim();
      const customerName = customerNameEl.innerText.trim();
      const carrierName = carrierNameEl.innerText.trim();

      const badge = document.createElement('div');
      badge.style.cssText = `
        display:inline-flex;
        align-items:center;
        gap:8px;
        margin-left:12px;
        font-size:15px;
        background:#666;
        color:#fff;
        padding:4px 10px;
        border-radius:14px;
        font-weight:500;
      `;
      badge.textContent = '⏳ Checking...';
      loadNumberEl.appendChild(badge);

      let badSet;
      if (
        localStorage.__notTrackableCodesCSV &&
        localStorage.__notTrackableCodesTS &&
        (now - parseInt(localStorage.__notTrackableCodesTS, 10) < hour)
      ) {
        badSet = new Set(JSON.parse(localStorage.__notTrackableCodesCSV));
      } else {
        const res = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQpNyR4njDhYkPpJfHPBBaJElR0xeLAnnCBGNorcmrfz9lzJj7UUITszEC9p4PXYQiTJTMPbTvk-tz3/pub?output=csv');
        const text = await res.text();
        const lines = text.split('\n').slice(2);
        badSet = new Set();
        for (const line of lines) {
          const code = line.split(',')[0]?.trim();
          if (code) badSet.add(code);
        }
        localStorage.__notTrackableCodesCSV = JSON.stringify([...badSet]);
        localStorage.__notTrackableCodesTS = String(now);
      }

      const isTrackable = !badSet.has(customerCode);
      badge.textContent = isTrackable ? '✔️ Trackeable' : '❌ Not Trackeable';
      badge.style.background = isTrackable ? '#2E7D32' : '#C62828';

      const scissors = document.createElement('span');
      scissors.textContent = '✂️';
      scissors.style.cssText = `
        font-size:18px;
        margin-left:8px;
        cursor: pointer;
      `;
      badge.parentNode.insertBefore(scissors, badge.nextSibling);

      const loadTextEl = q('.load-overview-header__load-status span');
      if (loadTextEl) {
        const match = loadTextEl.innerText.match(/#(\d+)/);
        const loadNumber = match ? match[1] : 'unknown';

        const temp = document.createElement('textarea');
        temp.value = "L# " + loadNumber + " // " + customerName + " // " + carrierName + " //";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
    };

    run();
  } catch (e) {
    alert('❌ ' + e.message);
  }
})();

