// ============================
// Favorites & Playlists logic
// ============================

// Favorites — array
/* SAFE_FAV_PARSE */
let __favRaw = localStorage.getItem("favorites");
try{ window.favorites = __favRaw ? JSON.parse(__favRaw) : []; }catch(e){ window.favorites = []; localStorage.setItem("favorites","[]"); }
function saveFavorites(){ localStorage.setItem("favorites", JSON.stringify(window.favorites)); }

// Playlists — object { name: Track[] }
(function migratePlaylists(){
  try {
    const legacy = JSON.parse(localStorage.getItem("playlist") || "null");
    const haveObj = localStorage.getItem("playlists");
    if (legacy && !haveObj) {
      const obj = { "Мой плейлист": legacy };
      localStorage.setItem("playlists", JSON.stringify(obj));
      localStorage.removeItem("playlist");
    } else if (!haveObj) {
      localStorage.setItem("playlists", JSON.stringify({ "Мой плейлист": [] }));
    }
  } catch(e){ localStorage.setItem("playlists", JSON.stringify({ "Мой плейлист": [] })); }
})();

function getPlaylists(){ try{ return JSON.parse(localStorage.getItem("playlists")||"{}"); }catch(e){ return {}; } }
function savePlaylists(obj){ localStorage.setItem("playlists", JSON.stringify(obj)); }

// Stable id
function getTrackId(track){
  if (!track) return undefined;
  if (track.trackId) return String(track.trackId);
  if (track.id) return String(track.id);
  const title = (track.title || track.trackName || '').toLowerCase().trim();
  const artist = (track.artist || track.artistName || '').toLowerCase().trim();
  const src = (track.src || '').toLowerCase().trim();
  const key = src + '::' + title + '__' + artist;
  return key || undefined;
}

// Public API used from main.js
window.addToFavorites = function(track){ track = normalizeTrackFields(track);
  const id = getTrackId(track);
  if (!window.favorites.find(t=>getTrackId(t)===id)) {
    window.favorites.push(track);
    saveFavorites();
    renderSaved(window.favorites, 'favorites');
  }
}

window.openPlaylistDialog = function(track){
  __plPendingTrack = track;
  buildPlaylistList();
  const dlg = document.getElementById('plDlg');
  if (dlg) dlg.showModal();
}

// ============================
// Rendering — Favorites
// ============================
function renderSaved(list, containerId){
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  list.forEach(track=>{
    const div = document.createElement('div'); div.className='track';

    const art = track.artwork || track.art || '';
    const cover = document.createElement('div'); cover.className='cover';
    if (art) cover.style.backgroundImage = `url(${art})`;

    const title = track.trackName || track.title || '—';
    const artist = track.artistName || track.artist || '';

    const content = document.createElement('div'); content.className='content';
    content.innerHTML = `<p class="title">${title}</p><p class="artist">${artist}</p>`;

    const buttons = document.createElement('div'); buttons.className='track-buttons';

    if (track.previewUrl){
      const playBtn = document.createElement('button');
      playBtn.className = 'track-btn';
      playBtn.textContent = '► Прослушать';
      playBtn.addEventListener('click', ()=>{
        const t = { src: track.src, title, artist, album: track.album, previewUrl: track.previewUrl, trackViewUrl: track.trackViewUrl||track.itunes, artwork: art, dur: track.dur||30000 };
        if (window.playTrackDirect) window.playTrackDirect(t);
      });
      buttons.appendChild(playBtn);
    }

    if (track.trackViewUrl || track.itunes){
      const apple = document.createElement('a');
      apple.className='track-btn'; apple.href=(track.trackViewUrl||track.itunes); apple.target='_blank';
      apple.textContent='Apple Music';
      buttons.appendChild(apple);
    }
    const sp = document.createElement('a');
    sp.className='track-btn'; sp.href='https://open.spotify.com/search/'+encodeURIComponent(title+' '+artist);
    sp.target='_blank'; sp.textContent='Spotify';
    buttons.appendChild(sp);

    const ya = document.createElement('a');
    ya.className='track-btn'; ya.href='https://music.yandex.ru/search?text='+encodeURIComponent((artist?artist+' ':'')+title);
    ya.target='_blank'; ya.textContent='Яндекс Музыка';
    buttons.appendChild(ya);

    const rm = document.createElement('button');
    rm.className='track-btn'; rm.textContent='Удалить';
    const id = getTrackId(track);
    rm.addEventListener('click', ()=>{
      const idx = window.favorites.findIndex(t=>getTrackId(t)===id);
      if (idx>-1){ window.favorites.splice(idx,1); saveFavorites(); renderSaved(window.favorites, 'favorites'); }
    });
    buttons.appendChild(rm);

    div.appendChild(cover); div.appendChild(content); div.appendChild(buttons);
    container.appendChild(div);
  });
}

// ============================
// Rendering — Playlists
// ============================
function populatePlaylistSelect(){
  const sel = document.getElementById('plSelect'); if(!sel) return;
  const pls = getPlaylists(); const current = sel.value;
  sel.innerHTML = `<option value="">Выбрать плейлист</option>` + Object.keys(pls).sort().map(n=>`<option ${n===current?'selected':''}>${n}</option>`).join('');
  const badge = document.getElementById('plCountBadge');
  if (badge){
    const list = current && pls[current] ? pls[current] : [];
    badge.textContent = String((list && list.length) || 0);
  }
}

function renderPlaylistTracks(){
  const wrap = document.getElementById('playlistTracks');
  const sel = document.getElementById('plSelect');
  const badge = document.getElementById('plCountBadge');
  if (!wrap || !sel) return;
  const name = sel.value;
  wrap.innerHTML = '';
  const pls = getPlaylists();
  const list = pls[name] || [];
  if (badge) badge.textContent = String(list.length || 0);
  if (!name) { wrap.innerHTML = '<div class="error">Выберите плейлист либо создайте новый выше.</div>'; return; }

  list.forEach((track, i)=>{
    const div = document.createElement('div'); div.className='track'; div.draggable = true; div.dataset.index = String(i);

    const art = track.artwork || track.art || '';
    const cover = document.createElement('div'); cover.className='cover'; if (art) cover.style.backgroundImage = `url(${art})`;

    const title = track.title || track.trackName || '—';
    const artist = track.artist || track.artistName || '';

    const content = document.createElement('div'); content.className='content';
    content.innerHTML = `<p class="title">${title}</p><p class="artist">${artist}</p>`;

    const buttons = document.createElement('div'); buttons.className='track-buttons';

    if (track.previewUrl){
      const playBtn=document.createElement('button'); playBtn.className='track-btn'; playBtn.textContent='► Прослушать';
      playBtn.addEventListener('click',()=>{
        const t = { src: track.src, title, artist, album: track.album, previewUrl: track.previewUrl, trackViewUrl: track.trackViewUrl||track.itunes, artwork: art, dur: track.dur||30000 };
        if (window.playTrackDirect) window.playTrackDirect(t);
      });
      buttons.appendChild(playBtn);
    }
    if (track.trackViewUrl || track.itunes){
      const apple=document.createElement('a'); apple.className='track-btn'; apple.href=(track.trackViewUrl||track.itunes); apple.target='_blank'; apple.textContent='Apple Music'; buttons.appendChild(apple);
    }
    const sp=document.createElement('a'); sp.className='track-btn'; sp.href='https://open.spotify.com/search/'+encodeURIComponent(title+' '+artist); sp.target='_blank'; sp.textContent='Spotify'; buttons.appendChild(sp);
    const ya=document.createElement('a'); ya.className='track-btn'; ya.href='https://music.yandex.ru/search?text='+encodeURIComponent((artist?artist+' ':'')+title); ya.target='_blank'; ya.textContent='Яндекс Музыка'; buttons.appendChild(ya);

    const rm=document.createElement('button'); rm.className='track-btn'; rm.textContent='Удалить';
    const _id=getTrackId(track);
    rm.addEventListener('click',()=> removeTrackFromPlaylist(name, _id));
    buttons.appendChild(rm);

    // Drag handlers
    div.addEventListener('dragstart', (e)=>{ e.dataTransfer.setData('text/plain', String(i)); });
    div.addEventListener('dragover', (e)=>{ e.preventDefault(); div.classList.add('drag-over'); });
    div.addEventListener('dragleave', ()=> div.classList.remove('drag-over'));
    div.addEventListener('drop', (e)=>{
      e.preventDefault(); div.classList.remove('drag-over');
      const from = parseInt(e.dataTransfer.getData('text/plain')||'-1',10);
      const to = i;
      if (from===to || isNaN(from)) return;
      const pls2 = getPlaylists();
      const arr = pls2[name] || [];
      const [moved] = arr.splice(from,1);
      arr.splice(to,0,moved);
      savePlaylists(pls2);
      renderPlaylistTracks();
    });

    div.appendChild(cover); div.appendChild(content); div.appendChild(buttons);
    wrap.appendChild(div);
  });
}

// ============================
// Playlist operations
// ============================
function createPlaylist(name){
  name = (name||'').trim(); if (!name) return;
  const pls = getPlaylists();
  if (!pls[name]) pls[name] = [];
  savePlaylists(pls);
  populatePlaylistSelect();
  const sel = document.getElementById('plSelect'); if (sel) sel.value = name;
  renderPlaylistTracks();
  buildPlaylistList(document.getElementById('plSearch') && document.getElementById('plSearch').value);
}
function renamePlaylist(oldName, newName){
  const pls=getPlaylists(); if(!pls[oldName]) return;
  newName=(newName||'').trim(); if(!newName || pls[newName]) return;
  pls[newName]=pls[oldName]; delete pls[oldName]; savePlaylists(pls);
  populatePlaylistSelect(); const sel=document.getElementById('plSelect'); if (sel) sel.value=newName; renderPlaylistTracks(); buildPlaylistList(document.getElementById('plSearch') && document.getElementById('plSearch').value);
}
function deletePlaylist(name){
  const pls=getPlaylists(); if(!pls[name]) return;
  delete pls[name]; savePlaylists(pls);
  populatePlaylistSelect(); renderPlaylistTracks(); buildPlaylistList(document.getElementById('plSearch') && document.getElementById('plSearch').value);
}
function clearPlaylist(name){
  const pls=getPlaylists(); if(!pls[name]) return;
  pls[name]=[]; savePlaylists(pls);
  renderPlaylistTracks(); buildPlaylistList(document.getElementById('plSearch') && document.getElementById('plSearch').value);
}

function addTrackToPlaylist(name, track){ track = normalizeTrackFields(track);
  name = (name||'').trim(); if (!name) return;
  const pls = getPlaylists(); pls[name] = pls[name] || [];
  const id = getTrackId(track);
  if (!pls[name].find(t=>getTrackId(t)===id)) {
    pls[name].push(track);
    savePlaylists(pls);
  }
  populatePlaylistSelect();
  const sel = document.getElementById('plSelect'); if (sel) sel.value = name;
  renderPlaylistTracks();
}

function removeTrackFromPlaylist(name, trackId){
  const pls = getPlaylists();
  if (!pls[name]) return;
  const idx = pls[name].findIndex(t=>getTrackId(t)===String(trackId));
  if (idx>-1) {
    pls[name].splice(idx,1);
    savePlaylists(pls);
  }
  renderPlaylistTracks();
}

// ============================
// Modal chooser with search
// ============================
let __plPendingTrack = null;

function buildPlaylistList(filterText){
  const listEl = document.getElementById('plList'); if(!listEl) return;
  const pls = getPlaylists();
  const names = Object.keys(pls).sort();
  const q = (filterText||'').toLowerCase().trim();
  listEl.innerHTML = '';
  names.filter(n => !q || n.toLowerCase().includes(q)).forEach(name => {
    const div = document.createElement('div');
    div.className = 'pl-item';
    const count = (pls[name]||[]).length;
    div.innerHTML = `<span class="pl-name">${name}</span><span class="pl-count">${count}</span>`;
    div.addEventListener('click', ()=>{
      if (__plPendingTrack) addTrackToPlaylist(name, __plPendingTrack);
      closePlaylistDialog();
    });
    listEl.appendChild(div);
  });
}

function closePlaylistDialog(){
  const dlg = document.getElementById('plDlg');
  if (dlg) dlg.close();
  __plPendingTrack = null;
}

// ============================
// DOM wiring
// ============================
document.addEventListener('DOMContentLoaded', ()=>{
  // Favorites
  renderSaved(window.favorites, 'favorites');

  // Playlist toolbar
  populatePlaylistSelect();
  const sel = document.getElementById('plSelect'); if (sel) sel.addEventListener('change', renderPlaylistTracks);
  const createBtn = document.getElementById('createPlBtn');
  if (createBtn) createBtn.addEventListener('click', ()=>{
    const inp = document.getElementById('plNameInput');
    const name = (inp && inp.value) ? inp.value : prompt('Название плейлиста:');
    if (name){ createPlaylist(name); if (inp) inp.value=''; }
  });
  renderPlaylistTracks();

  // Playlist management buttons
  const rbtn=document.getElementById('renamePlBtn');
  const dbtn=document.getElementById('deletePlBtn');
  const cbtn=document.getElementById('clearPlBtn');
  if (rbtn) rbtn.addEventListener('click', ()=>{
    const sel=document.getElementById('plSelect'); if(!sel || !sel.value) return;
    const newName = prompt('Новое название плейлиста:', sel.value);
    if (newName && newName.trim() && newName.trim()!==sel.value) renamePlaylist(sel.value, newName.trim());
  });
  if (dbtn) dbtn.addEventListener('click', ()=>{
    const sel=document.getElementById('plSelect'); if(!sel || !sel.value) return;
    if (confirm('Удалить плейлист «'+sel.value+'»?')) deletePlaylist(sel.value);
  });
  if (cbtn) cbtn.addEventListener('click', ()=>{
    const sel=document.getElementById('plSelect'); if(!sel || !sel.value) return;
    if (confirm('Очистить плейлист «'+sel.value+'»?')) clearPlaylist(sel.value);
  });

  // Modal
  const search = document.getElementById('plSearch');
  const create = document.getElementById('plCreate');
  const newName = document.getElementById('plNewName');
  const cancel = document.getElementById('plCancel');
  if (search) search.addEventListener('input', e=> buildPlaylistList(e.target.value));
  if (create) create.addEventListener('click', ()=>{
    const name = (newName && newName.value) ? newName.value.trim() : '';
    if (name){
      createPlaylist(name);
      if (__plPendingTrack) addTrackToPlaylist(name, __plPendingTrack);
      closePlaylistDialog();
      if (newName) newName.value = '';
    }
  });
  if (cancel) cancel.addEventListener('click', closePlaylistDialog);
});

// unify incoming track fields
function normalizeTrackFields(track){
  if (!track) return track;
  const t = Object.assign({}, track);
  if (!t.previewUrl && t.preview) t.previewUrl = t.preview;
  if (!t.trackViewUrl && t.page) t.trackViewUrl = t.page;
  if (!t.artwork && t.art) t.artwork = t.art;
  if (!t.title && t.trackName) t.title = t.trackName;
  if (!t.artist && t.artistName) t.artist = t.artistName;
  return t;
}
