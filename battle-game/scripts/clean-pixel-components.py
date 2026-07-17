from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def connected_components(alpha: Image.Image) -> list[list[int]]:
    width, height = alpha.size
    opaque = alpha.point(lambda value: 1 if value else 0).tobytes()
    visited = bytearray(width * height)
    components: list[list[int]] = []

    for start, value in enumerate(opaque):
        if not value or visited[start]:
            continue
        visited[start] = 1
        queue = deque([start])
        component: list[int] = []
        while queue:
            current = queue.popleft()
            component.append(current)
            x = current % width
            y = current // width
            for offset_y in (-1, 0, 1):
                neighbor_y = y + offset_y
                if neighbor_y < 0 or neighbor_y >= height:
                    continue
                for offset_x in (-1, 0, 1):
                    if offset_x == 0 and offset_y == 0:
                        continue
                    neighbor_x = x + offset_x
                    if neighbor_x < 0 or neighbor_x >= width:
                        continue
                    neighbor = neighbor_y * width + neighbor_x
                    if opaque[neighbor] and not visited[neighbor]:
                        visited[neighbor] = 1
                        queue.append(neighbor)
        components.append(component)

    return sorted(components, key=len, reverse=True)


def clean(path: Path, dry_run: bool) -> None:
    image = Image.open(path).convert("RGBA")
    components = connected_components(image.getchannel("A"))
    sizes = [len(component) for component in components]
    print(f"{path.relative_to(ROOT)} components={sizes[:8]}")
    if dry_run or len(components) <= 1:
        return

    width, height = image.size
    alpha_data = bytearray(image.getchannel("A").tobytes())
    for component in components[1:]:
        for index in component:
            alpha_data[index] = 0
    alpha = Image.frombytes("L", (width, height), bytes(alpha_data))
    image.putalpha(alpha)
    image.save(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove disconnected alpha fragments from Wordfront pixel sprites.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    paths = sorted((ROOT / "assets" / "player").glob("mage-cast-*.png"))
    paths = [path for path in paths if path.name != "mage-cast-sheet.png"]
    for path in paths:
        clean(path, args.dry_run)


if __name__ == "__main__":
    main()
