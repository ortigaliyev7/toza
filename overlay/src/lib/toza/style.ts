// Toza oynalarining Telegram (tweb) uslubidagi umumiy ko'rinishi: tweb'ning o'z rang o'zgaruvchilari va shrifti ishlatiladi,
// shuning uchun yorug'/qorong'i rejim va tanlangan rang mavzusiga o'zi moslashadi.
const CSS = `
.tz-back{--tx:#1B1A3D;--tx2:#565B82;--ac:var(--tz-a,#4A5AE8);--btn:linear-gradient(135deg,var(--tz-a,#5866F0),var(--tz-b,#3F4EDB));--card:rgba(255,255,255,.66);--cb:rgba(255,255,255,.92);--in:rgba(255,255,255,.55);--line:rgba(80,90,170,.14);--shd:0 12px 34px rgba(60,70,170,.18),inset 0 1px 0 rgba(255,255,255,.9);--sheet:rgba(244,242,255,.9);--acbg:rgba(74,90,232,.12);--bd:#C0314B;--bdbg:rgba(192,49,75,.12);--ok:#0E7A52;
position:fixed;inset:0;z-index:9999;background:rgba(10,10,40,.45);display:flex;align-items:center;justify-content:center;padding:12px;animation:tzf .15s ease-out;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
:is(html,body).night .tz-back{--tx:#F3F4FF;--tx2:#AEB3DD;--ac:#9DA9FF;--card:rgba(52,58,128,.44);--cb:rgba(255,255,255,.14);--in:rgba(255,255,255,.09);--line:rgba(255,255,255,.12);--shd:0 12px 34px rgba(0,0,20,.38),inset 0 1px 0 rgba(255,255,255,.07);--sheet:rgba(30,34,86,.92);--acbg:rgba(157,169,255,.18);--bd:#FF8FA3;--bdbg:rgba(255,110,140,.18);--ok:#62E6AB;background:rgba(0,0,16,.55)}
@keyframes tzf{from{opacity:0}to{opacity:1}}
.tz-pop{background:var(--sheet);color:var(--tx);border:1px solid var(--cb);-webkit-backdrop-filter:blur(28px) saturate(1.5);backdrop-filter:blur(28px) saturate(1.5);border-radius:28px;max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:0 0 14px;box-shadow:0 20px 50px rgba(20,20,80,.35);font:500 15px/1.35 'Inter',system-ui,sans-serif;animation:tzp .2s ease-out}
@keyframes tzp{from{transform:translateY(16px);opacity:.6}to{transform:none;opacity:1}}
.tz-pop>*{margin-left:18px!important;margin-right:18px!important}
.tz-pop>.tz-head{margin:0!important;padding:16px 18px 10px;position:sticky;top:0;background:var(--sheet);z-index:1}
.tz-pop b{display:block;color:var(--tx2);font:700 13px/1 'Inter',sans-serif;margin:14px 0 8px;letter-spacing:.2px}
.tz-pop .tz-head b{color:var(--tx);font:800 22px/1.15 'Nunito','Inter',system-ui,sans-serif;margin:0;display:block;letter-spacing:-.2px}
.tz-pop button{border:0!important;cursor:pointer;font:700 14px/1 'Inter',system-ui,sans-serif!important;height:44px;border-radius:16px!important;background:var(--in)!important;color:var(--tx)!important;padding:0 16px!important;box-shadow:inset 0 0 0 1px var(--cb)!important;transition:transform .1s}
.tz-pop button:active{transform:scale(.97)}
.tz-pop button.tz-main{background:var(--btn)!important;color:#fff!important;box-shadow:0 10px 22px rgba(70,84,225,.34),inset 0 1px 0 rgba(255,255,255,.35)!important}
.tz-pop button.tz-x{width:40px;height:40px;padding:0!important;border-radius:50%!important;font-size:18px!important;color:var(--tx2)!important;background:var(--card)!important}
.tz-pop button:disabled{opacity:.6}
.tz-pop hr{border:0!important;border-top:1px solid var(--line)!important;margin:12px 0!important}
.tz-pop input{font:500 15px/1.3 'Inter',system-ui,sans-serif!important;border-radius:16px!important;background:var(--in)!important;border:1px solid var(--cb)!important;min-height:48px;padding:0 14px!important;outline:none;color:var(--tx)!important}
.tz-pop input:focus{border-color:var(--ac)!important;box-shadow:0 0 0 3px var(--acbg)}
.tz-pop [role=checkbox]{border-radius:18px!important;background:var(--card)!important;border:1px solid var(--cb)}
.tz-sec{background:var(--card);border:1px solid var(--cb);border-radius:24px;box-shadow:var(--shd);padding:2px 16px 14px;margin-top:12px!important}
.tz-row{display:flex;align-items:center;gap:12px;min-height:52px;padding:6px 0}
.tz-row+.tz-row{border-top:1px solid var(--line)}
.tz-ic{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;flex:none;font-size:18px;background:var(--btn);box-shadow:0 6px 14px rgba(70,80,200,.22),inset 0 1px 0 rgba(255,255,255,.4)}
.tz-sub{color:var(--tx2);font:500 13px/1.35 'Inter',sans-serif}
.tz-pop .tz-sub{margin:2px 0}
.tz-quick{display:flex;gap:6px;padding:2px 10px 8px;flex:none;font-family:'Inter',system-ui,sans-serif}
.tz-quick button{flex:1 1 0;min-width:0;height:36px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 8px;border:1px solid rgba(88,102,240,.18);border-radius:18px;background:rgba(88,102,240,.08);color:var(--secondary-text-color,#565B82);font:600 12.5px/1 'Inter',system-ui,sans-serif;cursor:pointer;transition:background .18s,color .18s,transform .1s,box-shadow .18s;-webkit-tap-highlight-color:transparent}
.tz-quick button span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tz-quick button svg{flex:none}
.tz-quick button .tz-x{opacity:0;transition:opacity .18s}
.tz-quick button:active{transform:scale(.96)}
.tz-quick button.on{background:linear-gradient(135deg,var(--tz-a,#5866F0),var(--tz-b,#3F4EDB));color:#fff;border-color:transparent;box-shadow:0 6px 16px rgba(70,84,225,.32)}
.tz-quick button.on .tz-x{opacity:1}
:is(html,body).night .tz-quick button:not(.on){background:rgba(157,169,255,.1);border-color:rgba(157,169,255,.18);color:#AEB3DD}
.tz-sw{flex:none;position:relative;width:46px;height:28px;border-radius:14px;background:rgba(127,127,160,.35);transition:background .2s;margin-left:auto}
.tz-sw:after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.25);transition:transform .2s}
.tz-sw.on{background:var(--btn)}
.tz-sw.on:after{transform:translateX(18px)}
.tz-row.tz-click{cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent}
.tz-row.tz-click:active{opacity:.75}
.tz-row .tz-ic{color:#fff}
.tz-row .tz-tx{flex:1;min-width:0;font:600 15px/1.25 'Inter',system-ui,sans-serif}
.tz-row .tz-tx .tz-sub{font-weight:500;margin-top:2px}
.tz-chev{flex:none;color:var(--tx2);opacity:.7}
.tz-ic.tz-soft{background:var(--acbg);color:var(--ac);box-shadow:none}
.tz-hint{color:var(--tx2);font:500 12.5px/1.4 'Inter',sans-serif;margin:6px 2px 0}
.tz-pop textarea{font:500 15px/1.4 'Inter',system-ui,sans-serif!important;border-radius:16px!important;background:var(--in)!important;border:1px solid var(--cb)!important;padding:12px 14px!important;color:var(--tx)!important;outline:none;width:100%;box-sizing:border-box;resize:vertical}
.tz-pop textarea:focus{border-color:var(--ac)!important;box-shadow:0 0 0 3px var(--acbg)}
`;
export function ensureStyle() {
  if(document.getElementById('tz-style')) return;
  const s = document.createElement('style'); s.id = 'tz-style'; s.textContent = CSS; document.head.append(s);
}
