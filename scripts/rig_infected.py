"""Finish the original character authored by sculpt_infected.py in Blender."""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
scene=bpy.context.scene
parts=[o for o in scene.objects if o.type=='MESH' and 'qz_bone' in o]
assert len(parts)>100, 'Run sculpt_infected.py first'
bpy.ops.object.select_all(action='DESELECT')
armdata=bpy.data.armatures.new('Blackwater_Anatomical_Rig')
rig=bpy.data.objects.new('Blackwater_Rig',armdata);scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
specs=[('root',(0,0,0),(0,0,.20),None),('hips',(0,.025,.88),(0,.025,1.02),'root'),('spine',(0,.025,1.02),(0,.027,1.45),'hips'),('neck',(0,.01,1.45),(0,0,1.59),'spine'),('head',(0,0,1.59),(0,.01,1.87),'neck')]
for s,label in [(-1,'L'),(1,'R')]:
    specs.extend([('upper_arm.'+label,(s*.214,.03,1.43),(s*.331,-.015,1.08),'spine'),('forearm.'+label,(s*.331,-.015,1.08),(s*.391,-.12,.79),'upper_arm.'+label),('hand.'+label,(s*.391,-.12,.79),(s*.397,-.145,.66),'forearm.'+label),('thigh.'+label,(s*.10,.025,.88),(s*.104,.008,.51),'hips'),('shin.'+label,(s*.104,.008,.51),(s*.111,.007,.19),'thigh.'+label),('foot.'+label,(s*.111,.007,.19),(s*.111,-.16,.08),'shin.'+label)])
for name,head,tail,parent in specs:
    b=armdata.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=armdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
def clamp(x):return max(0,min(1,x))
for o in parts:
    base=o['qz_bone'];groups={}
    def weight(name,index,value):
        if name not in groups:groups[name]=o.vertex_groups.new(name=name)
        if value>.001:groups[name].add([index],value,'REPLACE')
    for v in o.data.vertices:
        z=(o.matrix_world@v.co).z;blend=None;t=0
        if base=='spine':blend='hips';t=clamp((1.09-z)/.18)*.65
        elif base=='neck':blend='head';t=clamp((z-1.53)/.09)*.5
        elif base.startswith('upper_arm'):
            blend='forearm.'+base[-1];t=clamp((1.15-z)/.13)*.55
        elif base.startswith('forearm'):
            if z>1.01:blend='upper_arm.'+base[-1];t=clamp((z-1.01)/.13)*.5
            elif z<.84:blend='hand.'+base[-1];t=clamp((.84-z)/.09)*.4
        elif base.startswith('thigh'):
            if z<.59:blend='shin.'+base[-1];t=clamp((.59-z)/.15)*.55
            elif z>.81:blend='hips';t=clamp((z-.81)/.15)*.5
        elif base.startswith('shin'):
            if z>.44:blend='thigh.'+base[-1];t=clamp((z-.44)/.14)*.55
            elif z<.26:blend='foot.'+base[-1];t=clamp((.26-z)/.14)*.4
        weight(base,v.index,1-t)
        if blend:weight(blend,v.index,t)
    o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join();character=bpy.context.object;character.name='Blackwater_Worker_Sculpt'
modifier=character.modifiers.new('Anatomical deformation','ARMATURE');modifier.object=rig
character.parent=rig
# Smoothly interpolated asymmetrical stagger, kept in place for game navigation.
scene.render.fps=24;scene.frame_start=1;scene.frame_end=49
for frame in range(1,50,3):
    phase=(frame-1)/48*math.tau
    for p in rig.pose.bones:p.rotation_mode='XYZ';p.rotation_euler=(0,0,0)
    rig.pose.bones['hips'].location=(0,math.sin(phase*2)*.012,0)
    rig.pose.bones['spine'].rotation_euler=(.055,math.sin(phase)*.055,math.sin(phase)*.025)
    rig.pose.bones['neck'].rotation_euler=(.07,.035,0)
    rig.pose.bones['head'].rotation_euler=(.04+math.sin(phase+.5)*.025,math.sin(phase*.999)*.06,-.045)
    for s,label in [(-1,'L'),(1,'R')]:
        wave=math.sin(phase+(math.pi if s>0 else 0))
        rig.pose.bones['thigh.'+label].rotation_euler.x=wave*.28
        rig.pose.bones['shin.'+label].rotation_euler.x=max(0,-wave)*.36
        rig.pose.bones['foot.'+label].rotation_euler.x=-wave*.09
        rig.pose.bones['upper_arm.'+label].rotation_euler.x=-.50+wave*.11
        rig.pose.bones['upper_arm.'+label].rotation_euler.z=s*.11
        rig.pose.bones['forearm.'+label].rotation_euler.x=-.24+math.sin(phase+.5)*.09
        rig.pose.bones['hand.'+label].rotation_euler.x=.15
    for p in rig.pose.bones:p.keyframe_insert('rotation_euler',frame=frame,group=p.name)
    rig.pose.bones['hips'].keyframe_insert('location',frame=frame,group='hips')
rig.animation_data.action.name='Blackwater_Stagger'
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);character.select_set(True);bpy.context.view_layer.objects.active=rig
asset=os.path.join(ROOT,'public','assets','infected-sculpted.glb')
bpy.ops.export_scene.gltf(filepath=asset,export_format='GLB',use_selection=True,use_active_scene=True,export_animation_mode='ACTIVE_ACTIONS',export_animations=True,export_frame_range=True,export_force_sampling=True,export_skins=True)

# A neutral studio rig for inspecting the actual geometry and materials.
scene.world=bpy.data.worlds.new('Character studio world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.085,.10,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
def area(name,loc,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Softbox warm key',(-2,-3,3),200,(1,.86,.70),3)
area('Cool soft fill',(2,-1,2),100,(.61,.78,1),2)
area('Rim',(1,2,2.8),260,(.62,.85,1),2)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.014));floor=bpy.context.object;floor.name='Studio floor';m=bpy.data.materials.new('Studio charcoal');m.diffuse_color=(.028,.035,.038,1);floor.data.materials.append(m)
camdata=bpy.data.cameras.new('Inspection camera');cam=bpy.data.objects.new('Inspection camera',camdata);scene.collection.objects.link(cam);scene.camera=cam
cam.location=(2.6,-5.8,2.15);target=Vector((0,-.03,.99));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=2.25
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.render.filepath=os.path.join(ROOT,'art','infected-full.png')
bpy.data.libraries.write(os.path.join(ROOT,'art','blackwater-infected.blend'),{scene},fake_user=True)
print({'asset':asset,'vertices':len(character.data.vertices),'triangles':sum(len(p.vertices)-2 for p in character.data.polygons),'materials':len(character.data.materials),'bones':len(rig.pose.bones),'animation':rig.animation_data.action.name})
