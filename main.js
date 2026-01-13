'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const el = {
  lang: $('#lang'), theme: $('#theme'),
  statusText: $('#statusText'), source: $('#source'),
  q: $('#q'), ac: $('#ac'),
  results: $('#results'), moreWrap: $('#moreWrap'),
  more: $('#moreWrap') ? $('#moreWrap').querySelector('button') : null,
  brand: document.querySelector('.brand'),
  fArtist: $('#fArtist'), fAlbum: $('#fAlbum'), sort: $('#sort'),
  go: $('#go'), clear: $('#clear'),
  popularResults: $('#popularResults'),
  player: $('#player'), pCover: $('#pCover'),
  pTitle: $('#pTitle'), pArtist: $('#pArtist'),
  bar: $('#bar'), barP: $('#barP'), tCur: $('#tCur'), tDur: $('#tDur'),
  btnPrev: $('#btnPrev'), btnPlay: $('#btnPlay'), btnNext: $('#btnNext'), btnClose: $('#btnClose'),
  icoPlay: $('#icoPlay'), icoPause: $('#icoPause'),
  statsDlg: $('#statsDlg'), openStats: $('#openStats'),
  closeStats: $('#closeStats'), resetStats: $('#resetStats'),
};

const i18n = {
  ru:{ready:"Готов.",search:"Поиск",clear:"Очистить",allArtists:"Выбрать исполнителя",allAlbums:"Выбрать альбом",showMore:"Показать ещё",notFound:"Ничего не найдено.",searching:"Ищу…",statsQ:"Запросы",statsP:"Прослушивания"},
  en:{ready:"Ready.",search:"Search",clear:"Clear",allArtists:"Choose artist",allAlbums:"Choose album",showMore:"Show more",notFound:"Nothing found.",searching:"Searching…",statsQ:"Searches",statsP:"Previews"}
};

const state = {
  lang: localStorage.getItem('mf_lang') || 'ru',
  theme: localStorage.getItem('mf_theme') || 'auto',
  results: [], view: [], page: 0, pageSize: 18,
  popular: [],
  playingIndex: -1,
  stats: JSON.parse(localStorage.getItem('mf_stats') || '{"q":{}, "play":{}}'),
};

function applyTheme(v){ document.documentElement.setAttribute('data-theme', v); localStorage.setItem('mf_theme', v); }
function applyLang(v){
  const L=i18n[v]||i18n.ru;
  el.go.textContent=L.search; el.clear.textContent=L.clear;
  if (el.fArtist && el.fArtist.options[0]) el.fArtist.options[0].textContent=L.allArtists;
  if (el.fAlbum  && el.fAlbum .options[0]) el.fAlbum .options[0].textContent=L.allAlbums;
  if(el.more) el.more.textContent=L.showMore;
  el.statusText.textContent=L.ready;
  if (el.q) el.q.placeholder = v==='ru' ? 'Введите название песни или исполнителя' : 'Type song or artist';
  localStorage.setItem('mf_lang', v);
}

function clearSearch(){
  if (el.q) el.q.value='';
  if (el.results) el.results.innerHTML='';
  if (el.statusText) el.statusText.textContent=i18n[state.lang].ready;
  if (el.source) el.source.textContent='';
  if (el.moreWrap) el.moreWrap.style.display='none';
  if (el.fArtist) el.fArtist.value='';
  if (el.fAlbum) el.fAlbum.value='';
  if (el.sort) el.sort.value='relevance';
  if (el.ac) el.ac.style.display='none';
  state.results = [];
  state.view = [];
  state.page = 0;
}
el.lang.value = state.lang; applyLang(state.lang);
el.theme.value = state.theme; applyTheme(state.theme);
el.lang.addEventListener('change',(e)=>{ state.lang=e.target.value; applyLang(state.lang); });
el.theme.addEventListener('change',(e)=>{ state.theme=e.target.value; applyTheme(state.theme); });
if (el.brand) el.brand.addEventListener('click', ()=>{
  if (window.showTab) window.showTab('search');
  clearSearch();
  if (el.q) el.q.focus();
});

function saveStats(){ localStorage.setItem('mf_stats', JSON.stringify(state.stats)); }
function addStatQuery(q){ const k=q.toLowerCase().trim(); state.stats.q[k]=(state.stats.q[k]||0)+1; saveStats(); }
function addStatPlay(t,a){ const k=(t||'')+' — '+(a||''); state.stats.play[k]=(state.stats.play[k]||0)+1; saveStats(); }

function jsonp(url, callbackParam="callback"){
  return new Promise((resolve,reject)=>{
    const cb="jsonp_"+Math.random().toString(36).slice(2);
    const cleanup=()=>{ try{delete window[cb]}catch{}; if (s && s.parentNode) s.parentNode.removeChild(s); clearTimeout(t) };
    window[cb]=(d)=>{ cleanup(); resolve(d) };
    const s=document.createElement('script'); const sep=url.includes('?')?'&':'?';
    s.src=url+sep+encodeURIComponent(callbackParam)+'='+encodeURIComponent(cb);
    s.onerror=()=>{ cleanup(); reject(new Error('jsonp error')) };
    document.head.appendChild(s);
    const t=setTimeout(()=>{ cleanup(); reject(new Error('jsonp timeout')) }, 15000);
  });
}

async function searchBoth(q){
  const itURL=`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=40`;
  const dzURL=`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=40&output=jsonp`;
  const [it,dz]=await Promise.allSettled([jsonp(itURL,'callback'),jsonp(dzURL,'callback')]);
  let items=[];
  if(it.status==='fulfilled'){
    items=items.concat((it.value.results||[]).map(x=>({src:'Apple',title:x.trackName,artist:x.artistName,album:x.collectionName,preview:x.previewUrl,art:(x.artworkUrl100||'').replace('100x100bb','300x300bb'),dur:x.trackTimeMillis||30000,page:x.trackViewUrl})));
  }
  if(dz.status==='fulfilled'){
    items=items.concat((dz.value.data||[]).map(x=>({src:'Deezer',title:x.title,artist:x.artist&&x.artist.name,album:x.album&&x.album.title,preview:x.preview,art:x.album&&(x.album.cover_medium||x.album.cover),dur:(x.duration||30)*1000,page:x.link})));
  }
  const seen=new Set(), out=[];
  for(const it of items){
    const k=(it.title||'').toLowerCase()+'__'+(it.artist||'').toLowerCase();
    if(seen.has(k)) continue; seen.add(k); out.push(it);
  }
  return out;
}

// Autocomplete
let acTimer=null;
if (el.q) {
  el.q.addEventListener('input',()=>{
    const val=el.q.value.trim(); if(acTimer) clearTimeout(acTimer);
    if(!val){ el.ac.style.display='none'; return; }
    acTimer=setTimeout(async ()=>{
      try{
        const it=await jsonp(`https://itunes.apple.com/search?term=${encodeURIComponent(val)}&entity=song&limit=8`,'callback');
        const items=(it.results||[]).map(x=>`${x.artistName} — ${x.trackName}`);
        el.ac.innerHTML = items.map(s=>`<div class="ac-item">${s}</div>`).join('');
        el.ac.style.display = items.length ? 'block' : 'none';
      }catch{ el.ac.style.display='none'; }
    }, 300);
  });
  el.ac.addEventListener('click',(e)=>{ const t=e.target.closest('.ac-item'); if(!t) return; el.q.value=t.textContent; el.ac.style.display='none'; doSearch(); });
  document.addEventListener('click',(e)=>{ const wrap=e.target.closest('.ac-wrap'); if(!wrap) el.ac.style.display='none'; });
}

function fillFilters(items){
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  if (el.fArtist) el.fArtist.innerHTML = `<option value="">${i18n[state.lang].allArtists}</option>` + uniq(items.map(x=>x.artist)).map(a=>`<option>${a}</option>`).join('');
  if (el.fAlbum ) el.fAlbum .innerHTML = `<option value="">${i18n[state.lang].allAlbums}</option>`  + uniq(items.map(x=>x.album )).map(a=>`<option>${a}</option>`).join('');
}
function applyFilters(){
  let items = state.results.slice();
  const a=el.fArtist ? el.fArtist.value : '', al=el.fAlbum ? el.fAlbum.value : '';
  if(a)  items = items.filter(x=>x.artist===a);
  if(al) items = items.filter(x=>x.album===al);
  const s=el.sort ? el.sort.value : 'relevance';
  if(s==='title') items.sort((x,y)=>x.title.localeCompare(y.title));
  else if(s==='artist') items.sort((x,y)=>x.artist.localeCompare(y.artist));
  else if(s==='duration') items.sort((x,y)=>(x.dur||0)-(y.dur||0));
  else if(s==='source') items.sort((x,y)=>x.src.localeCompare(y.src));
  state.view = items; state.page=0; render();
}
if (el.fArtist) el.fArtist.addEventListener('change', applyFilters);
if (el.fAlbum ) el.fAlbum .addEventListener('change', applyFilters);
if (el.sort   ) el.sort   .addEventListener('change', applyFilters);

function msToMinSec(ms){ if(!ms) return "0:00"; const s=Math.round(ms/1000), m=Math.floor(s/60), ss=String(s%60).padStart(2,'0'); return `${m}:${ss}` }
function getTrackKey(track){
  const title = (track.title || track.trackName || '').toLowerCase().trim();
  const artist = (track.artist || track.artistName || '').toLowerCase().trim();
  const src = (track.src || '').toLowerCase().trim();
  const key = src + '::' + title + '__' + artist;
  return key || undefined;
}
function isFavoriteTrack(track){
  const payload = makeTrackPayload(track);
  if (window.isFavorite) return window.isFavorite(payload);
  try{
    const stored = JSON.parse(localStorage.getItem('favorites') || '[]');
    const id = getTrackKey(payload);
    return stored.some((t)=>getTrackKey(t)===id);
  }catch{
    return false;
  }
}
function setFavoriteButtonState(button, track){
  if (!button) return;
  const active = isFavoriteTrack(track);
  button.classList.toggle('is-favorite', active);
  button.textContent = active ? '★ В избранном' : '☆ В избранное';
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
}

// Global audio player
const audio=new Audio(); audio.preload='none';
function setPlayIcon(paused){
  if(paused){ el.icoPlay.style.display='block'; el.icoPause.style.display='none'; el.btnPlay.classList.remove('is-playing'); el.btnPlay.setAttribute('aria-label','Воспроизвести'); }
  else{ el.icoPlay.style.display='none'; el.icoPause.style.display='block'; el.btnPlay.classList.add('is-playing'); el.btnPlay.setAttribute('aria-label','Пауза'); }
}
function showPlayer(b=true){ if (el.player) el.player.style.display=b?'block':'none' }
function fmt(t){ const m=Math.floor(t/60), s=Math.floor(t%60); return `${m}:${String(s).padStart(2,'0')}` }

function startPlay(i){
  __manualTrack = null;
  if(i<0||i>=state.view.length) return;
  state.playingIndex=i; const it=state.view[i]; if(!it.preview) return;
  audio.src=it.preview; audio.currentTime=0; audio.play().then(()=>setPlayIcon(false)).catch(()=>setPlayIcon(true));
  el.pTitle.textContent=it.title||'—'; el.pArtist.textContent=it.artist||''; el.pCover.style.backgroundImage=it.art?`url(${it.art})`:'none';
  el.tCur.textContent=fmt(0); el.tDur.textContent=msToMinSec(it.dur||30000); showPlayer(true);
  addStatPlay(it.title, it.artist);
  updatePlayerFavButton();
}

function playTrackDirect(track){
  __manualTrack = track;
  if (!track || !track.previewUrl) return;
  audio.src = track.previewUrl; audio.currentTime = 0;
  audio.play().then(()=>setPlayIcon(false)).catch(()=>setPlayIcon(true));
  el.pTitle.textContent = track.title || track.trackName || '—';
  el.pArtist.textContent = track.artist || track.artistName || '';
  const art = track.artwork || track.art; el.pCover.style.backgroundImage = art?`url(${art})`:'none';
  el.tCur.textContent = fmt(0); el.tDur.textContent = msToMinSec(track.dur || 30000);
  showPlayer(true);
  updatePlayerFavButton();
}
window.playTrackDirect = playTrackDirect;
let __manualTrack=null;
function getCurrentTrack(){ if(__manualTrack) return __manualTrack; const it=state.view[state.playingIndex]; if(!it) return null; return { src: it.src, title: it.title, artist: it.artist, album: it.album, previewUrl: it.preview, trackViewUrl: it.page, artwork: it.art, dur: it.dur }; }

if (el.btnPlay) el.btnPlay.addEventListener('click',()=>{ if(audio.paused){ audio.play().then(()=>setPlayIcon(false)).catch(()=>{}); } else { audio.pause(); setPlayIcon(true); } });
if (el.btnPrev) el.btnPrev.addEventListener('click',()=> startPlay(state.playingIndex<=0?state.view.length-1:state.playingIndex-1));
if (el.btnNext) el.btnNext.addEventListener('click',()=> startPlay( (state.playingIndex+1) % state.view.length ));
if (el.btnClose) el.btnClose.addEventListener('click', ()=>{ try{audio.pause()}catch(e){}; showPlayer(false); });

audio.addEventListener('play', ()=> setPlayIcon(false));
audio.addEventListener('pause',()=> setPlayIcon(true));
audio.addEventListener('timeupdate',()=>{
  const cur=audio.currentTime||0, dur=audio.duration||(state.view[state.playingIndex]?.dur/1000)||30;
  const pct=Math.max(0,Math.min(1,cur/dur));
  if (el.barP) el.barP.style.width=(pct*100)+'%';
  if (el.tCur) el.tCur.textContent=fmt(cur);
  if (el.tDur) el.tDur.textContent=fmt(dur);
});
audio.addEventListener('ended',()=> el.btnNext && el.btnNext.click());
if (el.bar) el.bar.addEventListener('click',(e)=>{ const r=el.bar.getBoundingClientRect(); const ratio=(e.clientX-r.left)/r.width; const dur=audio.duration||30; audio.currentTime=Math.max(0,Math.min(dur,ratio*dur)); });

async function doSearch(){
  const L=i18n[state.lang]; const q=el.q.value.trim(); if(!q) return;
  el.statusText.textContent=L.searching; el.source.textContent=''; addStatQuery(q);
  try{
    const items = await searchBoth(q);
    if(!items.length){ el.statusText.textContent=L.notFound; state.results=[]; state.view=[]; el.results.innerHTML=''; if (el.moreWrap) el.moreWrap.style.display='none'; return; }
    state.results = items; state.view = items; state.page=0;
    el.source.textContent='Источник: '+Array.from(new Set(items.map(x=>x.src))).join(' + ');
    fillFilters(items);
    render();
    el.results.scrollIntoView({behavior:'smooth',block:'start'});
    el.statusText.textContent=L.ready;
  }catch(e){ el.statusText.textContent='Ошибка сети.'; console.error(e); }
}
if (el.go) el.go.addEventListener('click', doSearch);
if (el.q) el.q.addEventListener('keydown', (e)=>{ if(e.key==='Enter') doSearch(); });
if (el.clear) el.clear.addEventListener('click', clearSearch);

function makeTrackPayload(it){ return { src: it.src, title: it.title, artist: it.artist, album: it.album, previewUrl: it.preview, trackViewUrl: it.page, artwork: it.art, dur: it.dur }; }
function buildCardControls(it, idx, playHandler, listName){
  const controls=document.createElement('div'); controls.className='controls';
  const play=document.createElement('button'); play.className='pill'; play.textContent=it.preview?`► ${msToMinSec(it.dur)}`:'—'; play.disabled=!it.preview;
  const ya=document.createElement('a'); ya.className='pill'; ya.href=`https://music.yandex.ru/search?text=${encodeURIComponent((it.artist||'')+' '+(it.title||''))}`; ya.target='_blank'; ya.rel='noopener'; ya.textContent='🟡 Яндекс';
  const src=document.createElement('a'); src.className='pill'; src.href=it.page||'#'; src.target='_blank'; src.rel='noopener'; src.textContent=it.src;
  const sp=document.createElement('a'); sp.className='pill'; sp.href=`https://open.spotify.com/search/${encodeURIComponent((it.artist||'')+' '+(it.title||''))}`; sp.target='_blank'; sp.rel='noopener'; sp.textContent='🟢 Spotify';
  controls.appendChild(play); controls.appendChild(ya); controls.appendChild(src); controls.appendChild(sp);

  const favBtn=document.createElement('button'); favBtn.className='pill fav-toggle'; favBtn.dataset.index = String(idx); favBtn.dataset.list = listName || 'search';
  setFavoriteButtonState(favBtn, it);
  favBtn.addEventListener('click',()=>{
    const track = makeTrackPayload(it);
    if (window.toggleFavorite) window.toggleFavorite(track);
    else if (window.addToFavorites) window.addToFavorites(track);
    setFavoriteButtonState(favBtn, it);
  });
  const plBtn=document.createElement('button'); plBtn.className='pill'; plBtn.textContent='➕ В плейлист';
  plBtn.addEventListener('click',()=>{
    const track = makeTrackPayload(it);
    if (window.openPlaylistDialog) window.openPlaylistDialog(track);
  });
  controls.appendChild(favBtn); controls.appendChild(plBtn);
  if (playHandler) play.addEventListener('click', playHandler);
  return controls;
}
function createTrackCard(it, idx, playHandler, listName){
  const card=document.createElement('div'); card.className='card'; card.style.animationDelay=`${Math.min(idx,8)*40}ms`;
  const top=document.createElement('div'); top.className='top';
  const cover=document.createElement('div'); cover.className='cover'; if(it.art) cover.style.backgroundImage=`url(${it.art})`;
  const meta=document.createElement('div'); meta.className='meta';
  const t=document.createElement('p'); t.className='title'; t.textContent=it.title||'—';
  const sub=document.createElement('p'); sub.className='subtitle';
  const artist = it.artist || '';
  const album = it.album || '';
  sub.textContent = artist && album ? `${artist} • ${album}` : (artist || album);
  meta.appendChild(t); meta.appendChild(sub);
  top.appendChild(cover); top.appendChild(meta);
  const controls = buildCardControls(it, idx, playHandler, listName);
  card.appendChild(top); card.appendChild(controls);
  return card;
}
function render(){
  if (!el.results) return;
  el.results.innerHTML='';
  const end = (state.page+1)*state.pageSize;
  const pageItems = state.view.slice(0,end);
  pageItems.forEach((it,idx)=>{
    const card = createTrackCard(it, idx, ()=> startPlay(idx), 'search');
    el.results.appendChild(card);
  });
  if (el.moreWrap) el.moreWrap.style.display = end < state.view.length ? 'block' : 'none';
}

// Stats dialog
function renderStats(){
  const L=i18n[state.lang], q = state.stats.q, p = state.stats.play;
  let html = `<div><strong>${L.statsQ}:</strong></div><table class="table"><tr><th>Запрос</th><th>Счёт</th></tr>`;
  for(const [k,v] of Object.entries(q).sort((a,b)=>b[1]-a[1]).slice(0,12)) html+=`<tr><td>${k}</td><td>${v}</td></tr>`;
  html += `</table><div style="height:8px"></div><div><strong>${L.statsP}:</strong></div><table class="table"><tr><th>Трек</th><th>Счёт</th></tr>`;
  for(const [k,v] of Object.entries(p).sort((a,b)=>b[1]-a[1]).slice(0,12)) html+=`<tr><td>${k}</td><td>${v}</td></tr>`;
  html += `</table>`;
  $('#statsBody').innerHTML = html;
}
if (el.openStats) el.openStats.addEventListener('click',()=>{ renderStats(); el.statsDlg.showModal(); });
if (el.closeStats) el.closeStats.addEventListener('click',()=> el.statsDlg.close());
if (el.resetStats) el.resetStats.addEventListener('click',()=>{ state.stats={q:{},play:{}}; saveStats(); renderStats(); });

setTimeout(()=> el.q && el.q.focus(), 150);

// Pagination
if (el.more) el.more.addEventListener('click', () => { state.page += 1; render(); });

// Player extra buttons
const btnFav = document.getElementById('btnFav');
const btnAddPl = document.getElementById('btnAddPl');
function updatePlayerFavButton(){
  const current = getCurrentTrack();
  if (!btnFav) return;
  if (!current){ btnFav.textContent = '☆ В избранное'; btnFav.classList.remove('is-favorite'); return; }
  const active = isFavoriteTrack(current);
  btnFav.classList.toggle('is-favorite', active);
  btnFav.textContent = active ? '★ В избранном' : '☆ В избранное';
  btnFav.setAttribute('aria-pressed', active ? 'true' : 'false');
}
if (btnFav) btnFav.addEventListener('click', ()=>{
  const t = getCurrentTrack(); if (!t) return;
  if (window.toggleFavorite) window.toggleFavorite(t);
  else if (window.addToFavorites) window.addToFavorites(t);
  updatePlayerFavButton();
});
if (btnAddPl) btnAddPl.addEventListener('click', ()=>{
  const t = getCurrentTrack(); if (!t) return;
  if (window.openPlaylistDialog) window.openPlaylistDialog(t);
});
window.addEventListener('favorites:updated', ()=>{
  document.querySelectorAll('.fav-toggle').forEach((button)=>{
    const idx = Number(button.dataset.index);
    const list = button.dataset.list;
    const track = list === 'popular' ? state.popular[idx] : state.view[idx];
    if (track) setFavoriteButtonState(button, track);
  });
  updatePlayerFavButton();
});

async function loadPopularTracks(){
  if (!el.popularResults) return;
  try{
    const popular = await jsonp('https://itunes.apple.com/search?term=top%20hits&entity=song&limit=8','callback');
    const items = (popular.results||[]).map((x)=>({
      src:'Apple',
      title:x.trackName,
      artist:x.artistName,
      album:x.collectionName,
      preview:x.previewUrl,
      art:(x.artworkUrl100||'').replace('100x100bb','300x300bb'),
      dur:x.trackTimeMillis||30000,
      page:x.trackViewUrl,
    }));
    state.popular = items;
    el.popularResults.innerHTML = '';
    items.forEach((it, idx)=>{
      const payload = { src: it.src, title: it.title, artist: it.artist, album: it.album, previewUrl: it.preview, trackViewUrl: it.page, artwork: it.art, dur: it.dur };
      const card = createTrackCard(it, idx, ()=> playTrackDirect(payload), 'popular');
      el.popularResults.appendChild(card);
    });
  }catch(e){
    el.popularResults.innerHTML = '<div class="error">Не удалось загрузить популярные треки. Проверьте соединение.</div>';
    console.error(e);
  }
}

loadPopularTracks();
