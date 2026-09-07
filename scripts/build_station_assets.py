"""Original Blender-built armory, perk machines, and modular map landmarks.
All geometry is authored here; no downloaded models. Coordinates: +Y forward,
Z up. Weapons share a true sight line at x=0,z=0, becoming y=0 in glTF.
"""
import bpy, math, os, random, json
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
OUT=os.path.join(ROOT,'public','assets');ART=os.path.join(ROOT,'art')
previous=bpy.context.window.scene
scene=bpy.data.scenes.new('QZ_Armory_and_Station_Workshop');bpy.context.window.scene=scene
parts=[];random.seed(17)
def mat(name,c,metal=.0,rough=.5,glow=0):
    m=bpy.data.materials.new('QZ3_'+name);m.use_nodes=True;m.diffuse_color=(*c,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if glow:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=glow
    return m
steel=mat('Parkerized steel',(.055,.068,.075),.75,.44)
edge=mat('Worn machined edge',(.14,.16,.17),.8,.35)
polymer=mat('Textured polymer',(.027,.035,.030),0,.85)
olive=mat('Olive receiver',(.14,.17,.115),.45,.55)
brass=mat('Brass hardware',(.32,.22,.087),.7,.39)
rubber=mat('Black rubber',(.016,.023,.023),0,.9)
white=mat('Worn lettering',(.72,.73,.63),.1,.61)
glass=mat('Gauge glass',(.11,.20,.19),.4,.19)
cream=mat('Gauge face',(.64,.61,.47),0,.73)
red=mat('Warning red',(.33,.032,.025),.2,.49)
cyan=mat('Ion blue',(.17,.64,.78),.25,.25,2)
dot=mat('Sight tritium',(.53,.77,.49),0,.5,.35)

def finish(o,name,material):
    o.name=name;o.data.materials.append(material);parts.append(o)
    return o
def box(name,loc,dim,m=steel,bevel=.003):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Machined bevel','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,m)
def cyl(name,loc,r,depth,m=steel,axis='Z',vertices=24):
    rot=(math.pi/2,0,0) if axis=='Y' else (0,math.pi/2,0) if axis=='X' else (0,0,0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc,rotation=rot);o=bpy.context.object
    bevel=o.modifiers.new('Turned edges','BEVEL');bevel.width=min(.003,r*.12);bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name)
    for p in o.data.polygons:p.use_smooth=True
    mod=o.modifiers.new('Normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,m)
def tube(name,loc,major,minor,m=steel,axis='Z'):
    rot=(math.pi/2,0,0) if axis=='Y' else (0,math.pi/2,0) if axis=='X' else (0,0,0)
    bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,location=loc,major_radius=major,minor_radius=minor,rotation=rot)
    o=bpy.context.object
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,m)
def pipe(name,points,r,m=steel):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=2;d.resolution_u=4;d.use_fill_caps=True
    s=d.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,name,m)
def text(body,loc,size,m=white):
    d=bpy.data.curves.new(body,'FONT');d.body=body;d.size=size;d.align_x='CENTER';d.extrude=.0003
    o=bpy.data.objects.new(body,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,body,m)
def marker(name,loc):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=loc;return o
def bolts(x,y,z,n=4,spacing=.02):
    for i in range(n):cyl('Recessed fastener',(x,y+i*spacing,z),.003,.003,edge,'X',12)
def sights(front,rear=.025):
    # Rear wings stop at sight height; the center notch is empty above -0.010.
    for s in [-1,1]:
        box('Rear notch wing',(s*.013,rear,-.009),(.013,.018,.018),steel,.001)
        cyl('Rear tritium',(s*.013,rear-.0095,-.003),.0017,.001,dot,'Y',12)
    box('Rear notch floor',(0,rear,-.015),(.039,.018,.010),steel,.001)
    box('Front sight base',(0,front,-.025),(.025,.016,.015),steel,.001)
    box('Front sight post',(0,front,-.010),(.0035,.009,.020),steel,.0005)
    cyl('Front tritium',(0,front-.005,-.004),.0015,.001,dot,'Y',12)
    marker('sight_rear',(0,rear,0));marker('sight_front',(0,front,0))
def grip(y,z=-.13):
    o=box('Pistol grip',(0,y,z),(.037,.066,.125),polymer,.008);o.rotation_euler.x=-.22
    for i in range(8):box('Grip checkering',(0,y-.033,z-.05+i*.012),(.037,.003,.003),rubber,.001)
    pipe('Open trigger guard',[(-.018,y+.015,-.09),(-.018,y+.077,-.095),(-.018,y+.078,-.12),(-.018,y+.018,-.13)],.003,steel)
    box('Trigger blade',(0,y+.045,-.096),(.009,.005,.027),edge,.002)
def export(name):
    # One mesh with material groups keeps browser draw calls bounded.
    bpy.ops.object.select_all(action='DESELECT')
    hidden=[o for o in parts if 'stock' in o.name.lower()]
    for o in parts:
        if o not in hidden:o.select_set(True)
    bpy.context.view_layer.objects.active=next(o for o in parts if o not in hidden);bpy.ops.object.join();joined=bpy.context.object;joined.name=name
    for o in hidden:o.name='FP_HIDDEN_'+o.name;o.select_set(True)
    for o in scene.objects:
        if o.type=='EMPTY':o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False)
    # Retain an editable .blend for every asset without modifying the user's file.
    bpy.data.libraries.write(os.path.join(ART,name+'.blend'),{scene},fake_user=True)
    for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
    parts.clear()

# Five separately designed game weapons. All receiver/rail geometry stays below
# the shared sight axis. Barrel bores use rings instead of solid muzzle disks.
for weapon in ['pistol','carbine','shotgun','smg','arc']:
    if weapon=='pistol':
        box('Forged slide',(0,.117,-.043),(.034,.232,.041),steel,.005)
        box('Lower frame',(0,.111,-.074),(.032,.215,.025),polymer,.004);grip(.030)
        for side in [-1,1]:
            for i in range(9):box('Slide serration',(side*.0175,.025+i*.006,-.043),(.0015,.002,.028),edge,.0003)
        box('Ejection port',(.0175,.156,-.04),(.002,.040,.018),rubber,.001)
        box('Barrel hood',(.0187,.16,-.046),(.001,.022,.008),edge,.001)
        tube('Muzzle crown',(0,.239,-.04),.009,.0025,edge,'Y');sights(.219)
        marker('muzzle',(0,.244,-.040))
    else:
        long=weapon in ['carbine','shotgun'];length=.70 if long else .45
        if weapon=='shotgun':
            box('Shotgun receiver',(0,.11,-.061),(.059,.23,.075),steel,.007);grip(.015)
            cyl('Long barrel',(0,.49,-.040),.016,.55,steel,'Y')
            cyl('Magazine tube',(0,.40,-.079),.019,.38,steel,'Y')
            box('Pump fore-end',(0,.345,-.088),(.065,.19,.072),polymer,.015)
            for i in range(10):box('Pump ribs',(0,.26+i*.018,-.085),(.068,.004,.074),rubber,.002)
            tube('Bore',(0,.771,-.040),.0125,.003,edge,'Y');front=.735
        elif weapon=='smg':
            box('Compact receiver',(0,.11,-.047),(.056,.26,.066),steel,.007);grip(.005)
            box('Magazine well',(0,.10,-.112),(.045,.08,.070),polymer,.004)
            box('Straight stick magazine',(0,.10,-.21),(.031,.053,.19),steel,.004)
            box('Vented handguard',(0,.29,-.052),(.061,.11,.066),polymer,.008)
            cyl('Barrel',(0,.385,-.043),.013,.11,steel,'Y');tube('Muzzle',(0,.442,-.043),.010,.003,edge,'Y');front=.328
        elif weapon=='arc':
            box('ARC ceramic receiver',(0,.11,-.053),(.065,.27,.085),olive,.01);grip(.025)
            cyl('Emitter core',(0,.365,-.051),.027,.24,steel,'Y')
            for i in range(5):tube('Induction coil',(0,.28+i*.037,-.051),.032,.004,cyan,'Y')
            for s in [-1,1]:box('Emitter containment rail',(s*.038,.37,-.062),(.011,.23,.043),steel,.003)
            box('Power cell',(0,.10,-.168),(.064,.095,.15),polymer,.008)
            for s in [-1,1]:box('Battery indicator',(s*.033,.10,-.145),(.002,.060,.008),cyan,.001)
            tube('Emitter aperture',(0,.492,-.051),.022,.006,edge,'Y');front=.235
        else:
            box('Upper receiver',(0,.115,-.05),(.059,.24,.065),olive,.005)
            box('Lower receiver',(0,.095,-.092),(.052,.20,.040),steel,.005);grip(.018)
            o=box('Curved magazine',(0,.165,-.188),(.039,.078,.19),steel,.006);o.rotation_euler.x=.13
            box('Handguard',(0,.38,-.047),(.061,.27,.065),olive,.007)
            for s in [-1,1]:
                for i in range(7):box('Handguard slot',(s*.031,.273+i*.034,-.047),(.002,.022,.018),rubber,.002)
            cyl('Exposed barrel',(0,.588,-.047),.012,.15,steel,'Y');tube('Flash hider',(0,.673,-.047),.015,.003,edge,'Y');front=.487
        if weapon!='smg':
            box('Stock beam',(0,-.125,-.074),(.035,.25,.036),steel,.003)
            box('Shoulder stock',(0,-.242,-.09),(.050,.135,.097),polymer,.01)
        else:
            for s in [-1,1]:box('Folding stock strut',(s*.022,-.10,-.053),(.010,.22,.016),steel,.002)
            box('Stock pad',(0,-.206,-.077),(.043,.025,.075),rubber,.005)
        box('Low profile rail',(0,.15,-.015),(.029,.28,.006),steel,.001)
        for i in range(15):box('Rail tooth',(0,.02+i*.018,-.010),(.032,.006,.005),edge,.0005)
        box('Ejection recess',(.030,.136,-.047),(.003,.060,.023),rubber,.002);bolts(.031,.036,-.065)
        cyl('Selector',(-.029,.054,-.075),.008,.006,edge,'X',16)
        sights(front);marker('muzzle',(0,.775 if weapon=='shotgun' else .677 if weapon=='carbine' else .497 if weapon=='arc' else .446,-.045))
    export('weapon-'+weapon)

# Perk machines are original industrial cabinets with analogue gauges, real
# controls and bottle dispensers. Color is part of the physical identity.
for name,label,color,icon in [('vital','VITAL SURGE',(.28,.045,.027),'+'),('speed','QUICK HANDS',(.32,.20,.036),'>>'),('regen','SECOND WIND',(.04,.21,.10),'O2')]:
    enamel=mat(name+' chipped enamel',color,.5,.57)
    glow=mat(name+' illuminated branding',tuple(min(1,c*1.8+.2) for c in color),.1,.4,.6)
    box('Cast iron plinth',(0,0,.09),(1.03,.80,.18),steel,.04)
    box('Enamel cabinet',(0,0,.91),(.88,.66,1.65),enamel,.055)
    box('Inset door seam',(0,-.339,.96),(.758,.012,1.40),rubber,.008)
    box('Front door',(0,-.352,.96),(.732,.024,1.365),enamel,.020)
    box('Illuminated marquee',(0,-.352,1.61),(.75,.045,.21),glow,.024)
    text(label,(0,-.382,1.584),.077,steel)
    text('BLACKWATER BIO-SYSTEMS',(0,-.377,1.425),.033,cream)
    cyl('Pressure gauge bezel',(-.19,-.40,1.23),.126,.064,edge,'Y',40)
    cyl('Gauge dial',(-.19,-.436,1.23),.111,.005,cream,'Y',40)
    for i in range(11):
        a=(i/10*1.5+.25)*math.pi
        tick=box('Gauge tick',(-.19+math.sin(a)*.090,-.440,1.23+math.cos(a)*.090),(.003,.004,.014),steel,.0005);tick.rotation_euler.y=a
    needle=box('Gauge needle',(-.17,-.446,1.25),(.005,.005,.11),red,.001);needle.rotation_euler.y=-.72
    text(icon,(.18,-.391,1.23),.13,glow)
    box('Coin slot surround',(.18,-.389,1.06),(.16,.033,.13),edge,.008)
    box('Coin slot',(.18,-.409,1.085),(.077,.004,.010),rubber,.001)
    cyl('Dispense button',(.18,-.426,1.029),.030,.035,glow,'Y',24)
    box('Dispenser cavity',(0,-.381,.80),(.43,.028,.30),rubber,.010)
    box('Dispenser tray',(0,-.43,.651),(.46,.23,.026),edge,.004)
    cyl('Dose bottle',(0,-.416,.766),.042,.15,glow,'Z',24);cyl('Bottle cap',(0,-.416,.851),.028,.018,steel)
    for i in range(8):box('Cabinet ventilation',(0,-.379,.23+i*.025),(.57,.008,.008),rubber,.001)
    for s in [-1,1]:
        for z in [.29,1.36]:cyl('Door bolt',(s*.329,-.381,z),.009,.007,edge,'Y',12)
        box('Side service cover',(s*.447,.055,.71),(.009,.40,.54),steel,.008)
        for z in [.45,.62]:box('Chipped paint scar',(s*.22,-.38,z),(.07,.004,.008),edge,.001)
    pipe('Side coolant hose',[(.47,.0,.5),(.60,.10,.6),(.61,.16,1.2),(.46,.16,1.38)],.027,rubber)
    export('perk-'+name)

# Map kit: a full pump skid, generator, laboratory isolation chamber, arched
# industrial doorway, and a relay mast. These are composed into rooms in-game.
box('Pump skid',(0,0,.14),(2.5,1.65,.28),steel,.04)
cyl('Pump motor',(-.58,0,.72),.39,1.12,olive,'X',40)
for i in range(11):tube('Motor cooling fin',(-1.06+i*.09,0,.72),.39,.018,steel,'X')
cyl('Pump volute',(.40,0,.72),.50,.39,edge,'X',40)
pipe('Outlet riser',[(.52,0,.9),(.52,0,1.48),(.8,0,1.65),(1.2,0,1.65)],.13,olive)
for x in [.72,1.11]:tube('Bolted outlet flange',(x,0,1.65),.18,.03,steel,'X')
for s in [-1,1]:box('Motor mount',(s*.75,0,.37),(.29,.85,.29),steel,.01)
tube('Valve wheel',(.55,-.35,1.50),.21,.021,red,'Y')
for a in [0,math.pi/2]:o=box('Wheel spoke',(.55,-.35,1.5),(.39,.023,.024),red,.005);o.rotation_euler.y=a
export('map-pump')

box('Generator base',(0,0,.18),(3.0,1.7,.36),steel,.05)
box('Generator enclosure',(0,0,1.05),(2.65,1.45,1.50),olive,.065)
for s in [-1,1]:
    for i in range(13):box('Cooling grille',(s*1.331,-.5+i*.082,1.10),(.016,.040,1.01),rubber,.004)
box('Control enclosure',(0,-.752,1.18),(.9,.055,.54),steel,.025)
for i in range(3):cyl('Generator dial',(-.27+i*.27,-.794,1.24),.08,.016,cream,'Y')
text('BW / AUXILIARY POWER',(0,-.793,.93),.065,white)
pipe('Exhaust stack',[(.78,.35,1.75),(.78,.35,2.28),(.45,.35,2.48)],.087,steel)
export('map-generator')

box('Isolation bed plinth',(0,0,.2),(1.4,2.1,.4),steel,.035)
box('Treatment bed',(0,0,.66),(.95,1.8,.21),white,.055)
for s in [-1,1]:
    pipe('Bed rail',[(s*.57,-.75,.61),(s*.57,-.75,1.06),(s*.57,.75,1.06),(s*.57,.75,.61)],.027,edge)
box('Headrest',(0,.60,.82),(.60,.36,.18),olive,.06)
pipe('IV stand',[(.78,.75,.10),(.78,.75,2.15),(.55,.75,2.15)],.023,edge)
cyl('IV reservoir',(.56,.75,1.95),.071,.27,cyan)
export('map-medbay')

for s in [-1,1]:
    box('Gate pier',(s*2.36,0,1.65),(.28,.55,3.3),steel,.025)
    for z in [.35,1.25,2.25]:box('Pier collar',(s*2.36,0,z),(.36,.64,.10),edge,.005)
box('Gate lintel',(0,0,3.3),(5,.60,.25),steel,.025)
for i in range(9):box('Lintel hazard panel',(-1.8+i*.45,-.313,3.29),(.22,.012,.15),reflective if 'reflective' in globals() else brass,.002)
text('BLACKWATER / ACCESS CONTROL',(0,-.32,3.26),.10,white)
export('map-gate-frame')

box('Relay base',(0,0,.2),(1.75,1.75,.4),steel,.04)
for s in [-1,1]:
    for t in [-1,1]:
        pipe('Mast leg',[(s*.65,t*.65,.4),(s*.27,t*.27,5)],.065,edge)
for z in [.8,1.7,2.6,3.5,4.4]:
    width=.65-(z/5)*.38
    for s in [-1,1]:pipe('Lattice brace',[(-width,s*width,z),(width,s*width,z+.55)],.025,steel)
cyl('Antenna',(.0,0,5.25),.035,.75,edge)
for z in [4.7,5.0,5.3]:cyl('Antenna crossbar',(0,0,z),.015,1.5,edge,'X')
export('map-relay')
bpy.context.window.scene=previous
print('Exported 5 original weapons, 3 perk machines and 5 environment kit assets with editable .blend sources')
