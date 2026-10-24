# sheet.png(2×2) 를 잘라 art/frame-1.png ~ frame-4.png 4장을 만든다.
# 순서: 1 왼쪽 위, 2 오른쪽 위, 3 왼쪽 아래, 4 오른쪽 아래
from pathlib import Path

from PIL import Image

ART = Path(__file__).parent / "art"
FAINT = 16  # 이 값 이하로 흐린 점은 지운다 (가장자리 얼룩)
PAD = 4     # 햄스터 둘레 여백

sheet = Image.open(ART / "sheet.png").convert("RGBA")
half_w, half_h = sheet.width // 2, sheet.height // 2

# 1) 4칸으로 자르고, 흐린 점을 지우고, 햄스터만 남게 다듬는다.
pets = []
for row in range(2):
    for col in range(2):
        cell = sheet.crop((col * half_w, row * half_h, (col + 1) * half_w, (row + 1) * half_h))
        alpha = cell.getchannel("A").point(lambda v: 0 if v <= FAINT else v)
        cell.putalpha(alpha)
        pets.append(cell.crop(alpha.getbbox()))

# 2) 4장을 같은 크기 바탕에 아래쪽 가운데를 맞춰 놓는다. (그림이 바뀔 때 들썩이지 않게)
size_w = max(p.width for p in pets) + PAD * 2
size_h = max(p.height for p in pets) + PAD * 2
for i, pet in enumerate(pets, start=1):
    frame = Image.new("RGBA", (size_w, size_h), (0, 0, 0, 0))
    frame.paste(pet, ((size_w - pet.width) // 2, size_h - PAD - pet.height))
    frame.save(ART / f"frame-{i}.png")
    print(f"frame-{i}.png  {size_w}×{size_h}")
