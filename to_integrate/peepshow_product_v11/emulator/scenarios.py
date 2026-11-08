"""Identical public-operation checks for native Python and browser Python."""
import hashlib
import json
from pathlib import Path
from peepshow_authoring.service import AuthoringService
from peepshow_authoring.protocol import ProtocolError, ServiceRequest


def qualify(root):
    service = AuthoringService()
    revision = 0
    preview_revision = None

    def call(operation, **params):
        nonlocal revision, preview_revision
        if operation not in ('project.load', 'project.create', 'service.hello'):
            params['project_revision'] = revision
        if operation.startswith('project.preview_') and operation != 'project.preview_reset':
            params['preview_revision'] = preview_revision
        result = service.handle(ServiceRequest('qualification', operation, params))
        revision = result.get('project_revision', revision)
        preview_revision = result.get('preview_revision', preview_revision)
        return result

    loaded = call('project.load', path=str(root))
    assert loaded['valid'], loaded.get('issues')
    scene = loaded['document']['project']['entry_scene']
    egg = call('project.build_package')['package']
    frames = []
    state = call('project.preview_reset', scene_id=scene, scope_host={'version': 1})
    frames.append(state['framebuffer']['sha256'])
    if 'scope_input' in state:
        state = call('project.preview_input_snapshot', held_sources=[],
                     focus_generation=state['scope_input']['generation'])
    for source in ('JOY_RIGHT', 'JOY_DOWN'):
        fields = {'focus_generation': state['scope_input']['generation']} if 'scope_input' in state else {}
        state = call('project.preview_input', logical_source=source, **fields)
        frames.append(state['framebuffer']['sha256'])
        state = call('project.preview_input', logical_source=source, event_kind='release', **fields)
        state = call('project.preview_advance', elapsed_ms=250)
    # Metadata edits preserve the running executor, focus and preview revision.
    prior_preview_revision = preview_revision
    title_before = next(s for s in loaded['document']['scenes'] if s['scene_id'] == scene)['display_name']
    live_edit = call('project.apply_commands', commands=[{'kind': 'scene.rename', 'scene_id': scene, 'display_name': title_before + ' live edit'}])
    assert live_edit['preview_update'] == 'preserved'
    assert preview_revision == prior_preview_revision
    assert call('project.undo')['preview_update'] == 'preserved'
    call('project.preview_advance', elapsed_ms=0)
    # A supported screen object can redraw without resetting gameplay.
    object_ref = 'progress' if scene == 'room_1' else 'menu_feed'
    original_scene = next(s for s in loaded['document']['scenes'] if s['scene_id'] == scene)
    old_x = next(o for o in original_scene['objects'] if o['object_id'] == object_ref)['defaults']['x']
    visual = call('project.apply_commands', commands=[{'kind': 'object.set_defaults', 'scene_id': scene,
                  'object_id': object_ref, 'properties': {'x': old_x + 7}}])
    assert visual['preview_update'] == 'visual_updated'
    assert preview_revision == prior_preview_revision
    assert next(o for o in visual['preview_snapshot']['objects'] if o['object_id'] == object_ref)['underlying']['x'] == old_x + 7
    assert call('project.undo')['preview_update'] == 'visual_updated'
    if scene == 'room_1':
        isolated = call('project.apply_commands', commands=[{'kind': 'object.set_defaults', 'scene_id': 'room_2',
                       'object_id': 'progress', 'properties': {'x': 7}}])
        assert isolated['preview_update'] == 'preserved'
        assert isolated['preview_dependencies']['stale_scenes'] == ['room_2']
        assert preview_revision == prior_preview_revision
        call('project.preview_advance', elapsed_ms=0)
        assert call('project.undo')['preview_dependencies']['stale_scenes'] == []
    # No audio commands are taken by this non-audible structural test host.
    call('project.preview_suspend')
    original = next(s for s in loaded['document']['scenes'] if s['scene_id'] == scene)['display_name']
    renamed = original + ' browser check'
    changed = call('project.apply_commands', commands=[{'kind': 'scene.rename', 'scene_id': scene, 'display_name': renamed}])
    def title(result):
        return next(s for s in result['document']['scenes'] if s['scene_id'] == scene)['display_name']
    assert title(changed) == renamed
    assert title(call('project.undo')) == original
    assert title(call('project.redo')) == renamed
    call('project.save')
    assert title(call('project.load', path=str(root))) == renamed
    # Legacy fixtures remain legacy. Draft editing uses an explicitly new
    # incremental project rather than silently converting either example.
    root = Path(root).with_name(Path(root).name + '.draft.peepproj')
    call('project.create', path=str(root), authoring_mode='incremental_v1', create_initial_scene=False)
    scene = 'main'
    call('project.apply_commands', commands=[{'kind': 'scene.add', 'display_name': 'Main'},
         {'kind': 'project.set_entry_scene', 'scene_id': scene},
         {'kind': 'state.add', 'scene_id': scene, 'state': {'state_id': 'idle', 'display_name': 'Idle', 'object_overrides': []}},
         {'kind': 'state.set_entry', 'scene_id': scene, 'state_id': 'idle'}])
    call('project.apply_commands', commands=[{'kind': 'state.set_entry', 'scene_id': scene, 'state_id': None}])
    call('project.save')
    reopened = call('project.load', path=str(root))
    assert next(s for s in reopened['document']['scenes'] if s['scene_id'] == scene)['entry_state'] is None
    blocked = []
    for operation, fields in [('project.preview_reset', {'scene_id': scene, 'scope_host': {'version': 1}}), ('project.build_package', {})]:
        try:
            call(operation, **fields)
        except ProtocolError as exc:
            blocked.append(exc.code)
        else:
            raise AssertionError('Incomplete entry unexpectedly executable: ' + operation)
    return {'scene': loaded['document']['project']['entry_scene'], 'egg_sha256': egg['sha256'], 'egg_bytes': egg['size_bytes'],
            'frames': frames, 'editing_save_reopen': True, 'unfinished_saved': True, 'blocked': blocked}
