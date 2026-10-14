"""Tekent de app-iconen van Functiefoto: een grafiek met assen op een wit vlak.

Gebruik: python gereedschap/maak_iconen.py   (vanuit de projectmap)
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

DOEL = Path(__file__).resolve().parent.parent / "iconen"
GROOTTE = 1024
ACHTERGROND = (251, 250, 246)
RASTER = (226, 229, 233)
AS = (59, 64, 72)
CURVE = (28, 100, 200)
TERRACOTTA = (168, 75, 36)


def functie(x):
    return (2 * x**3 - 3 * x + 1) / (x**2 + 1)


def teken_icoon():
    beeld = Image.new("RGB", (GROOTTE, GROOTTE), ACHTERGROND)
    pen = ImageDraw.Draw(beeld)
    marge = 150
    x0, x1, y0, y1 = -3.0, 3.0, -4.0, 4.0

    def px(x):
        return marge + (x - x0) / (x1 - x0) * (GROOTTE - 2 * marge)

    def py(y):
        return marge + (y1 - y) / (y1 - y0) * (GROOTTE - 2 * marge)

    for k in range(-3, 4):
        pen.line([(px(k), marge), (px(k), GROOTTE - marge)], fill=RASTER, width=6)
    for k in range(-4, 5, 2):
        pen.line([(marge, py(k)), (GROOTTE - marge, py(k))], fill=RASTER, width=6)
    pen.line([(marge, py(0)), (GROOTTE - marge, py(0))], fill=AS, width=14)
    pen.line([(px(0), marge), (px(0), GROOTTE - marge)], fill=AS, width=14)
    pen.line([(px(x0), py(2 * x0)), (px(x1), py(2 * x1))], fill=TERRACOTTA, width=12)

    punten = [(px(x), py(functie(x))) for x in [x0 + i * (x1 - x0) / 400 for i in range(401)]]
    pen.line(punten, fill=CURVE, width=34, joint="curve")
    for nulpunt in [(-1 - math.sqrt(3)) / 2, (-1 + math.sqrt(3)) / 2, 1]:
        cx, cy = px(nulpunt), py(0)
        pen.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=CURVE, outline=ACHTERGROND, width=10)
    return beeld


def main():
    DOEL.mkdir(exist_ok=True)
    icoon = teken_icoon()
    for naam, maat in [("icoon-512.png", 512), ("icoon-192.png", 192), ("apple-touch-icon.png", 180)]:
        icoon.resize((maat, maat), Image.LANCZOS).save(DOEL / naam)
        print(f"{naam} ({maat}x{maat})")


if __name__ == "__main__":
    main()
