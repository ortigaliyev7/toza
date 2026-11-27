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
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  loop: '<path d="M17 3.5l3 3-3 3"/><path d="M4 11.5v-1a4 4 0 0 1 4-4h12"/><path d="M7 20.5l-3-3 3-3"/><path d="M20 12.5v1a4 4 0 0 1-4 4H4"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  camera: '<path d="M4 8h3l1.8-2.5h6.4L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/>',
  tune: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5m0-5l-5 5"/>',
  rewind: '<path d="M11 7L6 12l5 5"/><path d="M18 7l-5 5 5 5"/>',
  forward: '<path d="M13 7l5 5-5 5"/><path d="M6 7l5 5-5 5"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>',
  flip: '<path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3V19H4z"/><path d="M9 12.5a3 3 0 0 1 5.2-1.6l.8.9"/><path d="M15 10v1.8h-1.8"/><path d="M15 14.5a3 3 0 0 1-5.2 1.6l-.8-.9"/><path d="M9 17v-1.8h1.8"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>'
};
export function icon(name: string, size = 20): SVGSVGElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  return wrap.firstElementChild as SVGSVGElement;
}
