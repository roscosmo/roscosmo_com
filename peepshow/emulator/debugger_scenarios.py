"""Native/Pyodide parity using public debugger operations on disposable projects."""
from pathlib import Path
from copy import deepcopy
from PIL import Image
from peepshow_authoring.service import AuthoringService
from peepshow_authoring.protocol import ServiceRequest, ProtocolError


def qualify_debugger(root):
    results={}
    for spatial in (False,True):
        service=AuthoringService();revision=preview=cursor=None
        def call(operation, **params):
            nonlocal revision,preview,cursor
            if operation not in ('project.create','project.load','service.hello'):params['project_revision']=revision
            if operation.startswith('project.preview_') and operation!='project.preview_reset':params['preview_revision']=preview
            if operation=='project.preview_debug':params['debug_revision']=cursor
            result=service.handle(ServiceRequest('browser-debug',operation,params))
            revision=result.get('project_revision',revision);preview=result.get('preview_revision',preview)
            if 'debugger' in result:cursor=result['debugger']['debug_revision']
            return result
        def debug(command,**params):return call('project.preview_debug',command=command,**params)
        def edit(*commands):return call('project.apply_commands',commands=list(commands))
        path=Path(root)/('map.peepproj' if spatial else 'machine.peepproj')
        created=call('project.create',path=str(path),execution_semantics='terminal_order_v1')
        graph=deepcopy(created['document']['scenes'][0]['machine_logic'])
        state=lambda name:dict(state_id=name,display_name=name,object_overrides=[])
        assign=lambda n:dict(kind='set_variable',variable_scope='package',variable_ref='count',operation='assign',value=n)
        end=lambda name:dict(node_id=name,kind='return')
        edit(dict(kind='package_variable.add',variable=dict(variable_id='count',value_type='int32',minimum=0,maximum=100,initial=0)),
             dict(kind='state.add',scene_id='main',state=state('done')),
             dict(kind='input_action.add',scene_id='main',input_action=dict(action_id='act',logical_source='BUTTON_A')),
             dict(kind='event_binding.add',scene_id='main',event_binding=dict(binding_id='tick',event_type='time.scene_elapsed',configuration=dict(delay_ms=100,start_policy='scene_entry'))))
        graph['machines'][0]['states']=['start','done']
        graph['machines'][0]['variable_writes']=[dict(scope='package',variable_ref='count')]
        graph['events']=[dict(event_id='opened',display_name='Opened')]
        graph['scene_activated']=dict(machine_ref='main',event_ref='opened')
        graph['input_receivers']={'act':'main'};graph['timer_receivers']={'tick':'main'}
        def route(name,event,nodes,states=['start']):
            return dict(route_id=name,machine_ref='main',event_ref=event,from_states=states,response=dict(root=nodes[0]['node_id'],nodes=nodes))
        graph['routes']=[route('entry','opened',[dict(node_id='set',kind='actions',actions=[assign(2)],next='end'),end('end')]),
            route('timer','tick',[dict(node_id='set',kind='actions',actions=[assign(9)],next='end'),end('end')],['start','done'])]
        graph['flowcharts']=[dict(flowchart_id='set_count',display_name='Set count',parameters=[dict(parameter_id='amount',type='int32'),dict(parameter_id='counter',type='variable',value_type='int32',access='write')],outputs=[dict(output_id='done')],root='set',nodes=[
            dict(node_id='set',kind='actions',actions=[dict(kind='set_variable',binding=dict(parameter_ref='counter'),operation='assign',value=dict(parameter_ref='amount'))],next='end'),
            dict(node_id='end',kind='return',output_ref='done')])]
        if spatial:
            Image.new('RGBA',(16,16),'black').save(path/'tile.png')
            edit(dict(kind='map.create',asset_id='world',width=16,height=12,tile_width=16,tile_height=16),
                 dict(kind='map.tilesets.set',asset_id='world',tilesets=[dict(firstgid=1,name='Tiles',tilewidth=16,tileheight=16,tilecount=1,columns=1,image='tile.png',imagewidth=16,imageheight=16)]),
                 dict(kind='scene.map.attach',scene_id='main',map=dict(asset_ref='world',background_layers=[1,2],collision_layer=3,cell_width=16,cell_height=16,occupancy=[dict(entity_ref='player')],camera=dict(mode='manual',position=dict(x=0,y=0),clamp=True))),
                 dict(kind='scene.entity.add',scene_id='main',entity_id='player',display_name='Player',position=dict(x=1,y=1)),
                 dict(kind='scene.entity.set',scene_id='main',entity_id='player',changes=dict(position_writer='main')))
            graph['destinations']=[dict(destination_id='step',entity_ref='player',cell=dict(kind='adjacent',direction='right'),include_actors=False)]
        check=dict(kind='destination.clear',destination_ref='step') if spatial else dict(variable_scope='package',variable_ref='count',operator='eq',value=7)
        actions=[dict(kind='destination.move',destination_ref='step')] if spatial else [assign(8)]
        graph['routes'].append(route('turn','act',[
            dict(node_id='call',kind='call',flowchart_ref='set_count',arguments=dict(amount=7,counter=dict(variable_scope='package',variable_ref='count')),continuations=dict(done='check')),
            dict(node_id='check',kind='decision',label='Clear?',condition=check,when_true=dict(label='Yes',next='move'),when_false=dict(label='No',next='stay')),
            dict(node_id='move',kind='actions',actions=actions,next='done'),dict(node_id='done',kind='return',target_state='done'),end('stay')]))
        installed=edit(dict(kind='scene.machines.set',scene_id='main',machine_logic=graph))
        assert not installed['execution_issues'],installed['execution_issues']
        saved=call('project.save')['document']
        assert call('project.load',path=str(path))['document']==saved
        start=call('project.preview_reset',scene_id='main',debug_mode='logic')
        assert not start['debugger']['startup_complete']
        assert start['package_variables']['count']==0
        startup=debug('continue');assert startup['package_variables']['count']==2
        debug('input',logical_source='BUTTON_A')
        pending=debug('step',mode='logic')
        assert pending['debugger']['outcome']=='pending'
        assert pending['framebuffer']==startup['framebuffer']
        assert debug('inspect')['debugger']['executed']==pending['debugger']['executed']
        aborted=debug('abort');assert aborted['package_variables']['count']==2
        point=next(p for p in aborted['debugger']['locations'] if p['kind']=='decision')
        debug('breakpoints',breakpoints=[point]);debug('input',logical_source='BUTTON_A')
        paused=debug('continue');assert paused['debugger']['reason']=='breakpoint'
        assert paused['debugger']['pending']['package_variables']['count']==7
        finished=debug('step',mode='state');assert finished['debugger']['outcome']=='committed'
        evidence=next(e for e in finished['debugger']['executed'] if e['kind']=='decision')
        assert evidence['result'] is True
        assert evidence['world_operands'][0]['query']['reason']=='clear' if spatial else evidence['decision_operands'][0]['left']==7
        # Explicit stale cursor must be rejected without executing work.
        try:
            service.handle(ServiceRequest('stale','project.preview_debug',dict(project_revision=revision,preview_revision=preview,debug_revision=cursor-1,command='inspect')))
        except ProtocolError as exc:stale=exc.code
        else:raise AssertionError('stale cursor accepted')
        debug('breakpoints',breakpoints=[])
        debug('advance',elapsed_ms=100);timed=debug('continue')
        assert timed['package_variables']['count']==9
        assert any(e['kind']=='timer' for e in timed['debugger']['executed'])
        debug('stop')
        normal=call('project.preview_reset',scene_id='main')
        normal=call('project.preview_input',logical_source='BUTTON_A')
        assert normal['framebuffer']==finished['framebuffer']
        assert normal['package_variables']==finished['package_variables']
        assert normal['machines']==finished['machines']
        normal=call('project.preview_advance',elapsed_ms=100)
        assert normal['package_variables']==timed['package_variables']
        assert call('project.load',path=str(path))['document']==saved
        results['map' if spatial else 'machine']=dict(startup=True,abort=True,breakpoint=True,state_step=True,timer=True,
            stale_cursor=stale,frame=finished['framebuffer']['sha256'],variables=finished['package_variables'],
            decision=evidence,source_preserved=call('project.load',path=str(path))['document']==saved)
    return results
