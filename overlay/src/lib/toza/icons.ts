// Toza ikonkalari (24x24, chiziqli, rang: currentColor). Sozlamalar va bosh ekrandagi tezkor tugmalar uchun.
const P: Record<string, string> = {
  read: '<path d="M2.5 12.5l4.5 4.5L17.5 6.5"/><path d="M11.5 16l1 1L22 7.5"/><path d="M3 3l18 18" class="tz-x"/>',
  typing: '<path d="M4 6h16v9H9l-4 3.5V15H4z"/><circle cx="9" cy="10.5" r=".6" fill="currentColor"/><circle cx="12" cy="10.5" r=".6" fill="currentColor"/><circle cx="15" cy="10.5" r=".6" fill="currentColor"/>',
  ghost: '<path d="M5 20.5V11a7 7 0 0 1 14 0v9.5l-2.4-1.9-2.3 1.9-2.3-1.9-2.3 1.9-2.3-1.9z"/><circle cx="9.5" cy="11" r="1.1" fill="currentColor"/><circle cx="14.5" cy="11" r="1.1" fill="currentColor"/>',
  story: '<circle cx="12" cy="12" r="9.2" stroke-dasharray="3.6 2.6"/><path d="M6.8 12s2-3.3 5.2-3.3 5.2 3.3 5.2 3.3-2 3.3-5.2 3.3S6.8 12 6.8 12z"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9.5 2.5h5"/>',
  gallery: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  abc: '<path d="M4 18l4-11 4 11"/><path d="M5.5 14h5"/><path d="M14 7h4.2a2.5 2.5 0 0 1 0 5H14zm0 5h4.8a3 3 0 0 1 0 6H14z"/>',
  translate: '<path d="M4 5.5h9"/><path d="M8.5 3.5v2"/><path d="M11 5.5c-.8 3.6-3 6.4-6.5 8"/><path d="M6.5 8.5c1.2 2.2 3 3.8 5.5 4.8"/><path d="M13 20.5l3.8-9 3.7 9"/><path d="M14.3 17.5h5"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c.4-3.4 3.2-5.5 6.5-5.5s6.1 2.1 6.5 5.5"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6"/><path d="M18 14.3c2 .7 3.3 2.6 3.5 5.2"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-2-.4-1.2.4-2.4 1.7-2.4H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9.1-8.5-9.1z"/><circle cx="7.8" cy="11" r="1.1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1.1" fill="currentColor"/><circle cx="15" cy="8" r="1.1" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  contacts: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.5-3.8 3.6-6 7.5-6s7 2.2 7.5 6"/><path d="M16.5 4.5l3 3m0-3l-3 3"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>'
};
export function icon(name: string, size = 20): SVGSVGElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  return wrap.firstElementChild as SVGSVGElement;
}
