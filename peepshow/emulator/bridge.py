"""PoC transport and measurements; production semantics remain in the service."""
import base64
import io
import json
from pathlib import Path, PurePosixPath
import time
import uuid
import zipfile
from peepshow_authoring import service as service_module
from peepshow_authoring.protocol import parse_request, success_response, error_response, ProtocolError
from scenarios import qualify

COUNTS = {'egg': 0, 'preview': 0}
for _name, _counter in [('build_egg', 'egg'), ('build_preview_package', 'preview')]:
    def measured(*args, _original=getattr(service_module, _name), _key=_counter, **kwargs):
        COUNTS[_key] += 1
        return _original(*args, **kwargs)
    setattr(service_module, _name, measured)
SERVICE = service_module.AuthoringService()


def dispatch(message):
    started = time.perf_counter()
    before = dict(COUNTS)
    request = None
    try:
        request = parse_request(message)
        response = success_response(request.request_id, SERVICE.handle(request))
    except ProtocolError as exc:
        response = error_response(exc)
    except (KeyError, OSError, TypeError, ValueError) as exc:
        response = error_response(ProtocolError('SERVICE_OPERATION_FAILED', str(exc),
                                  request_id=request.request_id if request else None))
    return json.dumps({'response': response, 'measurement': {
        'python_ms': (time.perf_counter() - started) * 1000,
        'build_calls': {key: COUNTS[key] - before[key] for key in COUNTS},
        'total_build_calls': dict(COUNTS)}})


def import_project(encoded):
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) > 64 * 1024 * 1024:
        raise ValueError('Archive exceeds PoC 64 MiB limit')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        if len(entries) > 10000 or sum(item.file_size for item in entries) > 64 * 1024 * 1024:
            raise ValueError('Expanded project exceeds PoC limits')
        names = set()
        for item in entries:
            path = PurePosixPath(item.filename)
            if (path.is_absolute() or '..' in path.parts or '\\' in item.filename
                    or ':' in item.filename or item.filename.casefold() in names
                    or ((item.external_attr >> 16) & 0o170000) == 0o120000):
                raise ValueError('Unsafe or duplicate archive path')
            names.add(item.filename.casefold())
        if 'project.json' not in archive.namelist():
            raise ValueError('Archive must contain project.json at its root')
        root = Path('/work') / (uuid.uuid4().hex + '.peepproj')
        root.mkdir(parents=True)
        for item in entries:
            target = root / item.filename
            if item.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(item))
    return str(root)


def export_project(root):
    root = Path(root).resolve()
    if root.parent != Path('/work'):
        raise ValueError('Only PoC projects can be exported')
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(root.rglob('*')):
            if path.is_file():
                archive.write(path, path.relative_to(root).as_posix())
    return base64.b64encode(output.getvalue()).decode('ascii')


def qualify_json(root):
    return json.dumps(qualify(Path(root)))


def qualify_debugger_json(_unused):
    from debugger_scenarios import qualify_debugger
    root = Path('/work') / ('debugger-' + uuid.uuid4().hex)
    root.mkdir(parents=True)
    return json.dumps(qualify_debugger(root))
