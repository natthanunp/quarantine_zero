"""Run through Blender MCP, or: blender --background --python scripts/generate_assets.py.
Creates its own scene; preserves any existing scene. All assets are original.
"""
import bpy, math, os, random
from mathutils import Vector
random.seed(24)
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'public', 'assets'))
os.makedirs(OUT, exist_ok=True)
original_scene = bpy.context.window.scene
scene = bpy.data.scenes.new('QuarantineZero_AssetWorkshop')
bpy.context.window.scene = scene

def material(name, color, metallic=0, roughness=.6, glow=0):
    m=bpy.data.materials.new('QZ_'+name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metallic; p.inputs['Roughness'].default_value=roughness
    if glow:
        p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=glow
    return m
steel=material('gunmetal',(.075,.09,.10),.85,.29)
rubber=material('rubber',(.022,.03,.028),0,.87)
olive=material('olive',(.15,.18,.115),.35,.53)
brass=material('brass',(.5,.32,.10),.8,.3)
skin=material('infected_skin',(.28,.34,.27),0,.72)
cloth=material('torn_workwear',(.105,.15,.17),0,.95)
blood=material('lesions',(.16,.035,.018),0,.53)
eye=material('infected_eyes',(.8,.28,.035),0,.3,4)
wood=material('aged_crate',(.18,.13,.065),0,.89)

def box(name, loc, scale, mat, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object; o.name=name; o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Machined_edges','BEVEL'); b.width=bevel;b.segments=2
        o.modifiers.new('Normals','WEIGHTED_NORMAL')
    return o
def sphere(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=12,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
def cylinder(name,loc,radius,depth,mat,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=radius,depth=depth,location=loc,rotation=rotation);o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    b=o.modifiers.new('Edge','BEVEL');b.width=.006;b.segments=2;o.modifiers.new('Normals','WEIGHTED_NORMAL');return o
def export(name):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_apply=True)
    for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)

# Local -Y points down the barrel. glTF converts this to local +Z.
for name,short in [('carbine',False),('pistol',True)]:
    length=.30 if short else .61
    box('receiver',(0,0,.06),(.10,length,.12),steel)
    box('grip',(0,length*.28,-.07),(.075,.105,.20),rubber).rotation_euler.x=-.2
    cylinder('barrel',(0,-length*.65,.07),.025,.20,steel,(math.pi/2,0,0))
    cylinder('muzzle',(0,-length*.84,.07),.034,.06,steel,(math.pi/2,0,0))
    box('front_sight',(0,-length*.47,.15),(.025,.025,.065),steel)
    box('rear_sight',(0,length*.38,.145),(.055,.025,.025),steel)
    box('ejection_port',(.052,.01,.075),(.006,.065,.034),brass,.002)
    if not short:
        box('handguard',(0,-.24,.055),(.115,.24,.12),olive)
        box('stock',(0,.43,.025),(.085,.27,.15),rubber)
        box('magazine',(0,.02,-.15),(.065,.12,.24),steel).rotation_euler.x=-.14
        for i in range(9):box('rail_'+str(i),(0,-.27+i*.04,.14),(.115,.014,.023),steel,.002)
        for i in range(6):box('cooling_'+str(i),(.06,-.33+i*.033,.065),(.007,.018,.04),rubber,.002)
    else:
        for i in range(7):box('slide_serration_'+str(i),(.052,.04+i*.012,.09),(.004,.006,.06),rubber,.001)
    box('trigger_guard',(0,.06,-.045),(.026,.12,.02),steel)
    export(name)

sphere('torso',(0,0,1.20),(.26,.145,.36),cloth)
sphere('pelvis',(0,0,.89),(.20,.13,.15),cloth)
cylinder('neck',(0,0,1.55),.073,.15,skin)
sphere('head',(0,-.015,1.73),(.13,.115,.17),skin)
sphere('jaw',(0,-.052,1.63),(.105,.10,.075),skin)
sphere('nose',(0,-.122,1.735),(.026,.03,.045),skin)
for s in [-1,1]:
    sphere('eye_'+str(s),(s*.046,-.118,1.775),(.023,.011,.017),eye)
    sphere('cheek_lesion_'+str(s),(s*.088,-.09,1.69),(.036,.018,.044),blood)
    sphere('upper_arm_'+str(s),(s*.30,-.025,1.28),(.085,.087,.25),cloth).rotation_euler.y=s*.18
    sphere('forearm_'+str(s),(s*.35,-.16,1.00),(.066,.068,.24),skin).rotation_euler.x=-.5
    sphere('hand_'+str(s),(s*.35,-.27,.83),(.074,.04,.10),skin)
    for f in range(4):cylinder('finger',(s*.35+(f-1.5)*.026,-.28,.73),.012,.12,skin)
    sphere('thigh_'+str(s),(s*.13,0,.69),(.10,.115,.28),cloth)
    sphere('shin_'+str(s),(s*.13,-.01,.30),(.077,.09,.25),cloth)
    box('boot_'+str(s),(s*.13,-.065,.08),(.17,.29,.15),rubber,.035)
    box('pocket_'+str(s),(s*.135,-.14,1.33),(.10,.025,.12),olive)
for i in range(8):sphere('wound_'+str(i),(random.uniform(-.18,.18),-.145,random.uniform(1.04,1.44)),(.025,.012,.043),blood)
export('infected')

box('crate_body',(0,0,.49),(.95,.75,.98),wood,.025)
for s in [-1,1]:
    for z in [.12,.85]:box('crate_band',(0,s*.382,z),(1,.035,.075),olive)
    for x in [-.38,.38]:box('crate_upright',(x,s*.39,.49),(.09,.035,.98),wood)
for z in [.20,.39,.58,.77]:
    for s in [-1,1]:box('plank_gap',(0,s*.381,z),(.77,.01,.009),rubber,.001)
export('supply-crate')
cylinder('drum',(0,0,.55),.34,1.1,olive)
for z in [.04,.28,.80,1.06]:cylinder('drum_ring',(0,0,z),.355,.035,steel)
cylinder('cap',(.15,0,1.115),.045,.022,steel)
export('barrel')
bpy.context.window.scene=original_scene
print('QZ: exported pistol, carbine, infected, supply-crate, barrel to '+OUT)
