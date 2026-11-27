// Toza oynalarining Telegram (tweb) uslubidagi umumiy ko'rinishi: tweb'ning o'z rang o'zgaruvchilari va shrifti ishlatiladi,
// shuning uchun yorug'/qorong'i rejim va tanlangan rang mavzusiga o'zi moslashadi.
const CSS = `
.tz-back{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:12px;animation:tzf .15s ease-out}
@keyframes tzf{from{opacity:0}to{opacity:1}}
.tz-pop{background:var(--surface-color,#fff);color:var(--primary-text-color,#000);border-radius:18px;max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:0 0 12px;box-shadow:0 8px 32px rgba(0,0,0,.3);font-size:15px;line-height:1.35;font-family:inherit;animation:tzp .18s ease-out}
@keyframes tzp{from{transform:translateY(14px);opacity:.6}to{transform:none;opacity:1}}
.tz-pop>*{margin-left:16px!important;margin-right:16px!important}
.tz-pop>.tz-head{margin:0!important;padding:14px 16px 8px;position:sticky;top:0;background:var(--surface-color,#fff);z-index:1}
.tz-pop b{display:block;color:var(--primary-color,#3390ec);font-weight:500;font-size:14px;margin:14px 0 6px}
.tz-pop .tz-head b{color:inherit;font-size:19px;font-weight:500;margin:0;display:inline}
.tz-pop button{border:0!important;cursor:pointer;font-family:inherit!important;font-weight:500!important;border-radius:10px!important;background:rgba(127,127,127,.14)!important;color:var(--primary-color,#3390ec)!important;padding:9px 14px!important;transition:background .12s}
.tz-pop button:hover{background:rgba(127,127,127,.24)!important}
.tz-pop button.tz-main{background:var(--primary-color,#3390ec)!important;color:#fff!important}
.tz-pop button.tz-x{background:transparent!important;padding:4px 10px!important;font-size:22px;line-height:1;color:var(--secondary-text-color,#707579)!important}
.tz-pop button:disabled{opacity:.6}
.tz-pop hr{border:0!important;border-top:1px solid var(--border-color,rgba(127,127,127,.25))!important;margin:12px 0!important}
.tz-pop input{font-family:inherit!important;border-radius:10px!important;border:1.5px solid var(--border-color,rgba(127,127,127,.35))!important;padding:10px 12px!important;outline:none}
.tz-pop input:focus{border-color:var(--primary-color,#3390ec)!important}
.tz-pop [role=checkbox]{border-radius:10px!important}
.tz-sec{background:rgba(127,127,127,.09);border-radius:14px;padding:4px 14px 12px;margin-top:10px!important}
.tz-row{display:flex;align-items:center;gap:12px;padding:8px 0}
.tz-ic{font-size:20px;width:26px;text-align:center;flex:none}
.tz-sub{color:var(--secondary-text-color,#707579);font-size:13px}
`;
export function ensureStyle() {
  if(document.getElementById('tz-style')) return;
  const s = document.createElement('style'); s.id = 'tz-style'; s.textContent = CSS; document.head.append(s);
}
