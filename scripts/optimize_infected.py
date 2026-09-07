"""Build a game-ready derivative of the original Blender sculpt; preserve the source."""
import bpy, bmesh, math, os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art','blackwater-infected.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
character=next(o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
bpy.ops.object.select_all(action='DESELECT');character.select_set(True);bpy.context.view_layer.objects.active=character
# Weld the duplicated loft seam before simplification; otherwise the forehead and
# front of the neck split into visibly mismatched shading strips under a flashlight.
bm=bmesh.new();bm.from_mesh(character.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00004)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(character.data);bm.free()
# Reproject skin UVs continuously across the face, placing no seam down its centre.
uv=character.data.uv_layers.active
for face in character.data.polygons:
    material=character.data.materials[face.material_index]
    if 'ashen_skin' in material.name:
        for index in face.loop_indices:
            v=character.data.vertices[character.data.loops[index].vertex_index].co
            uv.data[index].uv=(.5+v.x*2.5,.2+v.z*.65)
# Tighten the open mouth and narrow the eyelids to remove the fixed surprised look.
for v in character.data.vertices:
    x,y,z=v.co
    if abs(x)<.061 and y<-.07 and 1.624<z<1.674:v.co.z=1.649+(z-1.649)*.64
    if .025<abs(x)<.073 and y<-.073 and 1.746<z<1.768:v.co.z=1.757+(z-1.757)*.7
for material in character.data.materials:
    if material.use_nodes:
        for node in material.node_tree.nodes:
            if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.3
# Collapse micro-detail while retaining weighted joints, silhouette and original UVs.
mod=character.modifiers.new('Runtime triangle budget','DECIMATE');mod.ratio=.20
bpy.ops.object.modifier_move_up(modifier=mod.name)
bpy.ops.object.modifier_apply(modifier=mod.name)
# Five material families, retaining skin/fabric texture maps and safety tape.
slots=list(character.data.materials)
family={}
for i,m in enumerate(slots):
    n=m.name
    key='skin' if any(t in n for t in ['ashen_skin','scar_tissue','desiccated']) else 'cloth' if any(t in n for t in ['jacket','stitching']) else 'pants' if 'trousers' in n else 'tape' if any(t in n for t in ['tape','teeth','cornea','iris']) else 'dark'
    family[i]=key
keepers={k:next(i for i,m in enumerate(slots) if match in m.name) for k,match in [('skin','ashen_skin'),('cloth','jacket'),('pants','trousers'),('tape','safety_tape'),('dark','boot_leather')]}
for p in character.data.polygons:p.material_index=keepers[family[p.material_index]]
bpy.ops.object.material_slot_remove_unused()
# Foot-led stride: opposed thighs, bending swing knee, planted ankle, small hip lift.
rig.animation_data_clear();bpy.context.scene.render.fps=30;bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=37
for frame in range(1,38):
    phase=(frame-1)/36*math.tau
    for p in rig.pose.bones:p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0)
    rig.pose.bones['hips'].location.z=.014*(1-math.cos(phase*2))
    rig.pose.bones['hips'].rotation_euler.y=math.sin(phase)*.018
    rig.pose.bones['spine'].rotation_euler=(.10,math.sin(phase)*.035,math.sin(phase)*.025)
    rig.pose.bones['neck'].rotation_euler.x=-.05
    rig.pose.bones['head'].rotation_euler=(.04,math.sin(phase+.3)*.025,-.035)
    for side,label in [(-1,'L'),(1,'R')]:
        t=phase+(math.pi if side>0 else 0);stride=math.cos(t);swing=max(0,math.sin(t))
        rig.pose.bones['thigh.'+label].rotation_euler.x=stride*.43
        rig.pose.bones['shin.'+label].rotation_euler.x=-swing*.72-.06
        rig.pose.bones['foot.'+label].rotation_euler.x=-stride*.23+swing*.25
        rig.pose.bones['upper_arm.'+label].rotation_euler.x=-.20-stride*.22
        rig.pose.bones['upper_arm.'+label].rotation_euler.z=side*.075
        rig.pose.bones['forearm.'+label].rotation_euler.x=-.22-swing*.12
        rig.pose.bones['hand.'+label].rotation_euler.x=.08
    for p in rig.pose.bones:
        p.keyframe_insert('rotation_euler',frame=frame,group=p.name)
        if p.name=='hips':p.keyframe_insert('location',frame=frame,group=p.name)
rig.animation_data.action.name='Blackwater_Pursuit'
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);character.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','assets','infected-runtime.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIVE_ACTIONS',export_animations=True,export_frame_range=True,export_force_sampling=True,export_skins=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','blackwater-infected-runtime.blend'))
print('Runtime character:',sum(len(p.vertices)-2 for p in character.data.polygons),'triangles;',len(character.data.materials),'materials')
