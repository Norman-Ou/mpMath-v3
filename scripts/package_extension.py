"""Build a loadable extension ZIP with manifest.json at the archive root."""

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main():
    root = Path(__file__).resolve().parents[1]
    extension = root / "mpMath"
    manifest = json.loads((extension / "manifest.json").read_text())
    destination = root / "dist" / f"mpMath-v3-{manifest['version']}.zip"
    destination.parent.mkdir(exist_ok=True)

    with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
        for source in sorted(extension.rglob("*")):
            relative = source.relative_to(extension)
            if source.is_file() and not any(part.startswith(".") for part in relative.parts):
                archive.write(source, relative.as_posix())
        for name in ("LICENSE", "README.md", "CHANGELOG.md"):
            archive.write(root / name, name)

    with ZipFile(destination) as archive:
        assert archive.testzip() is None, "Corrupted ZIP entry"
        assert json.loads(archive.read("manifest.json")) == manifest
        resources = [manifest["background"]["service_worker"], *manifest["icons"].values()]
        for script in manifest["content_scripts"]:
            resources.extend(script.get("js", []) + script.get("css", []))
        for rule in manifest["web_accessible_resources"]:
            resources.extend(rule["resources"])
        for resource in resources:
            assert resource in archive.namelist(), f"Missing extension resource: {resource}"

    print(destination)


if __name__ == "__main__":
    main()
