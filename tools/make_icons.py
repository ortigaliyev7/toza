"""Toza belgisini chizadi va barcha ikonka fayllarini (favicon, PWA, bildirishnoma, SVG) yaratadi.
Ishlatish: python3 tools/make_icons.py   (natija: overlay/public/assets/img/, build.sh uni tweb ustiga ko'chiradi)
Belgi: yumshoq to'rtburchak (teal→zumrad), oq «T» va tozalik uchqunchasi. Telegram belgisiga o'xshamaydi."""
import os, io
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'overlay', 'public', 'assets', 'img')
C1, C2 = (45, 212, 191), (5, 150, 105)          # gradient: yuqori-chap → past-o'ng
S = 4                                           # supersampling

def qbez(p0, p1, p2, n=14):
    return [((1-t)**2*p0[0]+2*(1-t)*t*p1[0]+t*t*p2[0], (1-t)**2*p0[1]+2*(1-t)*t*p1[1]+t*t*p2[1]) for t in [i/n for i in range(n+1)]]

def sparkle(cx, cy, r, pinch=0.0):
    pts = []
    tips = [(cx, cy-r), (cx+r, cy), (cx, cy+r), (cx-r, cy)]
    for i in range(4):
        a, b = tips[i], tips[(i+1) % 4]
        ctrl = (cx + (a[0]+b[0]-2*cx)*pinch/2, cy + (a[1]+b[1]-2*cy)*pinch/2) if pinch else (cx, cy)
        pts += qbez(a, ctrl, b)[:-1]
    return pts

# 160x160 koordinatalar
T_BAR = (34, 50, 108, 68)
T_STEM = (62, 68, 80, 120)
SP = (124, 38, 15)

def draw_mark(d, k, ox, oy, fill):
    """T va uchqun (oq/belgilangan rang) — k: masshtab, (ox,oy): siljish"""
    f = lambda x, y: (ox + x*k, oy + y*k)
    for (x0, y0, x1, y1) in (T_BAR, T_STEM):
        d.rounded_rectangle([*f(x0, y0), *f(x1, y1)], radius=3*k, fill=fill)
    cx, cy, r = SP
    d.polygon([f(*p) for p in sparkle(cx, cy, r, 0.2)], fill=fill)

def gradient(size):
    g = Image.new('RGB', (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2*size - 2)
            px[x, y] = tuple(int(C1[i] + (C2[i]-C1[i])*t) for i in range(3))
    return g

def logo(size, pad=0.0, radius=0.29, bg=True, mono=None, bleed=False):
    """size px; pad: chetdan bo'sh joy ulushi; radius: yumaloqlik; bleed: to'liq kvadrat; mono: bitta rang (siluet)"""
    W = size*S
    inner = W*(1-2*pad)
    off = (W-inner)/2
    k = inner/160
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    if mono:
        d = ImageDraw.Draw(img)
        draw_mark(d, k, off, off, mono)
    else:
        mask = Image.new('L', (W, W), 0)
        md = ImageDraw.Draw(mask)
        if bleed: md.rectangle([0, 0, W, W], fill=255)
        else: md.rounded_rectangle([off, off, off+inner, off+inner], radius=inner*radius, fill=255)
        base = gradient(W).convert('RGBA'); base.putalpha(mask)
        img = Image.alpha_composite(img, base)
        d = ImageDraw.Draw(img)
        draw_mark(d, k, off, off, (255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)

def save(name, im):
    im.save(os.path.join(OUT, name), optimize=True)

# PWA / android
for n in (36, 48, 72, 96, 144, 192, 256, 384, 512):
    save(f'android-chrome-{n}x{n}.png', logo(n, pad=0.0))
# iOS: to'liq kvadrat (iOS o'zi yumaloqlaydi)
for name in ('apple-touch-icon.png', 'apple-touch-icon-precomposed.png'):
    save(name, logo(180, bleed=True))
for n in (16, 32, 194):
    save(f'favicon-{n}x{n}.png', logo(n, pad=0.0))
for n in (192, 384, 512):
    save(f'icon_square_{n}.png', logo(n, bleed=True))
save('logo_512.png', logo(512)); save('logo_filled_rounded.png', logo(512, pad=0.0))
# favicon.ico (16/32/48) va o'qilmagan belgisi bilan
ico = logo(48)
ico.save(os.path.join(OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
u = logo(32); ud = ImageDraw.Draw(u); ud.ellipse([19, 1, 31, 13], fill=(239, 68, 68, 255), outline=(255, 255, 255, 255), width=2)
u.save(os.path.join(OUT, 'favicon_unread.ico'), sizes=[(32, 32)])
# Windows plitkalar: oq siluet (LA)
for name, (w, h) in {'mstile-70x70.png': (128, 128), 'mstile-144x144.png': (144, 144), 'mstile-150x150.png': (270, 270), 'mstile-310x310.png': (558, 558), 'mstile-310x150.png': (558, 270)}.items():
    s = min(w, h)
    m = logo(s, pad=0.18, mono=(255, 255, 255, 255))
    canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0)); canvas.paste(m, ((w-s)//2, (h-s)//2), m)
    canvas.convert('LA').save(os.path.join(OUT, name), optimize=True)

# SVG variantlar
SPK = ' '.join(('M' if i == 0 else 'L') + f'{x:.2f},{y:.2f}' for i, (x, y) in enumerate(sparkle(*SP, 0.2))) + 'Z'
def mark_path():
    return f'M{T_BAR[0]},{T_BAR[1]}H{T_BAR[2]}V{T_BAR[3]}H{T_STEM[2]}V{T_STEM[3]}H{T_STEM[0]}V{T_BAR[3]}H{T_BAR[0]}Z {SPK}'
MARK = mark_path()
RR = 'M46,0H114A46,46 0 0 1 160,46V114A46,46 0 0 1 114,160H46A46,46 0 0 1 0,114V46A46,46 0 0 1 46,0Z'
GRAD = '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#059669"/></linearGradient></defs>'
def w(name, txt): open(os.path.join(OUT, name), 'w').write(txt)
w('logo.svg', f'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">{GRAD}<path fill="url(#g)" d="{RR}"/><path fill="#fff" d="{MARK}"/></svg>\n')
w('logo_filled.svg', f'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">{GRAD}<path fill="url(#g)" d="{RR}"/><path fill="#fff" d="{MARK}"/></svg>\n')
w('logo_padded.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">{GRAD}<path fill="url(#g)" d="{RR}"/><path fill="#fff" d="{MARK}"/></svg>\n')
w('logo_plain.svg', f'<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 160 160"><path fill="#fff" d="{MARK}"/></svg>\n')
w('safari-pinned-tab.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><path d="{MARK}"/></svg>\n')
print('tayyor:', len(os.listdir(OUT)), 'fayl')
