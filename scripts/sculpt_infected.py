"""Original Blackwater infected character, authored entirely in Blender.
No external models, textures, reference meshes or generation services.
Usage: Blender MCP exec this file with __file__ set, or blender -b -P this file.
"""
import bpy, math, os, random, numpy as np
from mathutils import Vector
from mathutils.noise import noise_vector
random.seed(731)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
OUT=os.path.join(ROOT,'public','assets')
SOURCE=os.path.join(ROOT,'art')
os.makedirs(SOURCE,exist_ok=True)
previous=bpy.context.window.scene
scene=bpy.data.scenes.new('QZ_Original_Infected_Sculpt')
bpy.context.window.scene=scene
parts=[]

# Original, generated image textures: mottling, capillary patterns, fabric weave.
def texture(name,kind,size=1024):
    y,x=np.mgrid[0:size,0:size]/size
    rng=np.random.default_rng(731)
    n=np.zeros((size,size),dtype=np.float32)
    # Isotropic fractal value noise, without the grid/plaid artifacts of sine noise.
    for f,a in [(5,.16),(13,.10),(31,.075),(79,.040),(191,.018)]:
        grid=rng.uniform(-1,1,(f+1,f+1));gx=x*f;gy=y*f;ix=gx.astype(int);iy=gy.astype(int);tx=gx-ix;ty=gy-iy
        tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty)
        value=grid[iy,ix]*(1-tx)*(1-ty)+grid[iy,ix+1]*tx*(1-ty)+grid[iy+1,ix]*(1-tx)*ty+grid[iy+1,ix+1]*tx*ty
        n+=value*a
    n+=rng.normal(0,.014,(size,size))
    if kind=='skin':
        base=np.array([.39,.40,.335]);rgb=np.clip(base+n[...,None]*np.array([.8,.7,.6]),0,1)
        patches=np.maximum(0,-n-.06)*1.9;rgb-=patches[...,None]*np.array([.10,.31,.22])
    elif kind=='cloth':
        weave=(np.cos(x*size*math.pi)*np.cos(y*size*math.pi))*.008
        rgb=np.clip(np.array([.15,.20,.19])+(n+weave)[...,None]*np.array([.15,.19,.15]),0,1)
        grime=np.maximum(0,n-.15);rgb-=grime[...,None]*.2
    else:
        rgb=np.clip(np.array([.22,.25,.23])+n[...,None]*.15,0,1)
    rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=rgb
    image=bpy.data.images.new('QZ_Original_'+name,width=size,height=size)
    image.pixels.foreach_set(rgba.ravel());image.pack()
    height=n+rng.normal(0,.012,(size,size));dy,dx=np.gradient(height)
    normal=np.ones((size,size,4),dtype=np.float32);normal[:,:,:3]=np.stack([-dx*2,-dy*2,np.ones_like(dx)],axis=-1);normal[:,:,:3]/=np.linalg.norm(normal[:,:,:3],axis=-1)[...,None];normal[:,:,:3]=normal[:,:,:3]*.5+.5
    bump=bpy.data.images.new('QZ_Original_'+name+'_Normal',width=size,height=size);bump.colorspace_settings.name='Non-Color';bump.pixels.foreach_set(normal.ravel());bump.pack();image['normal_name']=bump.name
    return image
skin_image=texture('Skin_Mottling','skin')
cloth_image=texture('Worn_Weave','cloth')
pants_image=texture('Trouser_Canvas','pants')

def mat(name,color,rough=.65,metal=0,image=None,glow=0):
    m=bpy.data.materials.new('QZ2_'+name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if image:
        t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image;m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
        nt=m.node_tree.nodes.new('ShaderNodeTexImage');nt.image=bpy.data.images[image['normal_name']];nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.7;m.node_tree.links.new(nt.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    if glow:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=glow
    return m
skin=mat('ashen_skin',(.49,.48,.39),.69,image=skin_image)
cloth=mat('station_jacket',(.15,.20,.19),.88,image=cloth_image)
pants=mat('canvas_trousers',(.22,.25,.23),.92,image=pants_image)
boot=mat('boot_leather',(.033,.039,.033),.63)
sole=mat('boot_sole',(.015,.020,.019),.9)
scar=mat('scar_tissue',(.235,.095,.069),.77)
mouthmat=mat('mouth_cavity',(.035,.009,.008),.56)
lip=mat('desiccated_lips',(.225,.165,.123),.74)
ivory=mat('stained_teeth',(.38,.34,.20),.57)
eye=mat('clouded_cornea',(.22,.25,.17),.27)
iris=mat('mutated_iris',(.42,.22,.035),.3,glow=.12)
pupil=mat('pupil',(.012,.016,.009),.14)
metal=mat('tarnished_hardware',(.20,.23,.21),.38,.75)
reflective=mat('weathered_safety_tape',(.64,.60,.32),.57,.2)
seam=mat('stitching',(.29,.33,.27),.96)

def finish(o,name,material,bone='spine',uv=True):
    o.name=name;o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=True
    o['qz_bone']=bone;parts.append(o)
    if uv and not o.data.uv_layers:
        bpy.context.view_layer.objects.active=o;o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.1,island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
    o.select_set(False);return o
def mesh(name,verts,faces,material,bone='spine',uvcoords=None):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);scene.collection.objects.link(o)
    if uvcoords:
        layer=d.uv_layers.new(name='UVMap')
        for face in d.polygons:
            for loop in face.loop_indices:layer.data[loop].uv=uvcoords[d.loops[loop].vertex_index]
    return finish(o,name,material,bone)
def ellipsoid(name,loc,scale,material,bone='head',segments=32,rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,material,bone)
def box(name,loc,dim,material,bone='spine',bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Rounded worn edges','BEVEL');mod.width=bevel;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,material,bone)
def curve(name,points,radius,material,bone='head'):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=3;c.bevel_depth=radius;c.bevel_resolution=2;c.use_fill_caps=True
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,name,material,bone)
def loft(name,rings,material,bone='spine',count=48,fold=0,face_sculpt=None):
    # Rings are (z, centre-x, centre-y, horizontal-radius, depth-radius).
    verts=[];uv=[];faces=[]
    for j,(z,cx,cy,rx,ry) in enumerate(rings):
        for i in range(count+1):
            a=i/count*math.tau;f=1+fold*(math.sin(a*7+z*49)*.5+math.sin(a*11-z*34)*.3)
            x=cx+rx*math.sin(a)*f;y=cy-ry*math.cos(a)*f
            zz=z
            if face_sculpt:y,zz=face_sculpt(x,y,z,a)
            verts.append((x,y,zz));uv.append((i/count,j/(len(rings)-1)))
            if j<len(rings)-1 and i<count:
                b=j*(count+1)+i;faces.append((b,b+1,b+count+2,b+count+1))
    faces.extend([tuple(range(count,-1,-1)),tuple((len(rings)-1)*(count+1)+i for i in range(count+1))])
    return mesh(name,verts,faces,material,bone,uv)
def dense_rings(keys,steps=4):
    result=[]
    for a,b in zip(keys,keys[1:]):
        for i in range(steps):
            t=i/steps;result.append(tuple(v*(1-t)+w*t for v,w in zip(a,b)))
    result.append(keys[-1]);return result

# Sculpt the head as a continuous asymmetric surface, with recessed orbital
# cavities, cheek planes, chin, brow ridge, nasolabial folds and forehead wrinkles.
def face_sculpt(x,y,z,a):
    front=max(0,math.cos(a))**8
    def g(cx,cz,sx,sz):return math.exp(-((x-cx)/sx)**2-((z-cz)/sz)**2)
    d=0
    for side in [-1,1]:
        d+=.032*g(side*.049,1.757,.028,.020) # orbital recess
        d-=.017*g(side*.047,1.783,.041,.011) # brow shelf
        d-=.012*g(side*.073,1.712,.024,.017) # cheekbone
        d+=.015*g(side*.060,1.675,.025,.026) # gaunt cheek
        d+=.006*g(side*.032,1.690,.010,.026) # nose/mouth fold
    d-=.040*g(0,1.731,.018,.043) # bridge and nose
    d-=.012*g(0,1.599,.039,.017) # chin prominence
    d+=.030*g(.002,1.651,.060,.023) # mouth hollow
    d+=.0025*math.sin(z*500+x*15)*g(0,1.811,.085,.016)
    d+=.0012*math.sin(x*450+z*310)*math.sin(z*510)
    return y+d*front,z+.002*math.sin(a*3)
headkeys=[(1.575,0,-.025,.040,.042),(1.60,0,-.027,.070,.067),(1.64,0,-.016,.090,.083),(1.69,0,-.006,.101,.092),(1.735,0,0,.110,.096),(1.775,0,.006,.110,.104),(1.81,0,.010,.110,.102),(1.845,0,.014,.090,.087),(1.875,0,.016,.048,.047),(1.885,0,.016,.005,.008)]
head=loft('Sculpted cranium and facial planes',dense_rings(headkeys,6),skin,'head',96,face_sculpt=face_sculpt)
loft('Neck with sternomastoid tendons',dense_rings([(1.43,0,.015,.082,.071),(1.49,0,.002,.063,.058),(1.56,0,-.006,.053,.058),(1.60,0,-.01,.061,.060)],6),skin,'neck',40,fold=.035)
for s in [-1,1]:
    curve('Neck tendon',[(s*.062,-.052,1.445),(s*.036,-.058,1.51),(s*.045,-.049,1.575)],.006,skin,'neck')
    ellipsoid('Sunken eye',(s*.047,-.078,1.757),(.021,.017,.009),eye)
    ellipsoid('Amber iris',(s*.047,-.0945,1.757),(.006,.002,.0055),iris,segments=24,rings=12)
    ellipsoid('Vertical pupil',(s*.047,-.0965,1.758),(.0028,.001,.0045),pupil,segments=16,rings=12)
    curve('Heavy angled supraorbital ridge',[(s*.022,-.097,1.769),(s*.046,-.098,1.779),(s*.071,-.084,1.781)],.005,skin)
    for upper in [True,False]:
        pts=[]
        for i in range(13):
            a=i/12*math.pi;pts.append((s*.047+.023*math.cos(a),-.093-.003*math.sin(a),1.757+(.009 if upper else -.008)*math.sin(a)+s*.003*math.cos(a)))
        curve('Orbital eyelid',pts,.003,skin)
    # A shaped helix, concha and tragus make each ear readable at close range.
    ellipsoid('Ear cartilage',(s*.109,.012,1.743),(.024,.014,.043),skin)
    ellipsoid('Ear concha',(s*.119,-.001,1.747),(.011,.004,.024),lip)
    curve('Ear helix',[(s*.110,-.002,1.710),(s*.130,-.002,1.736),(s*.129,.005,1.773),(s*.112,.008,1.782)],.005,skin)
    ellipsoid('Nostril wing',(s*.017,-.124,1.712),(.014,.014,.009),skin)
    ellipsoid('Nostril',(s*.016,-.134,1.708),(.006,.003,.0035),mouthmat,segments=16,rings=10)
ellipsoid('Nose tip',(0,-.137,1.718),(.020,.018,.013),skin)
# Open mouth, irregular lip edges and individually modelled damaged teeth.
ellipsoid('Recessed oral cavity',(.002,-.079,1.648),(.057,.016,.020),mouthmat)
for upper in [True,False]:
    points=[]
    for i in range(17):
        x=-.056+i*.007;arch=math.sqrt(max(0,1-(x/.056)**2));z=1.650+(.018 if upper else -.018)*arch+.002*math.sin(i*2)
        points.append((x,-.093-.009*(1-arch),z))
    curve('Split upper lip' if upper else 'Dry lower lip',points,.0035,lip)
for i in range(9):
    x=(i-4)*.0105
    if i in [2,7]:continue
    o=box('Individual upper tooth',(x,-.094,1.660+random.uniform(-.001,.001)),(.0075,.008,.009-random.random()*.003),ivory,'head',.0015);o.rotation_euler.y=random.uniform(-.22,.22)
for i in [0,1,3,4,6]:box('Individual lower tooth',((i-3)*.012,-.094,1.638),(.0075,.008,.005),ivory,'head',.0015)
# Asymmetric healed lacerations on scalp and cheek; fine branching veins.
for s in [-1,1]:
    curve('Temple vein',[(s*.094,-.05,1.823),(s*.091,-.063,1.803),(s*.084,-.071,1.787)],.0012,lip)
curve('Scalp scar',[(-.025,-.064,1.857),(-.009,-.076,1.842),(.009,-.082,1.829),(.017,-.088,1.810)],.003,scar)
for i in range(6):curve('Scar stitch',[(i*.007-.025,-.085-i*.001,1.832-i*.003),(i*.007-.020,-.087-i*.001,1.842-i*.003)],.0013,lip)
curve('Cheek laceration',[(.081,-.080,1.719),(.070,-.085,1.700),(.058,-.084,1.683)],.003,scar)

# Work jacket: a continuous tailored silhouette, wrinkles, seams and loose hem.
torso=loft('Wrinkled station jacket',dense_rings([( .91,0,.026,.160,.097),(.96,0,.026,.171,.102),(1.06,0,.020,.151,.097),(1.17,0,.023,.174,.119),(1.29,0,.030,.203,.130),(1.40,0,.034,.216,.118),(1.46,0,.033,.185,.094),(1.49,0,.020,.077,.071)],5),cloth,'spine',64,fold=.046)
loft('Jacket lower seam',[(.921,0,.026,.166,.100),(.932,0,.026,.166,.100)],seam,'spine',64,fold=.04)
for s in [-1,1]:
    # Angled collar lapels have thickness and cloth seams.
    collar=mesh('Folded jacket collar',[(s*.061,-.052,1.51),(s*.112,-.079,1.451),(s*.080,-.116,1.397),(s*.019,-.096,1.465)],[(0,1,2,3)],cloth)
    sol=collar.modifiers.new('Fabric thickness','SOLIDIFY');sol.thickness=.004;bpy.context.view_layer.objects.active=collar;collar.select_set(True);bpy.ops.object.modifier_apply(modifier=sol.name);collar.select_set(False)
    curve('Collar piping',[(s*.061,-.055,1.51),(s*.11,-.082,1.451),(s*.08,-.119,1.397)],.0018,seam,'spine')
    box('Bellows chest pocket',(s*.107,-.103,1.323),(.113,.033,.13),cloth,'spine',.005)
    box('Pocket flap',(s*.107,-.125,1.367),(.12,.016,.036),cloth,'spine',.003)
    box('Pocket snap',(s*.107,-.136,1.367),(.008,.004,.008),metal,'spine',.003)
    curve('Pocket stitching',[(s*.055,-.123,1.355),(s*.055,-.123,1.27),(s*.16,-.123,1.27)],.0012,seam,'spine')
    # Safety strips broken into abraded segments.
    for j in range(5):box('Frayed reflective tape',(s*(.057+j*.031),-.104-(j<3)*.012,1.22),(.026,.006,.034),reflective,'spine',.001)
curve('Jacket zipper',[(0,-.080,.955),(.006,-.090,1.10),(.004,-.115,1.28),(0,-.101,1.43)],.003,metal,'spine')
box('Zipper pull',(.008,-.125,1.32),(.010,.006,.026),metal,'spine',.002)
# An original station ID patch, built as actual lettering.
box('Name tape',(-.108,-.131,1.40),(.13,.009,.028),boot)
def text_obj(body,loc,size,material,name):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.extrude=.0003;c.align_x='CENTER'
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,name,material,'spine')
text_obj('B.W. 07',(-.108,-.137,1.390),.017,reflective,'Blackwater identification')

# Arms and hands: tapered sleeve folds, forearm tendons, five articulated digits.
for s,label in [(-1,'L'),(1,'R')]:
    upper='upper_arm.'+label;lower='forearm.'+label;handbone='hand.'+label
    armkeys=[(1.03,s*.333,-.025,.064,.070),(1.10,s*.329,-.011,.070,.078),(1.19,s*.310,.011,.075,.079),(1.29,s*.275,.023,.080,.083),(1.40,s*.233,.031,.091,.090),(1.45,s*.215,.032,.064,.070)]
    loft('Upper sleeve '+label,dense_rings(armkeys,5),cloth,upper,40,fold=.067)
    # One ripped sleeve is rolled, the other hangs unevenly.
    bottom=.89 if s<0 else .99
    loft('Torn sleeve '+label,dense_rings([(bottom,s*.371,-.070,.051,.052),(1.0,s*.347,-.048,.060,.061),(1.10,s*.329,-.011,.066,.074)],7),cloth,lower,40,fold=.075)
    for i in range(7):
        a=i/7*math.tau;x=s*.371+.051*math.sin(a);y=-.070-.052*math.cos(a)
        curve('Loose cuff thread',[(x,y,bottom),(x+.003,y-.002,bottom-random.uniform(.008,.03))],.0011,seam,lower)
    loft('Forearm anatomy '+label,dense_rings([(.785,s*.391,-.12,.031,.030),(.84,s*.383,-.099,.037,.037),(.93,s*.363,-.064,.049,.048),(1.01,s*.343,-.040,.057,.052)],7),skin,lower,40,fold=.03)
    for n in [-1,0,1]:curve('Wrist extensor tendon',[(s*.391+n*.014,-.148,.79),(s*.383+n*.018,-.136,.85),(s*.373+n*.016,-.11,.92)],.0023,skin,lower)
    palm=loft('Palm '+label,dense_rings([(.68,s*.397,-.138,.042,.022),(.715,s*.395,-.136,.047,.025),(.759,s*.393,-.128,.039,.028),(.79,s*.391,-.12,.030,.029)],5),skin,handbone,40,fold=.025)
    for f in range(4):
        fx=s*.395+(f-1.5)*.024;length=[.070,.087,.092,.074][f]
        rings=[(.69-length,fx+s*.006,-.175,.007,.007),(.705-length*.8,fx+s*.003,-.166,.009,.009),(.705-length*.43,fx,-.149,.011,.010),(.711,fx,-.137,.0115,.012)]
        loft('Curled finger '+str(f)+' '+label,dense_rings(rings,5),skin,handbone,16,fold=.04)
        ellipsoid('Knuckle '+label,(fx,-.153,.698),(.013,.007,.012),skin,handbone,20,12)
        nail=ellipsoid('Broken fingernail',(fx+s*.006,-.182,.699-length),(.006,.002,.009),ivory,handbone,16,10)
    curve('Opposable thumb '+label,[(s*.360,-.138,.75),(s*.339,-.146,.724),(s*.334,-.165,.698)],.014,skin,handbone)
    curve('Hand vein '+label,[(s*.389,-.160,.774),(s*.389,-.161,.744),(s*.414,-.161,.713)],.0016,lip,handbone)

# Trousers, detailed combat/work boots, belt and utility equipment.
loft('Trouser seat',dense_rings([(.81,0,.032,.151,.095),(.9,0,.031,.168,.111),(.98,0,.023,.163,.105)],5),pants,'hips',56,fold=.045)
for s,label in [(-1,'L'),(1,'R')]:
    thigh='thigh.'+label;shin='shin.'+label;foot='foot.'+label
    loft('Trouser thigh '+label,dense_rings([(.49,s*.104,.008,.066,.071),(.58,s*.109,.011,.077,.083),(.73,s*.105,.023,.090,.093),(.87,s*.093,.031,.096,.102),(.92,s*.089,.030,.087,.091)],6),pants,thigh,48,fold=.060)
    loft('Trouser shin '+label,dense_rings([(.19,s*.111,.008,.055,.057),(.29,s*.112,.016,.061,.061),(.39,s*.107,.022,.065,.070),(.50,s*.104,.008,.067,.074),(.53,s*.104,.008,.068,.074)],6),pants,shin,48,fold=.080)
    for zz in [.43,.47,.52]:curve('Compressed knee fold',[(s*.104-.055,-.027,zz),(s*.104,-.067,zz-.008),(s*.104+.054,-.026,zz+.003)],.003,pants,shin if zz<.51 else thigh)
    box('Cargo pocket',(s*.184,.011,.70),(.033,.13,.15),pants,thigh,.010)
    box('Cargo pocket flap',(s*.203,.011,.753),(.012,.14,.038),cloth,thigh,.004)
    curve('Outer trouser seam',[(s*.177,.025,.82),(s*.180,.015,.69),(s*.173,.012,.54)],.0018,seam,thigh)
    box('Boot sole',(s*.111,-.061,.055),(.155,.29,.07),sole,foot,.024)
    ellipsoid('Moulded boot toe',(s*.111,-.132,.105),(.076,.11,.065),boot,foot)
    loft('Boot upper '+label,dense_rings([(.075,s*.111,-.011,.074,.088),(.15,s*.111,.005,.068,.067),(.23,s*.111,.007,.059,.059),(.28,s*.111,.007,.055,.054)],5),boot,foot,40,fold=.025)
    for i in range(5):
        z=.115+i*.026
        curve('Crossed boot lace',[(s*.111-.032,-.065,z),(s*.111+.030,-.07,z+.022)],.0025,seam,foot)
        curve('Crossed boot lace',[(s*.111+.032,-.065,z),(s*.111-.030,-.07,z+.022)],.0025,seam,foot)
    for i in range(5):box('Sole tread',(s*.111,-.17+i*.046,.030),(.158,.022,.019),sole,foot,.003)
loft('Utility belt',[(.945,0,.022,.171,.114),(.975,0,.022,.171,.114)],boot,'hips',64)
box('Belt buckle',(0,-.096,.96),(.047,.019,.038),metal,'hips',.003)
box('Buckle inset',(0,-.107,.96),(.031,.004,.022),boot,'hips',.002)
box('Utility pouch',(-.145,-.088,.944),(.082,.047,.095),boot,'hips',.012)
box('Belt radio',(.16,.015,1.006),(.059,.063,.108),boot,'hips',.009)
curve('Radio antenna',[(.16,.015,1.05),(.162,.016,1.15)],.004,boot,'hips')

# Adult cranial proportions. Keep the neck attachment fixed while narrowing the skull.
for o in parts:
    if o.get('qz_bone')=='head':
        for v in o.data.vertices:
            world=o.matrix_world@v.co;world.x*=.83;world.z=1.59+(world.z-1.59)*.91
            v.co=o.matrix_world.inverted()@world
print('QZ sculpt complete: '+str(len(parts))+' authored mesh elements. Next: armature/export.')
