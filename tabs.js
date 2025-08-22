function showTab(tab) {
  const sections = ['search', 'favorites', 'playlist'];
  sections.forEach(id => {
    const el = document.getElementById('tab-' + id);
    if (el) el.style.display = (id === tab) ? 'block' : 'none';
  });
}
