from pathlib import Path
import subprocess
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT.parent / "tmp" / "imagegen"
PLAYER_DIR = ROOT / "assets" / "player"

CANVAS_SIZE = 1024
BASELINE_Y = 922
ALPHA_THRESHOLD = 80


def hard_alpha(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A").point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0)
    image.putalpha(alpha)
    return image


def limited_palette(image: Image.Image, colors: int = 32) -> Image.Image:
    image = hard_alpha(image)
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    quantized = rgb.quantize(
        colors=colors,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    ).convert("RGB")
    output = quantized.convert("RGBA")
    output.putalpha(alpha)
    return output


def subject_crop(image: Image.Image) -> Image.Image:
    image = hard_alpha(image)
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("Generated asset does not contain an opaque subject.")
    return image.crop(bounds)


def place_subject(subject: Image.Image, scale: float, baseline: int = BASELINE_Y) -> Image.Image:
    width = max(1, round(subject.width * scale))
    height = max(1, round(subject.height * scale))
    subject = subject.resize((width, height), Image.Resampling.NEAREST)
    subject = limited_palette(subject)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    x = (CANVAS_SIZE - width) // 2
    y = baseline - height
    canvas.alpha_composite(subject, (x, y))
    return canvas


def process_enemy(source_name: str, destination: Path, max_width: int = 850, max_height: int = 850) -> None:
    subject = subject_crop(Image.open(TMP / source_name))
    scale = min(max_width / subject.width, max_height / subject.height)
    place_subject(subject, scale).save(destination)


def process_player_frames() -> None:
    sheet = hard_alpha(Image.open(TMP / "mage-cast-sheet-alpha.png"))
    sheet.save(PLAYER_DIR / "mage-cast-sheet.png")
    cell_width = sheet.width // 3
    cell_height = sheet.height // 2
    subjects: list[Image.Image] = []
    for row in range(2):
        for column in range(3):
            left = column * cell_width
            top = row * cell_height
            right = sheet.width if column == 2 else (column + 1) * cell_width
            bottom = sheet.height if row == 1 else (row + 1) * cell_height
            subjects.append(subject_crop(sheet.crop((left, top, right, bottom))))

    widest = max(subject.width for subject in subjects)
    tallest = max(subject.height for subject in subjects)
    common_scale = min(790 / widest, 850 / tallest)
    frames = [place_subject(subject, common_scale) for subject in subjects]
    for index, frame in enumerate(frames, start=1):
        frame.save(PLAYER_DIR / f"mage-cast-{index:02d}.png")
    frames[0].save(PLAYER_DIR / "mage-base.png")


def validate(paths: list[Path]) -> None:
    for path in paths:
        image = Image.open(path).convert("RGBA")
        if image.size != (CANVAS_SIZE, CANVAS_SIZE):
            raise ValueError(f"Unexpected canvas size for {path}: {image.size}")
        corners = [image.getpixel((0, 0))[3], image.getpixel((CANVAS_SIZE - 1, 0))[3],
                   image.getpixel((0, CANVAS_SIZE - 1))[3], image.getpixel((CANVAS_SIZE - 1, CANVAS_SIZE - 1))[3]]
        if any(corners):
            raise ValueError(f"Non-transparent corner detected in {path}.")


def main() -> None:
    process_player_frames()
    process_enemy("normal-alpha.png", ROOT / "assets" / "enemies" / "normal" / "normal-base.png")
    process_enemy("strong-alpha.png", ROOT / "assets" / "enemies" / "strong" / "strong-base.png")
    process_enemy("boss-alpha.png", ROOT / "assets" / "enemies" / "boss" / "boss-base.png")
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "clean-pixel-components.py")],
        check=True,
    )
    outputs = [
        PLAYER_DIR / "mage-base.png",
        *(PLAYER_DIR / f"mage-cast-{index:02d}.png" for index in range(1, 7)),
        ROOT / "assets" / "enemies" / "normal" / "normal-base.png",
        ROOT / "assets" / "enemies" / "strong" / "strong-base.png",
        ROOT / "assets" / "enemies" / "boss" / "boss-base.png",
    ]
    validate(outputs)
    for path in outputs:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
