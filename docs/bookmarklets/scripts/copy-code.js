(function(){
  const checkElement = setInterval(() => {
    const element1 = document.querySelector('.load-overview-header__load-status span');
    const element2 = document.querySelector('.truck-container div');
    if (element1 && element2) {
      clearInterval(checkElement);
      element2.click();

      const lncomp = document.querySelector('.load-overview-header__load-status span');
      const bpos = document.querySelector('.load-overview-header__load-status');
      const stopscontainers = document.querySelectorAll('[id^="stop-card-container--"]');
      const carrierElement = document.querySelector('.carrier-header__title-code');
      const proElement = document.querySelector('.truck-header__title-name');
      const customerCodeEl = document.querySelector('.customer-card-header__title-code');
      const carrier = carrierElement ? carrierElement.innerText.trim() : '';
      const pro = proElement ? (proElement.innerText.match(/\d+/g)?.join('') || '-') : '-';
      const customerCode = customerCodeEl ? customerCodeEl.innerText.trim() : '';
      let truckn = '-';

      const truckcontainers = document.querySelector('.truck-container .truck-content');
      if (lncomp) {
        const loadnumber = lncomp.innerText.match(/#(\d+)/)[1];
        if (truckcontainers) {
          const truckntitle = Array.from(truckcontainers.querySelectorAll('.truck-content__title')).find(span => span.innerText.trim() === 'Truck Number');
          if (truckntitle) {
            const trucknlabel = truckntitle.nextElementSibling;
            if (trucknlabel) {
              truckn = trucknlabel.innerText.trim();
            }
          }
        }

        const states = [];
        stopscontainers.forEach(container => {
          const statecomp = container.querySelector('.stop-card-header__info__header__top div');
          if (statecomp) {
            if (carrier === 'FORLATX') {
              const city = statecomp.innerText.split(',')[0].trim();
              const st = statecomp.innerText.split(',')[1].split(' ')[1];
              states.push(`${city}, ${st}`);
            } else {
              const state = statecomp.innerText.split(',')[1].split(' ')[1];
              if (state) states.push(state);
            }
          }
        });

        function copyAndShow(value) {
          const tempInput = document.createElement('textarea');
          tempInput.value = value;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand('copy');
          document.body.removeChild(tempInput);
          const copiedButton = document.createElement('button');
          copiedButton.innerText = 'Copied';
          copiedButton.style.cssText = 'text-align:center;line-height:25px;width:70px;height:25px;font-size:16px;position:relative;z-index:1000;background-color:#353535;color:white;border:none;border-radius:5px;cursor:not-allowed;';
          copiedButton.disabled = true;
          bpos.appendChild(copiedButton);
        }

        function handleVALBUAZ(map) {
          if (truckn === '-') {
            copyAndShow(`L# ${loadnumber} - ${states[0]} to ${states[states.length - 1]} - need DR info`);
            return;
          }
          const dispatcher = map[truckn] || 'UNKNOWN';
          copyAndShow(`L# ${loadnumber} - ${states[0]} to ${states[states.length - 1]} - truck# ${truckn} - ${dispatcher}`);
        }

        if (states.length > 0) {
          if (carrier === 'RICLIAR') {
            copyAndShow(pro === '-' ?
              `L# ${loadnumber} - ${states[0]} to ${states[states.length - 1]} - NO PRO` :
              truckn === '-' ?
              `L# ${loadnumber} - ${states[0]} to ${states[states.length - 1]} - No Truck - PRO: ${pro}` :
              `L# ${loadnumber} - ${states[0]} to ${states[states.length - 1]} - truck# ${truckn} - PRO: ${pro}`);
          } else if (carrier === 'FORLATX') {
            copyAndShow(truckn === '-' ?
              `L# ${loadnumber} - ${states[0]} - No Truck` :
              `L# ${loadnumber} - ${states[0]} - truck# ${truckn}`);
          } else if (carrier === 'VALBUAZ') {
            const saved = localStorage.getItem('dispatcherMap');
            const lastUpdate = localStorage.getItem('dispatcherMapDate');
            const now = Date.now();
            if (!saved || !lastUpdate || now - Number(lastUpdate) > 86400000) {
              fetch('https://script.google.com/macros/s/AKfycbw8Hntjp_caYWVjPEGdFPyjmf0LGz1f9qlaRVOnEyN7xL29_Mt0aDmgTfVY7U6cbTBHCw/exec')
                .then(res => res.json())
                .then(map => {
                  localStorage.setItem('dispatcherMap', JSON.stringify(map));
                  localStorage.setItem('dispatcherMapDate', now);
                  handleVALBUAZ(map);
                })
                .catch(() => alert("Failed to fetch dispatcher map"));
            } else {
              handleVALBUAZ(JSON.parse(saved));
            }
          } else {
            copyAndShow(truckn === '-' ?
              `L# ${loadnumber} - ${states[0]} to ${states[states.length - 1]} - need DR info` :
              `L# ${loadnumber} - ${states[0]} to ${states[states.length - 1]} - truck# ${truckn}`);
          }
        }

        (function checkSlackAccess() {
          const slackBadge = document.createElement('div');
          slackBadge.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-left:12px;font-size:14px;background:#444;color:white;padding:4px 10px;border-radius:12px;font-weight:500;';
          slackBadge.textContent = 'Slack ⏳';
          bpos.appendChild(slackBadge);

          if (!customerCode) {
            slackBadge.textContent = 'Slack ❌ no customer';
            return;
          }

          const slackKey = '__slackCustomerCodes';
          const slackTSKey = '__slackCustomerTS';
          const now = Date.now();
          const SLACK_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTnKVk3U2ozJfyoMf2hPdOofculhRH0K9SLs48tSae597LrH7e8UibVhGcQ8ZSnm_6Mpetn-5FsR3dI/pub?output=csv';
          const hour = 3600000;

          const renderSlackResult = (set) => {
            const hasSlack = set.has(customerCode);
            slackBadge.textContent = hasSlack ? 'SLACK ✔️' : 'SLACK ❌';
            slackBadge.style.backgroundColor = hasSlack ? '#2E7D32' : '#C62828';
          };

          if (localStorage[slackKey] && localStorage[slackTSKey] && (now - parseInt(localStorage[slackTSKey], 10) < hour)) {
            const slackSet = new Set(JSON.parse(localStorage[slackKey]));
            renderSlackResult(slackSet);
          } else {
            fetch(SLACK_CSV_URL)
              .then(res => res.text())
              .then(csv => {
                const lines = csv.split('\n').slice(1);
                const codes = lines.map(l => l.split(',')[0]?.trim()).filter(Boolean);
                const slackSet = new Set(codes);
                localStorage[slackKey] = JSON.stringify([...slackSet]);
                localStorage[slackTSKey] = String(now);
                renderSlackResult(slackSet);
              })
              .catch(() => {
                slackBadge.textContent = 'Slack ❌ error';
                slackBadge.style.backgroundColor = '#C62828';
              });
          }
        })();
      }
    }
  }, 100);
})();

