"""Package only extension distribution files, without external dependencies."""
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

source, output = map(Path, sys.argv[1:])
with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
    for entry in sorted(source.rglob("*")):
        if entry.is_file():
            archive.write(entry, entry.relative_to(source).as_posix())
