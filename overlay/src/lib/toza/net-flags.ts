// Toza ko'prigi, tweb ishchi (worker) tomonida: import yo'q. Yoqilganda Telegram'ga ulanish Toza serverining o'zi orqali boradi
// (wss://<toza>/tzws/<host>/apiws -> nginx -> wss://<host>.web.telegram.org/apiws). Ishchi localStorage'ni o'qiy olmaydi:
// sahifa uni ishchi manziliga `tzb=1` qilib qo'shadi (patches/0005, setWorkerProxy). Ishchisiz rejimda localStorage'dan o'qiladi.
export const tozaNet = {bridge: ''};
try {
  const loc = (self as any).location as Location;
  let on = new URLSearchParams(loc.search).get('tzb') === '1';
  if(!on && typeof localStorage !== 'undefined') on = localStorage.getItem('toza_bridge') === '1';
  if(on) tozaNet.bridge = (loc.protocol === 'http:' ? 'ws://' : 'wss://') + loc.host;
} catch{ /* manzil yo'q */ }
