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
.tz-upd{position:fixed;left:50%;top:calc(env(safe-area-inset-top, 0px) + 10px);transform:translateX(-50%);z-index:99998;display:flex;align-items:center;gap:10px;width:min(440px,calc(100vw - 24px));box-sizing:border-box;padding:10px 10px 10px 12px;border-radius:20px;background:var(--surface-color,#fff);color:var(--primary-text-color,#000);border:1px solid var(--border-color,#dfe1e5);box-shadow:0 8px 26px rgba(0,0,0,.22);font:500 13.5px/1.35 var(--font-regular,system-ui,-apple-system,Roboto,sans-serif);animation:tzp .2s ease-out}
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
.tz-flip{position:absolute;left:50%;bottom:10%;transform:translateX(-50%);z-index:3;width:48px;height:48px;border-radius:50%;border:0;display:grid;place-items:center;background:rgba(0,0,0,.45);color:#fff;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);pointer-events:auto}
.tz-flip:disabled{opacity:.5}
.tz-hold{position:fixed;z-index:1000;pointer-events:none;display:flex;align-items:flex-end;gap:10px;flex-direction:row-reverse}
.tz-hold-lock{background:var(--surface-color,#fff);color:var(--primary-text-color,#000);border-radius:20px;padding:10px 8px;box-shadow:0 2px 10px rgba(0,0,0,.25);font-size:15px;line-height:1.3;white-space:pre;text-align:center;transition:transform .05s}
.tz-hold-cancel{background:var(--surface-color,#fff);color:var(--secondary-text-color,#707579);border-radius:16px;padding:8px 12px;box-shadow:0 2px 10px rgba(0,0,0,.2);font-size:14px;white-space:nowrap}
.tz-hold-toast{transform:translateX(-50%);background:rgba(0,0,0,.78);color:#fff;border-radius:16px;padding:8px 14px;font-size:14px;white-space:nowrap}
.btn-send.tz-holding{transition:transform .15s}
.btn-send.tz-holding{transform:scale(1.35)!important}
@keyframes tz-soft{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes tz-pop{0%{opacity:0;transform:scale(.7)}60%{opacity:1;transform:scale(1.04)}100%{opacity:1;transform:none}}
@keyframes tz-slide{from{opacity:0;transform:translateX(calc(-28px * var(--reflect, 1)))}to{opacity:1;transform:none}}
.tz-an-soft{--tz-kf:tz-soft;--tz-ease:cubic-bezier(.2,.8,.2,1)}
.tz-an-pop{--tz-kf:tz-pop;--tz-ease:cubic-bezier(.3,1.4,.5,1)}
.tz-an-slide{--tz-kf:tz-slide;--tz-ease:cubic-bezier(.2,.8,.2,1)}
@media (prefers-reduced-motion:no-preference){
.tz-an-msg body:not(.animation-level-0) .bubble.tz-new .bubble-content-wrapper{animation:var(--tz-kf) calc(.34s * var(--tz-k, 1)) var(--tz-ease) both;transform-origin:0 100%}
.tz-an body:not(.animation-level-0) .tz-an-demo .tz-new .bubble-content-wrapper{animation:var(--tz-kf) calc(.34s * var(--tz-k, 1)) var(--tz-ease) both;transform-origin:0 100%}
.tz-an-btn body:not(.animation-level-0) :is(.btn-icon,.btn-circle,.btn-primary,.tz-main,.tz-chips button,.tz-seg button,.tz-selbar button){transition:transform calc(.12s * var(--tz-k, 1)) ease-out}
.tz-an-btn body:not(.animation-level-0) :is(.btn-icon,.btn-circle,.btn-primary,.tz-main,.tz-chips button,.tz-seg button,.tz-selbar button):active{transform:scale(.9)}
.tz-an-btn body:not(.animation-level-0) .tz-sw::after{transition:transform calc(.22s * var(--tz-k, 1)) cubic-bezier(.3,1.4,.5,1),background-color .2s}
.tz-an-list body:not(.animation-level-0) .chatlist-chat{transition:transform calc(.16s * var(--tz-k, 1)) ease-out}
.tz-an-list body:not(.animation-level-0) .chatlist-chat:active{transform:scale(.97)}
.tz-an-list body:not(.animation-level-0) .tz-row.tz-click:active{transform:scale(.98)}
.tz-an-pop-on body:not(.animation-level-0) .tz-pop,.tz-an-pop-on body:not(.animation-level-0) .tz-selbar.in,.tz-an-pop-on body:not(.animation-level-0) .tz-upd{animation:var(--tz-kf) calc(.3s * var(--tz-k, 1)) var(--tz-ease) both}
.tz-an-pop-on body:not(.animation-level-0) .tz-back{animation:tz-fade calc(.2s * var(--tz-k, 1)) ease-out both}
}
@keyframes tz-fade{from{opacity:0}to{opacity:1}}
.tz-design-cover{border-radius:18px;padding:12px 12px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;color:#fff;transition:background .25s}
.tz-design-seg{display:flex;gap:2px;padding:3px;border-radius:999px;background:rgba(0,0,0,.22);margin-bottom:10px}
.tz-pop .tz-design-seg button,.tz-design-seg button{border:0!important;cursor:pointer;height:32px!important;border-radius:999px!important;padding:0 18px!important;background:transparent!important;color:#fff!important;box-shadow:none!important;font-weight:600!important}
.tz-pop .tz-design-seg button.on,.tz-design-seg button.on{background:#fff!important;color:#222!important}
.tz-design-avatar{width:96px!important;height:96px!important;border-radius:50%;box-shadow:0 0 0 3px rgba(255,255,255,.35);overflow:hidden;--size:96px}
.tz-design-av{display:grid;place-items:center;font-size:36px;font-weight:600;background:rgba(255,255,255,.25)}
.tz-design-name{font-size:20px;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,.3);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:6px}
.tz-design-st{font-size:13px;opacity:.8}
.tz-design-reply{margin:10px 0 4px;border-inline-start:3px solid var(--tz-nc);border-radius:6px;padding:6px 10px;display:flex;flex-direction:column;font-size:14px;background-color:color-mix(in srgb,var(--tz-nc) 12%,transparent)}
.tz-design-reply[hidden]{display:none}
.tz-design-reply b{color:var(--tz-nc)}
.tz-design-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(40px,1fr));gap:12px}
.tz-pop .tz-design-sw,.tz-design-sw{width:40px;height:40px!important;border-radius:50%!important;padding:0!important;border:0;cursor:pointer;background:var(--sw,#888)!important;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)!important;justify-self:center}
.tz-pop .tz-design-sw.on,.tz-design-sw.on{box-shadow:0 0 0 2px var(--card,var(--surface-color,#fff)),0 0 0 4px var(--btn,var(--primary-color))!important}
.tz-design-reset{display:block;width:100%;margin-top:8px}
.tz-design-reset[hidden]{display:none!important}
.tz-design .tz-design-apply{width:100%;margin-top:10px;position:sticky;bottom:8px;z-index:1}
.tz-edits{display:block;margin:4px 10px 6px;font-size:12.5px;line-height:1.35;color:inherit}
.tz-edits summary{cursor:pointer;opacity:.7;list-style:none;user-select:none}
.tz-edits summary::-webkit-details-marker{display:none}
.tz-edits[open] summary{opacity:.9;margin-bottom:4px}
.tz-edits-row{border-inline-start:2px solid #e8860c;padding:2px 8px;margin:4px 0}
.tz-edits-time{font-size:11px;opacity:.6}
.tz-edits-text{white-space:pre-wrap;word-break:break-word;text-decoration:line-through;text-decoration-color:rgba(232,134,12,.6)}
.tz-tabbar{display:none}
@media (max-width:600px){
.tz-tabbar{display:flex;position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:5;height:62px;border-radius:31px;background:color-mix(in srgb,var(--surface-color,#fff) 88%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 4px 18px rgba(0,0,0,.22);padding:4px;gap:2px}
.tz-tabbar-on #folders-container .scrollable{padding-bottom:84px}
.tz-tabbar-on #new-menu{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}
.tz-tabbar-on .item-main{position:relative}
}
.tz-tabbar-btn{flex:1;border:0;background:none;border-radius:27px;color:var(--primary-text-color,#000);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:600 12px var(--font-regular,system-ui,sans-serif);cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.tz-tabbar-btn.on{background:color-mix(in srgb,var(--primary-color,#3390ec) 16%,transparent);color:var(--primary-color,#3390ec)}
.tz-tabbar-ic{position:relative;display:grid;place-items:center;width:28px;height:26px}
.tz-tabbar-ic .avatar{width:26px!important;height:26px!important;--size:26px;font-size:11px}
.tz-tabbar-badge{position:absolute;top:-6px;inset-inline-start:14px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--primary-color,#3390ec);color:#fff;font-size:11px;line-height:18px;text-align:center;box-sizing:border-box}
.tz-tabbar-badge[hidden]{display:none}
.tz-mp{position:absolute;inset:0;z-index:4;overflow-y:auto;background:var(--background-color,#f4f4f5);padding-bottom:96px;color:var(--primary-text-color,#000)}
.tz-mp-cover{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 12px 14px;color:#fff;position:relative}
.tz-mp-top{display:flex;justify-content:space-between;align-self:stretch}
.tz-mp-round{width:44px;height:44px;border-radius:50%;border:0;display:grid;place-items:center;background:rgba(0,0,0,.18);color:inherit;cursor:pointer}
.tz-mp-design .tz-mp-round{background:var(--surface-color,#fff);color:var(--primary-text-color,#000)}
.tz-mp-cover .avatar{width:110px!important;height:110px!important;--size:110px;font-size:40px;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.tz-mp-name{font-size:24px;font-weight:700;margin-top:8px;text-shadow:0 1px 3px rgba(0,0,0,.25);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tz-mp-status{opacity:.8;font-size:14px}
.tz-mp-acts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-self:stretch;margin-top:12px}
.tz-mp-act{border:0;border-radius:16px;padding:10px 4px;background:rgba(0,0,0,.18);color:#fff;display:flex;flex-direction:column;align-items:center;gap:4px;font:600 12.5px var(--font-regular,system-ui,sans-serif);cursor:pointer}
.tz-mp-card{display:block;width:calc(100% - 24px);box-sizing:border-box;margin:12px;border:0;text-align:start;background:var(--surface-color,#fff);color:inherit;border-radius:18px;padding:6px 16px;font:inherit}
.tz-mp-chan{padding:12px 16px;cursor:pointer}
.tz-mp-line{padding:10px 0;border-bottom:1px solid var(--border-color,rgba(127,127,127,.15))}
.tz-mp-line:last-child{border-bottom:0}
.tz-mp-val{font-size:16px;white-space:pre-wrap;word-break:break-word}
.tz-mp-lab{font-size:13px;color:var(--secondary-text-color,#707579);margin-top:2px}
.tz-mp-chan .tz-mp-lab{color:var(--primary-color);margin:0 0 4px}
.tz-mp-menu{position:absolute;top:58px;inset-inline-end:12px;z-index:3;background:var(--surface-color,#fff);color:var(--primary-text-color,#000);border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,.25);padding:6px;min-width:240px}
.tz-mp-menu button,.tz-acc button{display:flex;align-items:center;gap:14px;width:100%;border:0;background:none;color:inherit;padding:11px 12px;border-radius:10px;font:500 15px var(--font-regular,system-ui,sans-serif);cursor:pointer;text-align:start}
.tz-mp-menu button:active,.tz-acc button:active{background:rgba(127,127,127,.15)}
.tz-mp-design{position:absolute;inset:0;z-index:5;overflow-y:auto;background:var(--background-color,#f4f4f5);padding:10px 12px 20px}
.tz-mp-design .tz-design-reset{border:0;border-radius:14px;height:46px;background:var(--surface-color,#fff);color:var(--danger-color,#df3f40);font:600 15px var(--font-regular,system-ui,sans-serif);cursor:pointer}
.tz-mp-design .tz-design-apply{border:0;border-radius:16px;height:50px;background:var(--primary-color,#3390ec);color:#fff;font:700 15px var(--font-regular,system-ui,sans-serif);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}
.tz-mp-design .tz-design-apply:disabled{opacity:.55}
.tz-mp-design .tz-sec{background:var(--surface-color,#fff);border-radius:18px;padding:14px;margin-top:10px}
.tz-acc{position:fixed;z-index:1001;background:var(--surface-color,#fff);color:var(--primary-text-color,#000);border-radius:18px;box-shadow:0 8px 28px rgba(0,0,0,.3);padding:6px;min-width:230px;max-width:calc(100vw - 16px)}
.tz-acc-add{border-bottom:1px solid var(--border-color,rgba(127,127,127,.2))!important;border-radius:10px 10px 0 0!important}
.tz-acc .avatar{width:40px!important;height:40px!important;--size:40px;font-size:15px}
.tz-acc-item.on .avatar{box-shadow:0 0 0 2px var(--surface-color,#fff),0 0 0 4px var(--primary-color)}
.tz-mp-avph{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--primary-color);color:#fff}
.tz-an-demo{display:flex;gap:8px;align-items:flex-end;padding:10px 0}
.tz-an-demo .bubble-content-wrapper{background:var(--message-background-color,var(--surface-color,#fff));border:1px solid var(--border-color,rgba(127,127,127,.25));border-radius:14px 14px 14px 4px;padding:8px 12px}
.video-recording-stage--playing .tz-flip{display:none}
.tz-backcam .video-recording-preview{transform:none!important}
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
