
import bpy
import json
import time
import urllib.request
import mathutils

exportFrame = 1

# export obj

class TroveModel():
    def __init__(self, modelJSON=None):
        self.meshObjects = {}  # meshID => Object(ID) with .data containing mesh

        if modelJSON:
            self.importJSON(modelJSON)

    def importJSON(self, modelJSON):
        self.diameter = modelJSON["metadata"]["diameter"]

        for meshDef in modelJSON["meshes"]:
            tmesh = TroveMesh(meshDef)
            self.meshObjects[tmesh.name] = tmesh

        for op in modelJSON["operators"]:
            parsedOp = TroveOperator(op)
            self.meshObjects[parsedOp.mesh].registerOperator(parsedOp)

    def importFile(self, localPath):
        f = open(localPath, "r")
        self.importJSON(json.loads(f.read()))



    def importURL(self, modelURL):
        response = urllib.request.urlopen(modelURL)
        data = response.read()
        self.importJSON(json.loads(data.decode('utf-8')))

    def getDefaultVisible(self):
        channelDefault = {}
        for meshID, tMesh in self.meshObjects.items():
            channelID = tMesh.channel
            if channelID not in channelDefault:
                channelDefault[channelID] = meshID
        return list(channelDefault.values())


    def generateExportMesh(self, size, visible, weights, enableRender, importBucket):
        """ this is destructive, mesh data is broken and needs to be reset """

        visibleObjects = []
        if not visible:
            visible = self.getDefaultVisible()

        for meshID, tMesh in self.meshObjects.items():
            if meshID in visible:
                tMesh.bakeWeightedOperators(weights)
                visibleObjects.append(tMesh.blendObject)

        sizeCategory, sizeValue = parseSize(size)
        if sizeCategory == "necklace" and enableRender:
            tmesh = downloadChainMesh(importBucket)
            visibleObjects.append(tmesh.blendObject)

        if len(visibleObjects) == 0:
            raise Exception("Error: No visible objects to export. Make sure mesh IDs in the visible list parameter match the json.")

        finalMeshObject = combineObjects(visibleObjects)
        applyScale(finalMeshObject, size, self.diameter)
        if enableRender:
            offset = calculateOffset(finalMeshObject)
            finalMeshObject.location.y += offset
            applyLocRotScale(finalMeshObject)

            finalMeshObject.data.calc_normals()
        return finalMeshObject


def calculateOffset(obj):
    minValue = float("inf")
    for v in obj.data.vertices:
        if v.co.y < minValue:
            minValue = v.co.y
    return -minValue


def applyLocRotScale(obj):
    context = bpy.context.copy()
    context["scene"] = bpy.context.scene
    context["active_object"] = obj

    bpy.ops.object.transform_apply(context, location=True, rotation=False, scale=False)


class TroveMesh():
    def __init__(self, meshDef):
        self.parseMeta(meshDef)
        self.parseBlendMesh(meshDef)
        self.blendObject = addToScene(self.blendMesh)
        self.operators = {}  # operatorID => representation of operators
        # self.source = meshDef


    def registerOperator(self, parsedOp):
        self.operators[parsedOp.name] = parsedOp


    def bakeWeightedOperators(self, weights):
        """ alter this mesh's vertex data to get straightforward output """
        for operatorID, op in self.operators.items():
            if operatorID not in weights:
                normalizedValue = 0
            else:
                normalizedValue = weights[operatorID]

            weightRange = op.maxWeight - op.minWeight
            operatorValue = op.minWeight + (weightRange * normalizedValue)
            op.applyToMesh(operatorValue, self.blendMesh)

    def parseMeta(self, meshDef):
        # FIXME: update old models to make interface consistent, or custom handling based on version number

        meshID = meshDef["id"]
        if meshID == "Cube":
            meshID = "Cube-Alternate"

        self.name = meshID
        self.channel = meshDef["channelID"]
        self.numVerts = meshDef["numvertices"]
        self.numFaces = meshDef["numtriangles"]


    def parseBlendMesh(self, meshDef):
        rawVertexData = meshDef["vertices"]
        rawFaceData = meshDef["triangles"]

        # this method seems inefficient, figure out importing numpy library to get following lines to work
        # verts = numpy.reshape(rawVertexData, (-1, 3))
        # faces = numpy.reshape(rawFacexData, (-1, 3))
        verts = []
        faces = []
        for i in range(self.numVerts):
            j = i * 3
            verts.append((rawVertexData[j], rawVertexData[j + 1], rawVertexData[j + 2]))

        for i in range(self.numFaces):
            j = i * 3
            faces.append((rawFaceData[j], rawFaceData[j + 1], rawFaceData[j + 2]))

        newMesh = bpy.data.meshes.new(self.name)
        newMesh.from_pydata(verts,[],faces)

        newMesh.update(calc_tessface=True)  # calc_edges=True
        self.blendMesh = newMesh
        return newMesh



class TroveOperator():
    def __init__(self, operatorDef):
        self.name = operatorDef["id"]
        self.type = operatorDef["type"]
        self.mesh = operatorDef["mesh"]
        self.minWeight = operatorDef.get("minWeight", 0)
        self.maxWeight = operatorDef.get("maxWeight", 1)

        # hack because of initial cube
        if self.mesh == "Cube":
            self.mesh = "Cube-Alternate"

        params = operatorDef["parameters"]
        disps = params["displacements"]

        self.displacements = []
        for i in range(params["modifiedCount"]):
            j = i * 3
            index = params["indices"][i]
            disp = mathutils.Vector((disps[j], disps[j+1], disps[j+2]))
            self.displacements.append((index, disp))

    def applyToMesh(self, value, mesh):
        for index, disp in self.displacements:
            mesh.vertices[index].co.x += disp.x * value
            mesh.vertices[index].co.y += disp.y * value
            mesh.vertices[index].co.z += disp.z * value


def downloadChainMesh(bucketName):
    chainURL = "https://storage.googleapis.com/"+bucketName+"/models/necklace_chain.json"
    response = urllib.request.urlopen(chainURL)
    data = response.read()
    modelJSON = json.loads(data.decode('utf-8'))
    return TroveMesh(modelJSON["meshes"][0])


def addToScene(mesh, location=(0, 0, 0)):
    newObject = bpy.data.objects.new(mesh.name, mesh)
    newObject.location = location
    bpy.context.scene.objects.link(newObject)
    return newObject


def dumpObjectMesh(obj):
    print("Printing: ", obj.name)
    for v in obj.data.vertices:
        print(v.co)


def dumpObjectMeshShapes(obj):
    print("Printing shapes for: ", obj.name)
    for keyblock in obj.data.shape_keys.key_blocks:
        print("Block ",keyblock.name)
        for v in keyblock.data:
            print(v.co)


def parseSize(size):
    parts = size.split("_")
    return parts[0], parts[1]

def applyScale(obj, size, originalDiameter):
    sizeCategory, sizeValue = parseSize(size)
    targetDiameter = 1

    if sizeCategory == "ring":
        targetDiameter = .825 * float(sizeValue) + 11.6
    elif sizeCategory == "bracelet":
        # bracelet_1 maps to "Extra Small" which is 55mm, with 5mm increment between sizes
        targetDiameter = 5 * int(sizeValue) + 50
    elif sizeCategory == "necklace":
        return
        # more consistent method but does unnecessary and expensive scaling operation
        # targetDiameter = originalDiameter
    else:
        print("Invalid category for sizing purpose: ", sizeCategory)

    scaleFactor = targetDiameter / originalDiameter
    print("Desired diameter of {0}; scaling original diameter {1} up by a factor of {2}".format(targetDiameter, originalDiameter, scaleFactor))

    for v in obj.data.vertices:
        v.co = v.co * scaleFactor


def processExport(downloadURL, exportPath, size, visible, weights, enableRender, importBucket):
    start = time.clock()

    tModel = TroveModel()
    tModel.importURL(downloadURL)
    finalMesh = tModel.generateExportMesh(size, visible, weights, enableRender, importBucket)
    exportOBJLite([finalMesh], exportPath, enableRender)

    duration = start - time.clock()
    return {"completed": True, "duration": duration, "fileName": exportPath}


# seems like modifier application affects active (unverified)
# delete affects the selected object
def combineObjects(objects):
    if len(objects) == 0:
        return None

    if len(objects) == 1:
        return objects[0]

    unionMesh = bpy.data.meshes.new("union")
    unionObject = bpy.data.objects.new("union", unionMesh)

    # Set location and scene of object
    unionObject.location = objects[0].location
    bpy.context.scene.objects.link(unionObject)

    # union second element with original
    # thank you liero: http://blenderartists.org/forum/showthread.php?243680-Scripting-with-Boolean-Modifiers-Blender-2-6
    for ob in objects:
        unionObject.modifiers.new("bool", type='BOOLEAN')
        unionObject.modifiers["bool"].operation = 'UNION'
        unionObject.modifiers["bool"].object = ob

        selectOnly(unionObject)
        bpy.ops.object.modifier_apply(apply_as='DATA', modifier="bool")

    return unionObject


def selectOnly(obj=None):
    for ob in bpy.context.scene.objects:
        ob.select = False

    if not obj:
        return

    obj.select = True
    bpy.context.scene.objects.active = obj


def name_compat(name):
    if name is None:
        return 'None'
    else:
        return name.replace(' ', '_')


def veckey3d(v):
    return round(v.x, 4), round(v.y, 4), round(v.z, 4)


def veckey2d(v):
    return round(v[0], 4), round(v[1], 4)


def exportOBJLite(objects, exportPath, enableRender):
    fh = open(exportPath, "w")
    fw = fh.write

    EXPORT_GLOBAL_MATRIX = mathutils.Matrix()
    EXPORT_NORMALS = enableRender
    EXPORT_SMOOTH_GROUPS = enableRender
    EXPORT_APPLY_MODIFIERS = False

    EXPORT_SMOOTH_GROUPS_BITFLAGS = False
    EXPORT_KEEP_VERT_ORDER = False
    EXPORT_BLEN_OBS = False
    EXPORT_GROUP_BY_OB = False
    EXPORT_POLYGROUPS = False
    EXPORT_GROUP_BY_MAT = False
    EXPORT_MTL = False

    mtl_dict = {}
    mtl_rev_dict = {}

    # Initialize totals, these are updated each object
    totverts = totuvco = totno = 1

    face_vert_index = 1
    scene = bpy.context.scene

    for i, ob_main in enumerate(objects):
        # ignore dupli children
        if ob_main.parent and ob_main.parent.dupli_type in {'VERTS', 'FACES'}:
            # XXX
            continue

        obs = []
        if ob_main.dupli_type != 'NONE':
            # XXX
            print('creating dupli_list on', ob_main.name)
            ob_main.dupli_list_create(scene)

            obs = [(dob.object, dob.matrix) for dob in ob_main.dupli_list]

            # XXX debug print
            print(ob_main.name, 'has', len(obs), 'dupli children')
        else:
            obs = [(ob_main, ob_main.matrix_world)]
        for ob, ob_mat in obs:
            uv_unique_count = no_unique_count = 0

            try:
                me = ob.to_mesh(scene, EXPORT_APPLY_MODIFIERS, 'PREVIEW')
            except RuntimeError:
                me = None

            if me is None:
                print("Not continuing execution")
                continue

            me.transform(EXPORT_GLOBAL_MATRIX * ob_mat)

            # _must_ do this first since it re-allocs arrays
            mesh_triangulate(me)

            faceuv = False

            me_verts = me.vertices[:]

            face_index_pairs = [(face, index) for index, face in enumerate(me.polygons)]

            edges = []
            if not (len(face_index_pairs) + len(edges) + len(me.vertices)):  # Make sure there is something to write
                # clean up
                bpy.data.meshes.remove(me)
                continue  # dont bother with this mesh.

            if EXPORT_NORMALS and face_index_pairs:
                for p in me.polygons:
                        p.use_smooth = True
                me.calc_normals_split()
                # No need to call me.free_normals_split later, as this mesh is deleted anyway!
                loops = me.loops
            else:
                loops = []

            EXPORT_SMOOTH_GROUPS = False # not sure if this is needed
            if (EXPORT_SMOOTH_GROUPS or EXPORT_SMOOTH_GROUPS_BITFLAGS) and face_index_pairs:
                smooth_groups, smooth_groups_tot = me.calc_smooth_groups(EXPORT_SMOOTH_GROUPS_BITFLAGS)
                if smooth_groups_tot <= 1:
                    smooth_groups, smooth_groups_tot = (), 0
            else:
                smooth_groups, smooth_groups_tot = (), 0
            materials = me.materials[:]
            material_names = [m.name if m else None for m in materials]

            # avoid bad index errors
            if not materials:
                materials = [None]
                material_names = [name_compat(None)]

            # FIXME: won't need to sort by materials or texture, but verify smoothing
            # Sort by Material, then images
            # so we dont over context switch in the obj file.
            if EXPORT_KEEP_VERT_ORDER:
                pass
            else:
                if faceuv:
                    if smooth_groups:
                        sort_func = lambda a: (a[0].material_index,
                                                hash(uv_texture[a[1]].image),
                                                smooth_groups[a[1]] if a[0].use_smooth else False)
                    else:
                        sort_func = lambda a: (a[0].material_index,
                                                hash(uv_texture[a[1]].image),
                                                a[0].use_smooth)
                elif len(materials) > 1:
                    if smooth_groups:
                        sort_func = lambda a: (a[0].material_index,
                                                smooth_groups[a[1]] if a[0].use_smooth else False)
                    else:
                        sort_func = lambda a: (a[0].material_index,
                                                a[0].use_smooth)
                else:
                    # no materials
                    if smooth_groups:
                        sort_func = lambda a: smooth_groups[a[1] if a[0].use_smooth else False]
                    else:
                        sort_func = lambda a: a[0].use_smooth

                face_index_pairs.sort(key=sort_func)

                del sort_func

            # Set the default mat to no material and no image.
            contextMat = 0, 0  # Can never be this, so we will label a new material the first chance we get.
            contextSmooth = None  # Will either be true or false,  set bad to force initialization switch.

            if EXPORT_BLEN_OBS or EXPORT_GROUP_BY_OB:
                name1 = ob.name
                name2 = ob.data.name
                if name1 == name2:
                    obnamestring = name_compat(name1)
                else:
                    obnamestring = '%s_%s' % (name_compat(name1), name_compat(name2))

                if EXPORT_BLEN_OBS:
                    fw('o %s\n' % obnamestring)  # Write Object name
                else:  # if EXPORT_GROUP_BY_OB:
                    fw('g %s\n' % obnamestring)

            # Vert
            for v in me_verts:
                fw('v %.6f %.6f %.6f\n' % v.co[:])

            # NORMAL, Smooth/Non smoothed.
            if EXPORT_NORMALS:
                no_key = no_val = None
                normals_to_idx = {}
                no_get = normals_to_idx.get
                loops_to_normals = [0] * len(loops)
                for f, f_index in face_index_pairs:
                    for l_idx in f.loop_indices:
                        no_key = veckey3d(loops[l_idx].normal)
                        no_val = no_get(no_key)
                        if no_val is None:
                            no_val = normals_to_idx[no_key] = no_unique_count
                            fw('vn %.6f %.6f %.6f\n' % no_key)
                            no_unique_count += 1
                        loops_to_normals[l_idx] = no_val
                del normals_to_idx, no_get, no_key, no_val
            else:
                loops_to_normals = []

            if not faceuv:
                f_image = None

            for f, f_index in face_index_pairs:
                f_smooth = f.use_smooth
                if f_smooth and smooth_groups:
                    f_smooth = smooth_groups[f_index]
                f_mat = min(f.material_index, len(materials) - 1)

                if faceuv:
                    tface = uv_texture[f_index]
                    f_image = tface.image

                # MAKE KEY
                if faceuv and f_image:  # Object is always true.
                    key = material_names[f_mat], f_image.name
                else:
                    key = material_names[f_mat], None  # No image, use None instead.

                # Write the vertex group
                if EXPORT_POLYGROUPS:
                    if vertGroupNames:
                        # find what vertext group the face belongs to
                        vgroup_of_face = findVertexGroupName(f, vgroupsMap)
                        if vgroup_of_face != currentVGroup:
                            currentVGroup = vgroup_of_face
                            fw('g %s\n' % vgroup_of_face)

                # CHECK FOR CONTEXT SWITCH
                if key == contextMat:
                    pass  # Context already switched, dont do anything
                else:
                    if key[0] is None and key[1] is None:
                        # Write a null material, since we know the context has changed.
                        if EXPORT_GROUP_BY_MAT:
                            # can be mat_image or (null)
                            fw("g %s_%s\n" % (name_compat(ob.name), name_compat(ob.data.name)))
                        if EXPORT_MTL:
                            fw("usemtl (null)\n")  # mat, image

                    else:
                        mat_data = mtl_dict.get(key)
                        if not mat_data:
                            # First add to global dict so we can export to mtl
                            # Then write mtl

                            # Make a new names from the mat and image name,
                            # converting any spaces to underscores with name_compat.

                            # If none image dont bother adding it to the name
                            # Try to avoid as much as possible adding texname (or other things)
                            # to the mtl name (see [#32102])...
                            mtl_name = "%s" % name_compat(key[0])
                            if mtl_rev_dict.get(mtl_name, None) not in {key, None}:
                                if key[1] is None:
                                    tmp_ext = "_NONE"
                                else:
                                    tmp_ext = "_%s" % name_compat(key[1])
                                i = 0
                                while mtl_rev_dict.get(mtl_name + tmp_ext, None) not in {key, None}:
                                    i += 1
                                    tmp_ext = "_%3d" % i
                                mtl_name += tmp_ext
                            mat_data = mtl_dict[key] = mtl_name, materials[f_mat], f_image
                            mtl_rev_dict[mtl_name] = key

                        if EXPORT_GROUP_BY_MAT:
                            # can be mat_image or (null)
                            fw("g %s_%s_%s\n" % (name_compat(ob.name), name_compat(ob.data.name), mat_data[0]))
                        if EXPORT_MTL:
                            fw("usemtl %s\n" % mat_data[0])  # can be mat_image or (null)

                contextMat = key
                if f_smooth != contextSmooth:
                    if f_smooth:  # on now off
                        if smooth_groups:
                            f_smooth = smooth_groups[f_index]
                            fw('s %d\n' % f_smooth)
                        else:
                            fw('s 1\n')
                    else:  # was off now on
                        fw('s off\n')
                    contextSmooth = f_smooth

                f_v = [(vi, me_verts[v_idx], l_idx)
                        for vi, (v_idx, l_idx) in enumerate(zip(f.vertices, f.loop_indices))]

                fw('f')
                if faceuv:
                    if EXPORT_NORMALS:
                        for vi, v, li in f_v:
                            fw(" %d/%d/%d" % (totverts + v.index,
                                                totuvco + uv_face_mapping[f_index][vi],
                                                totno + loops_to_normals[li],
                                                ))  # vert, uv, normal
                    else:  # No Normals
                        for vi, v, li in f_v:
                            fw(" %d/%d" % (totverts + v.index,
                                            totuvco + uv_face_mapping[f_index][vi],
                                            ))  # vert, uv

                    face_vert_index += len(f_v)

                else:  # No UV's
                    if EXPORT_NORMALS:
                        for vi, v, li in f_v:
                            fw(" %d//%d" % (totverts + v.index, totno + loops_to_normals[li]))
                    else:  # No Normals
                        for vi, v, li in f_v:
                            fw(" %d" % (totverts + v.index))

                fw('\n')

            # Make the indices global rather then per mesh
            totverts += len(me_verts)
            totuvco += uv_unique_count
            totno += no_unique_count

            # clean up
            bpy.data.meshes.remove(me)

    if ob_main.dupli_type != 'NONE':
        ob_main.dupli_list_clear()
    fh.close()


def mesh_triangulate(me):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()


def testImport():
    bigArg = '{"enableRender":false,"modelURL":"https://storage.googleapis.com/troveup-dev-private/models/square_closed_necklace.json","localPath":"./var/tempfile-1445538628003000.obj","size":"necklace_1","visible":["primary___square","static-objects___bail"],"operators":[]}'
    unpackInvocation(json.loads(bigArg))


# looks at the init json
def unpackInvocation(opts):
    modelurl = opts["modelURL"]
    size = opts["size"]
    visible = opts["visible"]
    localPath = opts["localPath"]
    operators = opts["operators"]
    enableRender = opts["enableRender"]
    importBucket = opts["importBucket"]

    # convert to hashmap: operatorID => value
    weights = {}
    for w in operators:
        weights[w["id"]] = float(w["value"])

    processExport(modelurl, localPath, size, visible, weights, enableRender, importBucket)


if __name__ == '__main__':

    import sys
    argv = sys.argv
    if "--" in argv:
        # only want to keep args after "--"
        argv = argv[argv.index("--") + 1:]

    if "--stdin" in argv:
        argString = sys.stdin.read()
    else:
        argString = argv[0]

    unpackInvocation(json.loads(argString))
