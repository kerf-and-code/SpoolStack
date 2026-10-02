#!/usr/bin/env python3
"""
SpoolStack slicer uploader.

Runs after every slice as a post-processing script in PrusaSlicer,
OrcaSlicer or Bambu Studio. It reads the settings part of the gcode the
slicer just wrote and sends it to SpoolStack, where it waits in the
"Did it print?" inbox. One tap there logs the run.

What it sends: the comment lines from the start and end of the file (print
time, filament used, every slicer setting) and the file's name. Not the
moves, not the model. It never changes the gcode, and it never makes the
slice fail: if SpoolStack cannot be reached, the upload is queued and sent
after the next slice.

Set up once, with the token from SpoolStack (Settings, Slicer uploader):

    python spoolstack_upload.py --setup ssk_your_token_here
    python spoolstack_upload.py --check

Then add this line to the slicer's post-processing scripts, using the full
path to Python and to this file:

    "C:\\Path\\To\\python.exe" "C:\\Path\\To\\spoolstack_upload.py"

The token is kept in a config file in your home folder (.spoolstack), not in
the slicer settings: the slicer writes its post-processing line into every
gcode file, and a token there would travel with every file you share.

Needs Python 3.8 or newer. Standard library only, nothing to install.
"""

import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

VERSION = "1.0.0"
DEFAULT_ENDPOINT = "https://spool-stack.com/api/ingest"

HOME = Path(os.environ.get("SPOOLSTACK_HOME") or (Path.home() / ".spoolstack"))
CONFIG_PATH = HOME / "config.json"
QUEUE_DIR = HOME / "queue"
LOG_PATH = HOME / "upload.log"

HEAD_BYTES = 2 * 1024 * 1024
TAIL_BYTES = 4 * 1024 * 1024
QUEUE_MAX_AGE_DAYS = 14
QUEUE_MAX_FILES = 50
TIMEOUT_SECONDS = 15

TOKEN_RE = re.compile(r"^ssk_[A-Za-z0-9_-]{40,64}$")
# Comment lines hold every slicer's metadata; M104/M109/M140/M190 are Cura's
# only record of temperatures. Same rule as the app's own import.
KEEP_RE = re.compile(r"^\s*(;|M1(04|09|40|90)\b)", re.IGNORECASE)


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------

def log(message):
    try:
        HOME.mkdir(parents=True, exist_ok=True)
        stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"{stamp}  {message}\n")
        # Keep the log short: the last 500 lines are plenty to debug with.
        if LOG_PATH.stat().st_size > 200_000:
            lines = LOG_PATH.read_text(encoding="utf-8", errors="replace").splitlines()[-500:]
            LOG_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except OSError:
        pass


def say(message):
    """Print for the slicer's output window and keep a copy in the log."""
    print(f"SpoolStack: {message}")
    log(message)


def load_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except (OSError, ValueError):
        return None
    if not isinstance(cfg, dict) or not TOKEN_RE.match(str(cfg.get("token", ""))):
        return None
    cfg.setdefault("endpoint", DEFAULT_ENDPOINT)
    return cfg


def save_config(cfg):
    HOME.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    try:
        os.chmod(CONFIG_PATH, 0o600)  # owner only, where the OS supports it
    except OSError:
        pass


# --------------------------------------------------------------------------
# reading the gcode
# --------------------------------------------------------------------------

def read_settings_text(path):
    """Comment and temperature lines from the first 2 MB and last 4 MB."""
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        if size <= HEAD_BYTES + TAIL_BYTES:
            data = f.read()
            text = data.decode("utf-8", errors="replace")
        else:
            head = f.read(HEAD_BYTES).decode("utf-8", errors="replace")
            f.seek(size - TAIL_BYTES)
            tail = f.read(TAIL_BYTES).decode("utf-8", errors="replace")
            # Drop the partial line at each cut.
            text = head[: head.rfind("\n") + 1] + tail[tail.find("\n") + 1 :]
    kept = [line.strip() for line in text.splitlines() if KEEP_RE.match(line)]
    return "\n".join(kept)


def is_binary_gcode(path):
    with open(path, "rb") as f:
        return f.read(4) == b"GCDE"


def output_name(path):
    """
    The name the file is being saved under. The slicer usually hands the
    script a temporary file; PrusaSlicer and OrcaSlicer put the real name in
    SLIC3R_PP_OUTPUT_NAME.
    """
    real = os.environ.get("SLIC3R_PP_OUTPUT_NAME")
    name = real or path
    return re.split(r"[\\/]", name)[-1]


# --------------------------------------------------------------------------
# talking to SpoolStack
# --------------------------------------------------------------------------

class Permanent(Exception):
    """SpoolStack refused the upload. Retrying the same upload will not help."""


class Retryable(Exception):
    """Network trouble or a server problem. Queue it and try again later."""


def request(cfg, method, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        cfg["endpoint"],
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {cfg['token']}",
            "Content-Type": "application/json",
            "User-Agent": f"spoolstack-uploader/{VERSION}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read().decode("utf-8", errors="replace")).get("error", "")
        except Exception:
            detail = ""
        if e.code == 429 or e.code >= 500:
            raise Retryable(f"HTTP {e.code} {detail}".strip())
        raise Permanent(f"HTTP {e.code} {detail}".strip())
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise Retryable(str(getattr(e, "reason", e)))


def queue_upload(payload):
    try:
        QUEUE_DIR.mkdir(parents=True, exist_ok=True)
        name = f"{int(time.time() * 1000)}.json"
        with open(QUEUE_DIR / name, "w", encoding="utf-8") as f:
            json.dump(payload, f)
        # Never let the queue grow without bound.
        files = sorted(QUEUE_DIR.glob("*.json"))
        for old in files[:-QUEUE_MAX_FILES]:
            old.unlink(missing_ok=True)
    except OSError as e:
        log(f"could not queue upload: {e}")


def flush_queue(cfg):
    """Send uploads that failed earlier. Stops at the first network failure."""
    if not QUEUE_DIR.exists():
        return
    cutoff = time.time() - QUEUE_MAX_AGE_DAYS * 86400
    for item in sorted(QUEUE_DIR.glob("*.json")):
        try:
            if item.stat().st_mtime < cutoff:
                item.unlink(missing_ok=True)
                log(f"dropped queued upload older than {QUEUE_MAX_AGE_DAYS} days: {item.name}")
                continue
            payload = json.loads(item.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            item.unlink(missing_ok=True)
            continue
        try:
            request(cfg, "POST", payload)
            item.unlink(missing_ok=True)
            say(f"sent a queued upload: {payload.get('file_name', '?')}")
        except Permanent as e:
            item.unlink(missing_ok=True)
            say(f"a queued upload was refused and dropped ({payload.get('file_name', '?')}): {e}")
        except Retryable:
            return


# --------------------------------------------------------------------------
# commands
# --------------------------------------------------------------------------

def cmd_setup(args):
    if not args or not TOKEN_RE.match(args[0]):
        print("Usage: spoolstack_upload.py --setup ssk_your_token_here [--endpoint URL]")
        print("Create a token in SpoolStack: Settings, Slicer uploader.")
        return 2
    cfg = {"token": args[0], "endpoint": DEFAULT_ENDPOINT}
    if "--endpoint" in args:
        i = args.index("--endpoint")
        if i + 1 < len(args):
            cfg["endpoint"] = args[i + 1]
    save_config(cfg)
    print(f"Saved to {CONFIG_PATH}")
    return cmd_check()


def cmd_check():
    cfg = load_config()
    if not cfg:
        print("No token set up yet. Run: spoolstack_upload.py --setup ssk_your_token_here")
        return 2
    try:
        result = request(cfg, "GET")
        print(f"Connected. This PC uploads as \"{result.get('name', '?')}\".")
        print("Now add this script to your slicer's post-processing scripts.")
        return 0
    except Permanent as e:
        print(f"SpoolStack refused the token: {e}")
        return 1
    except Retryable as e:
        print(f"Could not reach SpoolStack: {e}")
        return 1


def cmd_upload(path):
    """Called by the slicer. Always returns 0 so a problem here never stops a slice."""
    log(f"run {VERSION}: path={path!r} output_name={os.environ.get('SLIC3R_PP_OUTPUT_NAME')!r}")
    cfg = load_config()
    if not cfg:
        say("not set up, nothing sent. Run spoolstack_upload.py --setup with your token.")
        return 0
    if not path or not os.path.isfile(path):
        say(f"no gcode file at {path!r}, nothing sent.")
        return 0
    if is_binary_gcode(path):
        say("this is binary gcode (.bgcode), which SpoolStack cannot read yet. Turn off binary G-code to log it.")
        return 0

    text = read_settings_text(path)
    if not text.strip():
        say("no slicer settings found in this file, nothing sent.")
        return 0
    payload = {
        "file_name": output_name(path),
        "text": text,
        "client": f"spoolstack-uploader/{VERSION}",
    }
    try:
        request(cfg, "POST", payload)
        say(f"sent {payload['file_name']}. It is waiting under \"Did it print?\" in SpoolStack.")
    except Permanent as e:
        say(f"upload refused, not retried: {e}")
        return 0
    except Retryable as e:
        queue_upload(payload)
        say(f"SpoolStack did not take the upload this time ({e}). Queued; it will be sent after your next slice.")
        return 0

    flush_queue(cfg)
    return 0


def main(argv):
    if len(argv) >= 2 and argv[1] == "--setup":
        return cmd_setup(argv[2:])
    if len(argv) >= 2 and argv[1] == "--check":
        return cmd_check()
    if len(argv) >= 2 and argv[1] in ("--help", "-h", "--version"):
        print(__doc__ if argv[1] != "--version" else VERSION)
        return 0
    # Slicers pass the gcode path as the last argument.
    path = argv[-1] if len(argv) >= 2 else None
    try:
        return cmd_upload(path)
    except Exception as e:  # never break a slice
        log(f"unexpected error: {e!r}")
        return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
