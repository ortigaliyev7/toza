"""Toza ikonka fayllarini tools/brand/ dagi logotipdan yaratadi.
Ishlatish: python3 tools/make_icons.py   (natija: overlay/public/assets/img/; build.sh uni tweb ustiga ko'chiradi)
Manba: tools/brand/toza-wordmark.png (yozuv), tools/brand/toza-t.png (kvadrat ikonka uchun «T»), ikkalasi shaffof fonli."""
import os, io, base64
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'overlay', 'public', 'assets', 'img')
T = Image.open(os.path.join(HERE, 'brand', 'toza-t.png')).convert('RGBA')
S = 4

def logo(size, pad=0.0, radius=0.24, bleed=False, mono=None, fill=0.62):
    """Oq yumaloq kvadrat (yoki to'liq kvadrat) ichida «T». mono: faqat siluet (Windows plitkalari)."""
    W = size*S
    inner = W*(1-2*pad); off = (W-inner)/2
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    if not mono:
        m = Image.new('L', (W, W), 0); d = ImageDraw.Draw(m)
        if bleed: d.rectangle([0, 0, W, W], fill=255)
        else: d.rounded_rectangle([off, off, off+inner, off+inner], radius=inner*radius, fill=255)
        bg = Image.new('RGBA', (W, W), (255, 255, 255, 255)); bg.putalpha(m)
        img = Image.alpha_composite(img, bg)
        # ingichka chegara: oq sahifada ikonka yo'qolmasin
        if not bleed:
            ring = Image.new('L', (W, W), 0); rd = ImageDraw.Draw(ring)
            rd.rounded_rectangle([off, off, off+inner, off+inner], radius=inner*radius, outline=255, width=max(1, int(W*0.012)))
            edge = Image.new('RGBA', (W, W), (200, 214, 232, 255)); edge.putalpha(ring)
            img = Image.alpha_composite(img, edge)
    tw = inner*fill; th = tw*T.height/T.width
    if th > inner*fill: th = inner*fill; tw = th*T.width/T.height
    t = T.resize((max(1, int(tw)), max(1, int(th))), Image.LANCZOS)
    if mono:
        t = Image.merge('RGBA', (*Image.new('RGB', t.size, mono[:3]).split(), t.getchannel('A')))
    img.alpha_composite(t, (int(off+(inner-t.width)/2), int(off+(inner-t.height)/2)))
    return img.resize((size, size), Image.LANCZOS)

def save(name, im): im.save(os.path.join(OUT, name), optimize=True)

for n in (36, 48, 72, 96, 144, 192, 256, 384, 512): save(f'android-chrome-{n}x{n}.png', logo(n))
for name in ('apple-touch-icon.png', 'apple-touch-icon-precomposed.png'): save(name, logo(180, bleed=True))
for n in (16, 32, 194): save(f'favicon-{n}x{n}.png', logo(n, fill=0.7))
for n in (192, 384, 512): save(f'icon_square_{n}.png', logo(n, bleed=True))
save('logo_512.png', logo(512)); save('logo_filled_rounded.png', logo(512))
logo(48, fill=0.7).save(os.path.join(OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
u = logo(32, fill=0.7); ImageDraw.Draw(u).ellipse([19, 1, 31, 13], fill=(239, 68, 68, 255), outline=(255, 255, 255, 255), width=2)
u.save(os.path.join(OUT, 'favicon_unread.ico'), sizes=[(32, 32)])
for name, (w, h) in {'mstile-70x70.png': (128, 128), 'mstile-144x144.png': (144, 144), 'mstile-150x150.png': (270, 270), 'mstile-310x310.png': (558, 558), 'mstile-310x150.png': (558, 270)}.items():
    s = min(w, h); m = logo(s, pad=0.12, mono=(255, 255, 255))
    c = Image.new('RGBA', (w, h), (0, 0, 0, 0)); c.paste(m, ((w-s)//2, (h-s)//2), m); c.convert('LA').save(os.path.join(OUT, name), optimize=True)

# yozuvli logotip (kirish sahifasi uchun) — kichraytirilgan, shaffof
wm = Image.open(os.path.join(HERE, 'brand', 'toza-wordmark.png')).convert('RGBA')
wm.thumbnail((900, 900), Image.LANCZOS); save('toza-wordmark.png', wm)

# SVG'lar: rasmni ichiga joylaymiz (QR markazi va boshqalar uchun); bir rangli variantlar oddiy «T» shakli
b64 = base64.b64encode(open(os.path.join(OUT, 'logo_512.png'), 'rb').read()).decode()
img_svg = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="160" height="160" viewBox="0 0 160 160"><image width="160" height="160" xlink:href="data:image/png;base64,{b64}"/></svg>\n'
for n in ('logo.svg', 'logo_filled.svg', 'logo_padded.svg'): open(os.path.join(OUT, n), 'w').write(img_svg)
TP = 'M34,50H126V70H80V120H62V70H34Z'
open(os.path.join(OUT, 'logo_plain.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 160 160"><path fill="#fff" d="{TP}"/></svg>\n')
open(os.path.join(OUT, 'safari-pinned-tab.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><path d="{TP}"/></svg>\n')
print('tayyor')
