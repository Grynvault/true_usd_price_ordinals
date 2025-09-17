
(function(){
  function getSlugFromPath(){
    const parts = location.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p.toLowerCase()==='collections');
    if (idx>=0 && parts[idx+1]) return decodeURIComponent(parts[idx+1]);
    return parts[parts.length-1] || '';
  }
  let currentSlug = getSlugFromPath();
  let lastHref = location.href;

  function box(){ const d=document.createElement('div');
    Object.assign(d.style,{
      position:'fixed', bottom:'16px', right:'16px', width:'360px', maxWidth:'42vw',
      padding:'12px', background:'rgba(17,17,17,0.95)', color:'#fff', zIndex:999999,
      borderRadius:'12px', font:'12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      boxShadow:'0 4px 16px rgba(0,0,0,0.4)'
    }); return d; }
  function btn(label){ const b=document.createElement('button'); b.textContent=label;
    Object.assign(b.style,{padding:'6px 10px',border:'1px solid #444',borderRadius:'8px',background:'#222',color:'#fff',cursor:'pointer',whiteSpace:'nowrap'});
    b.onmouseenter=()=>b.style.background='#333'; b.onmouseleave=()=>b.style.background='#222'; return b; }
  function fmtUSD(n){ return Number(n).toLocaleString(undefined,{maximumFractionDigits:2}); }
  function dayKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function toDate(ts){
    if (ts==null) return null;
    if (typeof ts==='number') return new Date(ts>1e12?ts:ts*1000);
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }

  // ====== BTCUSD table load/store (robust loader) ======
  function getTable(){ try{ return JSON.parse(localStorage.getItem('bis_btc_usd_table')||'{}'); }catch{return{}} }
  function setTable(map){ try{ localStorage.setItem('bis_btc_usd_table', JSON.stringify(map)); }catch{} }

  function looksLikeDate(s){
    return typeof s==='string' && /^\d{4}-\d{2}-\d{2}/.test(s);
  }
  function numify(x){
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }

  function loadFileToTable(file, cb){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const txt = String(reader.result||'');
        let map = {};
        if (/^\s*[\[{]/.test(txt)){
          const j = JSON.parse(txt);

          if (Array.isArray(j)){
            // Accept a big array of pairs in *either* order: [date, price] OR [price, date]. Strings OK.
            j.forEach(row=>{
              if (!row) return;
              if (Array.isArray(row)){
                let d=null, px=null;
                // detect order
                if (looksLikeDate(row[0]) && numify(row[1])!=null){ d = row[0]; px = numify(row[1]); }
                else if (looksLikeDate(row[1]) && numify(row[0])!=null){ d = row[1]; px = numify(row[0]); }
                else {
                  // try find any date-like string within first 3 items
                  for (let i=0;i<Math.min(3,row.length);i++){
                    if (looksLikeDate(row[i])){ d=row[i]; break; }
                  }
                  if (d){
                    const idx = row.indexOf(d);
                    for (let k=0;k<Math.min(3,row.length);k++){
                      if (k===idx) continue;
                      const val = numify(row[k]);
                      if (val!=null){ px=val; break; }
                    }
                  }
                }
                if (d && px!=null) map[d.slice(0,10)] = px;
              } else if (typeof row==='object'){
                const d = String(row.date||row.day||'').slice(0,10);
                const px = numify(row.price||row.usd||row.close);
                if (d && px!=null) map[d] = px;
              }
            });
          } else if (typeof j==='object'){
            // Keyed object: keys may be YYYY-MM-DD or YYYY-MM
            for (const k of Object.keys(j)){
              const px = numify(j[k]);
              if (px!=null) map[String(k).slice(0,10)] = px;
            }
          }
        } else {
          // CSV
          const lines = txt.trim().split(/\r?\n/);
          const head = (lines.shift()||'').split(',').map(s=>s.trim().toLowerCase());
          // Try common headers
          let iDate = head.findIndex(h=>/date|day/i.test(h));
          let iPx = head.findIndex(h=>/price|usd|close/i.test(h));
          // If ambiguous, try to detect by row 1
          lines.forEach(line=>{
            const cells = line.split(',');
            if (iDate<0 || iPx<0){
              if (looksLikeDate(cells[0]) && numify(cells[1])!=null){ iDate=0; iPx=1; }
              else if (numify(cells[0])!=null && looksLikeDate(cells[1])){ iDate=1; iPx=0; }
            }
            const d = (cells[iDate]||'').trim().slice(0,10);
            const px = numify(cells[iPx]);
            if (d && px!=null) map[d]=px;
          });
        }

        setTable(map);
        cb?.(null, map);
      }catch(e){ cb?.(e); }
    };
    reader.readAsText(file);
  }

  async function fetchBIS(slug){
    const url = `https://v2api.bestinslot.xyz/collection/chart?slug=${encodeURIComponent(slug)}`;
    const r = await fetch(url, { cache:'no-store' });
    if (!r.ok) throw new Error('BIS HTTP '+r.status);
    const j = await r.json();
    return parseBIS(j);
  }

  function parseBIS(j){
    let arr = null;
    if (Array.isArray(j)) arr = j;
    else {
      let best=0;
      for (const k of Object.keys(j)){
        const v = j[k];
        if (Array.isArray(v) && v.length>best){ arr=v; best=v.length; }
      }
    }
    if (!arr || !arr.length) throw new Error('No array series in BIS response.');
    const pts = [];
    for (const row of arr){
      let ts=null, y=null;
      if (Array.isArray(row)){
        ts = row[0];
        y = row[2]!=null?row[2]:row[1];
      } else if (typeof row==='object' && row){
        ts = row.timestamp??row.time??row.t??row.date??row.day;
        // For BestInSlot API, prioritize 'price' field over others
        y = row.price ?? row.value ?? row.close;
        if (y == null) {
          // Fallback: find first numeric field that's not timestamp/volume/id
          for (const k of Object.keys(row)){
            if (['id','timestamp','time','t','date','day','volume','slug'].includes(k)) continue;
            const num = Number(row[k]);
            if (Number.isFinite(num)){ y=num; break; }
          }
        }
      }
      const d = toDate(ts);
      if (d && Number.isFinite(Number(y))) pts.push({ day: dayKey(d), btc: Number(y) });
    }
    // keep last value per day
    const map = new Map();
    pts.sort((a,b)=>a.day.localeCompare(b.day)).forEach(p=>map.set(p.day, p.btc));
    return Array.from(map.entries()).map(([day, btc])=>({ day, btc }));
  }

  const COINGECKO_RANGE = (from,to)=>`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
  async function fetchCG(fromDay, toDay){
    const from = Math.floor(new Date(fromDay+'T00:00:00Z').getTime()/1000);
    const to = Math.floor(new Date(toDay+'T23:59:59Z').getTime()/1000);
    const r = await fetch(COINGECKO_RANGE(from,to), { cache:'no-store' });
    if (!r.ok) throw new Error('CG HTTP '+r.status);
    const j = await r.json();
    const map = new Map();
    (j.prices||[]).forEach(([ts,px])=>{
      const d = new Date(ts);
      map.set(dayKey(d), px);
    });
    return map;
  }

  function drawMiniChart(container, points){
    container.innerHTML = '';
    const cv = document.createElement('canvas');
    const W = container.clientWidth || 320;
    const H = 160;
    cv.width = W; cv.height = H;
    cv.style.width = '100%'; cv.style.height = H+'px';
    cv.style.border = '1px solid #333'; cv.style.borderRadius = '8px';
    container.appendChild(cv);
    const ctx = cv.getContext('2d');

    const xs = points.map(p=>new Date(p.day).getTime());
    const ys = points.map(p=>p.usd);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 10;

    ctx.fillStyle='#0b0b0b'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.beginPath();
    ctx.moveTo(pad,pad); ctx.lineTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();

    ctx.strokeStyle='rgba(0,200,255,0.9)'; ctx.lineWidth=2; ctx.beginPath();
    points.forEach((p,i)=>{
      const x = pad + ((new Date(p.day).getTime()-minX)/(maxX-minX||1))*(W-2*pad);
      const y = H - pad - ((p.usd - minY)/(maxY-minY||1))*(H-2*pad);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.font='12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    ctx.fillText(`USD (min $${fmtUSD(minY)}  max $${fmtUSD(maxY)})`, pad+4, pad+14);
  }

  function toCSV(points){
    return ['day,btc,usd,btc_usd_px', ...points.map(p=>`${p.day},${p.btc},${p.usd},${p.px}`)].join('\n');
  }
  function download(name, text){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text],{type:'text/csv'}));
    a.download = name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  }

  function inject(){
    if (document.getElementById('bis-usd-auto')) return;
    const b = box(); b.id='bis-usd-auto';

    const title = document.createElement('div'); title.style.fontWeight='700'; title.textContent='BestInSlot → USD';
    const slugRow = document.createElement('div'); slugRow.style.marginTop='6px';
    slugRow.innerHTML = `<b>Slug:</b> <span id="bis-slug">${currentSlug||'(not on collection page)'}</span>`;

    const upload = document.createElement('input'); upload.type='file'; upload.accept='.json,.csv'; upload.style.marginTop='8px';
    const hint = document.createElement('div'); hint.style.opacity='.8'; hint.style.marginTop='4px';
    hint.textContent = 'Accepts JSON arrays like ["12345.67","2025-07-14"] or ["2025-07-14","12345.67"], or CSV with Date,Close.';

    const useCG = document.createElement('input'); useCG.type='checkbox'; useCG.id='bis-usecg';
    useCG.checked = localStorage.getItem('bis_usecg')==='1';
    useCG.onchange = ()=>localStorage.setItem('bis_usecg', useCG.checked?'1':'0');
    const cgLabel = document.createElement('label'); cgLabel.htmlFor='bis-usecg'; cgLabel.textContent=' Use CoinGecko for missing days';

    const btnRow = document.createElement('div'); btnRow.style.display='flex'; btnRow.style.gap='6px'; btnRow.style.flexWrap='wrap'; btnRow.style.marginTop='8px';
    const build = btn('Build USD'); const dl = btn('Download CSV'); const chart = btn('View Chart');
    btnRow.appendChild(build); btnRow.appendChild(dl); btnRow.appendChild(chart);

    const chartWrap = document.createElement('div'); chartWrap.id='bis-mini-chart'; chartWrap.style.marginTop='8px';
    const status = document.createElement('div'); status.id='bis-status'; status.style.marginTop='6px'; status.style.opacity='.85';

    b.appendChild(title); b.appendChild(slugRow);
    const fileLabel=document.createElement('div'); fileLabel.textContent='BTCUSD file (CSV/JSON):'; fileLabel.style.marginTop='6px'; b.appendChild(fileLabel);
    b.appendChild(upload); b.appendChild(hint);
    const cgRow=document.createElement('div'); cgRow.style.marginTop='6px'; cgRow.appendChild(useCG); cgRow.appendChild(cgLabel); b.appendChild(cgRow);
    b.appendChild(btnRow); b.appendChild(chartWrap); b.appendChild(status);
    document.body.appendChild(b);

    let lastPoints=[];

    upload.onchange = () => {
      const f = upload.files && upload.files[0]; if (!f) return;
      setStatus('Parsing BTCUSD file…');
      loadFileToTable(f, (err, map)=>{
        setStatus(err ? 'Parse failed.' : 'Loaded '+Object.keys(map).length+' price rows.');
      });
    };

    build.onclick = async () => {
      if (!currentSlug){ setStatus('No slug detected. Navigate to a collection.'); return; }
      setStatus('Fetching BestInSlot…');
      try{
        const series = await fetchBIS(currentSlug); // [{day, btc}]
        if (!series.length){ setStatus('No series returned.'); return; }
        const table = getTable();
        const minDay = series[0].day, maxDay = series[series.length-1].day;
        let cgMap = new Map();
        if (useCG.checked){
          setStatus('Filling gaps via CoinGecko…');
          try{ cgMap = await fetchCG(minDay, maxDay); }catch{}
        }
        const points = series.map(s=>{
          const px = table[s.day] ?? table[s.day.slice(0,7)] ?? cgMap.get(s.day) ?? null;
          const usd = (px!=null) ? s.btc * px : null;
          return { day:s.day, btc:s.btc, px, usd };
        });
        const have = points.filter(p=>p.usd!=null);
        if (!have.length){ setStatus('No USD points (supply a BTCUSD file or enable CoinGecko).'); return; }
        drawMiniChart(chartWrap, have);
        lastPoints = have;
        const missing = points.filter(p=>p.usd==null).length;
        setStatus(`OK: ${have.length} days mapped${missing?`, ${missing} missing`:''}.`);
      }catch(e){
        setStatus('Error: '+(e.message||e));
      }
    };

    dl.onclick = () => {
      if (!lastPoints.length){ setStatus('Nothing to download.'); return; }
      download(`${currentSlug||'collection'}_usd_timeseries.csv`, toCSV(lastPoints));
      setStatus('CSV downloaded.');
    };

    chart.onclick = () => {
      if (!currentSlug){ setStatus('No slug detected. Navigate to a collection.'); return; }
      const chartUrl = chrome.runtime.getURL('chart-viewer.html') + '?slug=' + encodeURIComponent(currentSlug);
      window.open(chartUrl, '_blank');
      setStatus('Chart opened in new tab.');
    };

    function setStatus(msg){ status.textContent = msg||''; }
  }

  function watchURL(){
    const obs = new MutationObserver(()=>{
      if (lastHref!==location.href){
        lastHref=location.href;
        const slug = getSlugFromPath();
        if (slug!==currentSlug){
          currentSlug = slug;
          const el = document.getElementById('bis-slug');
          if (el) el.textContent = currentSlug||'(not on collection page)';
        }
      }
    });
    obs.observe(document.documentElement,{subtree:true,childList:true});
  }

  if (/bestinslot\.xyz$/i.test(location.hostname)){
    inject();
    watchURL();
  }
})();
