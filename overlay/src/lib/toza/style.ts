// Toza oynalarining Telegram (tweb) uslubidagi umumiy ko'rinishi: tweb'ning o'z rang o'zgaruvchilari va shrifti ishlatiladi,
// shuning uchun yorug'/qorong'i rejim va tanlangan rang mavzusiga o'zi moslashadi.
const CSS = `
.tz-back{--tx:var(--primary-text-color,#000);--tx2:var(--secondary-text-color,#707579);--ac:var(--primary-color,#3390ec);--btn:var(--primary-color,#3390ec);--card:var(--surface-color,#fff);--cb:var(--border-color,#dfe1e5);--in:var(--background-color,#f4f4f5);--line:var(--border-color,#dfe1e5);--shd:0 1px 2px rgba(0,0,0,.06);--sheet:var(--background-color,#f4f4f5);--acbg:color-mix(in srgb,var(--primary-color,#3390ec) 14%,transparent);--bd:var(--danger-color,#df3f40);--bdbg:color-mix(in srgb,var(--danger-color,#df3f40) 14%,transparent);--ok:var(--green-color,#70b768);
position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:12px;animation:tzf .15s ease-out;font-family:var(--font-regular,system-ui,-apple-system,Roboto,sans-serif)}
:is(html,body).night .tz-back{background:rgba(0,0,0,.55)}
@keyframes tzf{from{opacity:0}to{opacity:1}}
.tz-pop{background:var(--sheet);color:var(--tx);border:1px solid var(--cb);border-radius:28px;max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:0 0 14px;box-shadow:0 12px 40px rgba(0,0,0,.25);font:500 15px/1.35 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif);animation:tzp .2s ease-out}
@keyframes tzp{from{transform:translateY(16px);opacity:.6}to{transform:none;opacity:1}}
.tz-pop>*{margin-left:18px!important;margin-right:18px!important}
.tz-pop>.tz-head{margin:0!important;padding:16px 18px 10px;position:sticky;top:0;background:var(--sheet);z-index:1}
.tz-pop b{display:block;color:var(--tx2);font:700 13px/1 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif);margin:14px 0 8px;letter-spacing:.2px}
.tz-pop .tz-head b{color:var(--tx);font:600 20px/1.2 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif);margin:0;display:block;letter-spacing:-.2px}
.tz-pop button{border:0!important;cursor:pointer;font:700 14px/1 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif)!important;height:44px;border-radius:16px!important;background:var(--in)!important;color:var(--tx)!important;padding:0 16px!important;box-shadow:inset 0 0 0 1px var(--cb)!important;transition:transform .1s}
.tz-pop button:active{transform:scale(.97)}
.tz-pop button.tz-main{background:var(--btn)!important;color:#fff!important;box-shadow:none!important}
.tz-pop button.tz-x{width:40px;height:40px;padding:0!important;border-radius:50%!important;font-size:18px!important;color:var(--tx2)!important;background:var(--card)!important}
.tz-pop button:disabled{opacity:.6}
.tz-pop hr{border:0!important;border-top:1px solid var(--line)!important;margin:12px 0!important}
.tz-pop input{font:500 15px/1.3 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif)!important;border-radius:16px!important;background:var(--in)!important;border:1px solid var(--cb)!important;min-height:48px;padding:0 14px!important;outline:none;color:var(--tx)!important}
.tz-pop input:focus{border-color:var(--ac)!important;box-shadow:0 0 0 3px var(--acbg)}
.tz-pop [role=checkbox]{border-radius:18px!important;background:var(--card)!important;border:1px solid var(--cb)}
.tz-sec{background:var(--card);border:1px solid var(--cb);border-radius:24px;box-shadow:var(--shd);padding:2px 16px 14px;margin-top:12px!important}
.tz-row{display:flex;align-items:center;gap:12px;min-height:52px;padding:6px 0}
.tz-row+.tz-row{border-top:1px solid var(--line)}
.tz-ic{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;flex:none;font-size:18px;background:var(--btn);box-shadow:none}
.tz-sub{color:var(--tx2);font:500 13px/1.35 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif)}
.tz-pop .tz-sub{margin:2px 0}
.tz-quick{display:flex;gap:6px;padding:2px 10px 8px;flex:none;font-family:var(--font-regular,system-ui,-apple-system,Roboto,sans-serif)}
.tz-quick button{flex:1 1 0;min-width:0;height:36px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 8px;border:1px solid color-mix(in srgb,var(--primary-color,#3390ec) 22%,transparent);border-radius:18px;background:color-mix(in srgb,var(--primary-color,#3390ec) 8%,transparent);color:var(--secondary-text-color,#707579);font:600 12.5px/1 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif);cursor:pointer;transition:background .18s,color .18s,transform .1s,box-shadow .18s;-webkit-tap-highlight-color:transparent}
.tz-quick button span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tz-quick button svg{flex:none}
.tz-quick button .tz-x{opacity:0;transition:opacity .18s}
.tz-quick button:active{transform:scale(.96)}
.tz-quick button.on{background:var(--primary-color,#3390ec);color:#fff;border-color:transparent;box-shadow:0 4px 12px color-mix(in srgb,var(--primary-color,#3390ec) 35%,transparent)}
.tz-quick button.on .tz-x{opacity:1}
.tz-sw{flex:none;position:relative;width:46px;height:28px;border-radius:14px;background:rgba(127,127,160,.35);transition:background .2s;margin-left:auto}
.tz-sw:after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.25);transition:transform .2s}
.tz-sw.on{background:var(--btn)}
.tz-sw.on:after{transform:translateX(18px)}
.tz-row.tz-click{cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent}
.tz-row.tz-click:active{opacity:.75}
.tz-row .tz-ic{color:#fff}
.tz-row .tz-tx{flex:1;min-width:0;font:600 15px/1.25 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif)}
.tz-row .tz-tx .tz-sub{font-weight:500;margin-top:2px}
.tz-chev{flex:none;color:var(--tx2);opacity:.7}
.tz-ic.tz-soft{background:var(--acbg);color:var(--ac);box-shadow:none}
.tz-hint{color:var(--tx2);font:500 12.5px/1.4 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif);margin:6px 2px 0}
.tz-pop textarea{font:500 15px/1.4 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif)!important;border-radius:16px!important;background:var(--in)!important;border:1px solid var(--cb)!important;padding:12px 14px!important;color:var(--tx)!important;outline:none;width:calc(100% - 36px);box-sizing:border-box;resize:vertical;display:block}
.tz-pop textarea:focus{border-color:var(--ac)!important;box-shadow:0 0 0 3px var(--acbg)}
.tz-upd{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99998;display:flex;align-items:center;gap:10px;width:min(440px,calc(100vw - 24px));box-sizing:border-box;padding:10px 10px 10px 12px;border-radius:20px;background:var(--surface-color,#fff);color:var(--primary-text-color,#000);border:1px solid var(--border-color,#dfe1e5);box-shadow:0 8px 26px rgba(0,0,0,.22);font:500 13.5px/1.35 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif);animation:tzp .2s ease-out}
.tz-upd-ic{flex:none;width:34px;height:34px;border-radius:12px;display:grid;place-items:center;color:#fff;background:var(--primary-color,#3390ec)}
.tz-upd-t{flex:1;min-width:0}
.tz-upd button{flex:none;height:34px;border:0;border-radius:12px;padding:0 12px;font:700 13px/1 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif);cursor:pointer}
.tz-upd-go{background:var(--primary-color,#3390ec);color:#fff}
.tz-upd-later{background:var(--background-color,#f4f4f5);color:var(--primary-text-color,#000)}
.tz-seg{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--in);margin:4px 0 6px}
.tz-pop .tz-seg button{flex:1;height:38px!important;border-radius:11px!important;background:transparent!important;box-shadow:none!important;color:var(--tx2)!important;font-weight:600!important;padding:0 6px!important}
.tz-pop .tz-seg button.on{background:var(--btn)!important;color:#fff!important}
.tz-chips{display:flex;gap:6px;overflow-x:auto;padding:8px 0 4px;scrollbar-width:none}
.tz-chips::-webkit-scrollbar{display:none}
.tz-pop .tz-chips button{flex:none;height:34px!important;border-radius:17px!important;padding:0 12px!important;font-weight:600!important;font-size:13px!important;color:var(--tx2)!important}
.tz-pop .tz-chips button.on{background:var(--btn)!important;color:#fff!important;box-shadow:none!important}
.tz-cc-bar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:4px!important}
.tz-cc-bar .tz-sub{flex:1 0 auto;white-space:nowrap;font-size:12.5px}
.tz-pop button.tz-mini{height:32px!important;padding:0 10px!important;font-size:12.5px!important;border-radius:12px!important}
.tz-cc-list{max-height:52vh;overflow:auto;background:var(--card);border:1px solid var(--cb);border-radius:18px;padding:0 12px!important;margin-top:8px!important;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.tz-cc-row{cursor:pointer;-webkit-tap-highlight-color:transparent}
.tz-cc-av{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--acbg);color:var(--ac);font-weight:700;font-size:16px}
.tz-cc-ck{flex:none;width:24px;height:24px;border-radius:50%;border:2px solid var(--cb);display:grid;place-items:center;color:transparent;transition:background .15s,border-color .15s;opacity:0}
.tz-cc.selecting .tz-cc-ck{opacity:1}
.tz-cc-row.on .tz-cc-ck{background:var(--btn);border-color:transparent;color:#fff;opacity:1}
.tz-cc-row.on{background:var(--acbg);margin:0 -12px;padding:6px 12px}
.tz-pop .tz-cc-del{width:calc(100% - 36px);margin-top:10px!important}
.tz-pop button.tz-danger{background:var(--bd)!important;color:#fff!important}
.tz-cc-confirm button{width:100%;margin-top:8px}
.tz-sel{flex:none;height:36px;padding:0 8px;border-radius:10px;border:1px solid var(--cb);background:var(--in);color:var(--tx);font:inherit}
.tz-cc-badge{flex:none;min-width:22px;height:22px;padding:0 7px;border-radius:11px;background:var(--btn);color:#fff;font-size:12.5px;font-weight:600;display:grid;place-items:center;box-sizing:border-box}
.tz-selbar{display:flex;align-items:center;gap:6px;padding-inline-end:10px;position:absolute;inset-inline:0;z-index:4;background:var(--surface-color);border-bottom:1px solid var(--border-color);opacity:0;transition:opacity .18s}
.tz-selbar.in{opacity:1}
.tz-selbar-row{flex:1;min-width:0;display:flex;gap:6px;overflow-x:auto;padding:8px 10px;scrollbar-width:none}
.tz-selbar-row::-webkit-scrollbar{display:none}
.tz-selbar-row button{flex:none;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:16px;border:1px solid var(--border-color);background:var(--background-color);color:var(--primary-text-color);font:500 13.5px/1 var(--font-regular,system-ui,sans-serif);cursor:pointer;white-space:nowrap}
.tz-selbar-row button.on{background:var(--primary-color);border-color:transparent;color:#fff}
.tz-selbar-row button.busy{opacity:.55}
.tz-selbar .tz-selbar-del{flex:none;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:16px;font:600 13.5px/1 var(--font-regular,system-ui,sans-serif);cursor:pointer;background:var(--danger-color,#e53935);border-color:transparent;color:#fff}
.tz-hud{position:absolute;left:50%;top:14%;transform:translateX(-50%);z-index:5;display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:16px;background:rgba(0,0,0,.62);color:#fff;font:500 15px/1.2 var(--font-regular,system-ui,sans-serif);opacity:0;pointer-events:none;transition:opacity .18s;white-space:nowrap;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.tz-hud.on{opacity:1}
.tz-hud:has(button).on{pointer-events:auto}
.tz-hud-bar{display:block;width:90px;height:4px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden}
.tz-hud-bar b{display:block;height:100%;background:#fff;border-radius:2px}
.tz-hud button{border:0;border-radius:10px;padding:6px 10px;background:rgba(255,255,255,.18);color:#fff;font:inherit;cursor:pointer}
.tz-pbtn{color:#fff!important;display:inline-grid!important;place-items:center}
.tz-pmenu{position:absolute;right:12px;bottom:64px;z-index:6;min-width:230px;padding:8px;border-radius:16px;background:rgba(24,24,28,.92);color:#fff;font:500 14px/1.2 var(--font-regular,system-ui,sans-serif);box-shadow:0 10px 30px rgba(0,0,0,.4);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.tz-pm-row{display:flex;align-items:center;gap:10px;padding:8px 10px}
.tz-pm-row input{flex:1;accent-color:var(--primary-color,#8774e1)}
.tz-pm-v{min-width:40px;text-align:end;font-variant-numeric:tabular-nums;opacity:.85}
.tz-pm-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px;border:0;border-radius:10px;background:none;color:inherit;font:inherit;text-align:start;cursor:pointer}
.tz-pm-item:hover{background:rgba(255,255,255,.08)}
.tz-pm-item.on{color:var(--primary-color,#8774e1)}
video.tz-cover{object-fit:cover!important}
`;
export function ensureStyle() {
  if(document.getElementById('tz-style')) return;
  const s = document.createElement('style'); s.id = 'tz-style'; s.textContent = CSS; document.head.append(s);
}
