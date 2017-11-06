# ##### BEGIN GPL LICENSE BLOCK #####
#
#  This program is free software; you can redistribute it and/or
#  modify it under the terms of the GNU General Public License
#  as published by the Free Software Foundation; either version 2
#  of the License, or (at your option) any later version.
#
#  This program is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU General Public License for more details.
#
#  You should have received a copy of the GNU General Public License
#  along with this program; if not, write to the Free Software Foundation,
#  Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
#
# ##### END GPL LICENSE BLOCK #####

### do we need the above notice now that we're not exporting to the same file format?

bl_info = {
    "name": "Trove Export (.json)",
    "description": "Export files in an augmented variation of the three.js mesh encoding model format ",
    "author": "mrdoob, kikko, alteredq, remoe, pxf, n3tfr34k, neuralfirings, trovadour",
    "version": (1, 0, 0),
    "blender": (2, 73, 0),
    "api": 35622,
    "location": "File > Import-Export",
    # "location": "File > Import & File > Export",
    "warning": "",
    "wiki_url": "",
    "tracker_url": "",
    "category": "Import-Export"}


import re
import bpy
import mathutils
import operator
import time
import bmesh
from datetime import datetime
from bpy_extras.io_utils import ExportHelper

def dumpObjectMeta(ob):
    print("Blend Object: {} ; active shape key = {}".format(ob.name, ob.active_shape_key_index))

def dumpObjectVertices(ob):
    for vert in ob.data.vertices:
        print(vert.co)

def dumpObjectShapeKeys(ob):
    if ob.data.shape_keys:
        for sk in ob.data.shape_keys.key_blocks:
            print('Operator "{}" : value={} out of [ {} , {} ]'.format(sk.name, sk.value, sk.slider_min, sk.slider_max))
            for v in sk.data:
                print(v.co)

def dumpObjectList(blendObjects):
    for ob in blendObjects:
        dumpObjectMeta(ob)
        dumpObjectVertices(ob)
        dumpObjectShapeKeys(ob)


def dumpVertexList(vertList):
    for vert in vertList:
        print("{0}, {1}, {2}".format(vert.co.x, vert.co.y, vert.co.z))

def dumpBlendMeshVertices(mesh):
    for vert in mesh.vertices:
        print(vert.co)

def dumpMeshVertices(mesh):
    print("Dumping mesh...")
    dumpVertexList(mesh.vertices[:])

def dumpObject(obj):
    numKeys = len(obj.data.shape_keys.key_blocks)
    for i in range(numKeys):
        print("======= data for block "+ str(i) +"=======")
        for j, blockDatum in enumerate(obj.data.shape_keys.key_blocks[i].data):
            print("vertex "+str(j) + ":")
            print(blockDatum.co)
            print(obj.data.vertices[j].co)

class ExportTroveJSON(bpy.types.Operator, ExportHelper):
    """Save a Trove format JSON file"""
    bl_idname = "object.trove_export"
    bl_label = "Trove Export zzz" # z's for quick searchability
    bl_options = {'UNDO', 'PRESET'}

    bl_space_type = 'PROPERTIES'
    bl_region_type = 'WINDOW'

    filename_ext = ".json"
    filepath = bpy.props.StringProperty(
          subtype = 'FILE_PATH'
          )

    modelCategory = bpy.props.StringProperty(
            default="ring"
            )

    subsurf_iters_browser = bpy.props.IntProperty(
            name="subsurf_iters_browser"
            )

    def execute(self, context):
        scene = context.scene

        sceneObjects = []
        for ob in bpy.context.scene.objects:
            if ob.type == 'MESH':
                ob.select = True
                sceneObjects.append(ob)
            else:
                ob.select = False

        if not sceneObjects:
            raise Exception("Error, no objects representing meshes")

        # if scene.objects.active:
            # bpy.ops.object.mode_set(mode='OBJECT')

        bpy.ops.object.shape_key_clear() # bit of a hack, insofar as I'm not currently sure why it's necessary
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True) # FIXME: I don't like scripts with subtle side effects

        export(self, context, sceneObjects)

        return {'FINISHED'}

    @staticmethod
    def menu_func(cls, blender_context):

        cls.layout.operator(
            ExportTroveJSON.bl_idname,
            text="TroveExport Operator Text"
            )

def register():
    bpy.utils.register_class(ExportTroveJSON)
    bpy.types.INFO_MT_file_export.append(ExportTroveJSON.menu_func)

def unregister():
    bpy.utils.unregister_class(ExportTroveJSON)
    bpy.types.INFO_MT_file_export.remove(ExportTroveJSON.menu_func)

def getModelCategory(modelFileName):
    if "bracelet" in modelFileName:
        return "bracelet"
    elif "ring" in modelFileName:
        return "ring"
    elif "necklace" in modelFileName:
        return "necklace"
    else:
        return "unknown"

nameExportBlacklist = ["diameter-mesh", "Necklace Chain.accessory"]

def export(operator, context, blendObjects):
    print("===== Initiating export run")
    exportTime = datetime.now().isoformat('T')
    filepath = ensure_extension(operator.properties.filepath, '.json')
    scene = context.scene

    # filter out objects on the blacklist
    diameterMeshObject = None
    filteredObjects = []
    for ob in blendObjects:
        if ob.name in nameExportBlacklist:
            if ob.name == 'diameter-mesh':
                diameterMeshObject = ob
            else:
                filteredObjects.append(ob)
            blendObjects.remove(ob)
            continue

    # ensure a triangulate modifier is applied
    for ob in blendObjects:
        lacksTriMod = True
        for mod in ob.modifiers:
            if mod.type == "TRIANGULATE":
                lacksTriMod = False
        if lacksTriMod:
            ob.modifiers.new("tri", 'TRIANGULATE')

    print("=== full summary, before processing")
    dumpObjectList(blendObjects)

    for ob in blendObjects:
        resetShapekeyValueRang(ob)

    print("=== full summary, post shape key cleanup")
    dumpObjectList(blendObjects)

    modelDiameter = extractDiameter(blendObjects)
    if diameterMeshObject:
        modelDiameter = calculateDiameter(diameterMeshObject)

    meshString = generate_meshes(blendObjects, scene)
    operatorString = generate_operators(blendObjects, scene)

    controlString = generate_controls()

    fileName = bpy.path.basename(bpy.context.blend_data.filepath)
    modelCategory = getModelCategory(fileName)
    metadataString = TEMPLATE_METADATA % {
                "modelDiameter": modelDiameter,
                "modelCategory": addQuotes(modelCategory),
                "sourceFilename": addQuotes(fileName),
                "timestamp": addQuotes(exportTime)
            }
    fileText = generate_file(metadataString, meshString, operatorString, controlString)

    write_file(filepath, fileText)

    return {'FINISHED'}

# looks for a vertex group named "diameter-chord" containing two vertices, returns the distance
# between those points if present and zero otherwise
# FIXME: this is pretty fragile, if the vertices are picked poorly the diameter will be inaccurate,
# and if or the vertices are subdivided before the diameter calculation is made then it's possible
# the algorithm will pick two vertices on the same side of the ring opening
def calculateDiameter(obj):
    if type(obj.data) != bpy.types.Mesh:
        return 0

    groupIndex = -1
    for i in range(0, len(obj.vertex_groups)):
        group = obj.vertex_groups[i]
        if group.name == "diameter-chord":
            groupIndex = i

    if groupIndex == -1:
        return 0

    foundVerts = 0
    firstVertex = None
    for v in obj.data.vertices:
        for vertGroup in v.groups:
            if vertGroup.group == groupIndex:
                if foundVerts == 0:
                    firstVertex = v
                    foundVerts += 1
                    continue
                if foundVerts == 1:
                    delta = v.co - firstVertex.co
                    return delta.magnitude
    print("didn't find at least two vertices, found: "+str(foundVerts))
    return 0

def write_file(fname, content):
    out = open(fname, "w")
    out.write(content)
    out.close()

def extract_mesh( object, scene):
    if object.type == "MESH":

        # collapse modifiers into mesh using the preview setting
        # as opposed to RENDER, this matches the subdivision level of what you see in the 3D viewport
        mesh = object.to_mesh(scene, True, 'PREVIEW', calc_tessface=True)

        if not mesh:
            raise Exception("Error, could not get mesh data from object [%s]" % object.name)

        # preserve original name
        mesh.name = object.name
        mesh.calc_normals()
        mesh.calc_tessface()
        return mesh

def extract_meshes( objects, scene ):
    print("=== pre extraction")
    dumpObjectList(objects)

    meshes = []
    for ob in objects:
        if ob.type == "MESH":
            # collapse modifiers into mesh using the preview setting
            # as opposed to RENDER, this matches the subdivision level of what you see in the 3D viewport
            # bpy.context.scene.objects.active = ob

            mesh = ob.to_mesh(scene, True, 'PREVIEW', calc_tessface=True)

            if not mesh:
                raise Exception("Error, could not get mesh data from object [%s]" % ob.name)

            # preserve original name
            mesh.name = ob.name
            mesh.calc_normals()
            mesh.calc_tessface()
            # mesh.transform(mathutils.Matrix.Scale(1.0, 4)) # FIXME: we will probably want scaling back
            meshes.append(mesh)
    return meshes

def generate_vertices(vertices, option_vertices_truncate, option_vertices):
    if not option_vertices:
        return ""

    return ",".join(generate_vertex(v, option_vertices_truncate) for v in vertices)

def generate_vertex(v, option_vertices_truncate):
    if not option_vertices_truncate:
        return TEMPLATE_VERTEX % (v.co.x, v.co.y, v.co.z)
    else:
        return TEMPLATE_VERTEX_TRUNCATE % (v.co.x, v.co.y, v.co.z)

TEMPLATE_VERTEX = "%g,%g,%g"
TEMPLATE_VERTEX_TRUNCATE = "%d,%d,%d"
TEMPLATE_N = "%g,%g,%g"
TEMPLATE_UV = "%g,%g"
TEMPLATE_C = "%d"

# accepts a listing of each mesh in the scene and its object as a tuple
# return the text of the operators found among the objects
def generate_operators(objects, scene):
    operators = []
    for ob in objects:
        if not ob.data.shape_keys:
            continue

        mesh = extract_mesh(ob, scene)

        addShapeKeyFrames(ob)
        original_frame = scene.frame_current # save animation state
        scene_frames = range(scene.frame_start, scene.frame_end + 1)

        # here each morph is the float list string representation of the vertex positions in the deformed configuration
        for index, frame in enumerate(scene_frames):
            scene.frame_set(frame, 0.0)
            morph = generate_morph(index, mesh, ob, scene)
            if morph:
                operators.append(morph)

        scene.frame_set(original_frame, 0.0) # restore animation state
        removeShapeKeyFrames(ob)
        bpy.data.meshes.remove(mesh)

    return ",\n".join(operators)


def resetShapekeyValueRang(ob):
    operatorLimits = {}
    if ob.data.shape_keys:
        for sk in ob.data.shape_keys.key_blocks:
            if sk.name.lower() == "basis":
                continue
            operatorLimits[sk.name] = (sk.slider_min, sk.slider_max) # could store sk.value here if desired
            sk.slider_min = 0
            sk.slider_max = 1
            sk.value = 0
    ob["operatorLimits"] = operatorLimits


# builds the morph target for the object at the global scene frame already set
def generate_morph(frameIndex, originalMesh, object, scene):
    if not object.data.shape_keys:
        return None # no shape keys

    epsilon = .0001
    morphName = object.data.shape_keys.key_blocks[frameIndex].name

    if morphName == "Basis":
        return None # redundant with the main mesh vertices

    # print("Examining object: ", object.name)
    limits = object["operatorLimits"][morphName]
    minWeight = limits[0]
    maxWeight = limits[1]
    # print("sentinel values:", minWeight, "--", maxWeight)

    originalVertices = originalMesh.vertices[:]
    deformedMesh = extract_mesh(object, scene)
    deformedVertices = deformedMesh.vertices[:]

    # print("original vertex data: ")
    # dumpVertexList(originalVertices)

    # print("deformed vertex data: ")
    # dumpVertexList(deformedVertices)

    if len(deformedVertices) != len(originalVertices):
        print( "Original to deformed: "+ str(len(originalVertices))+" => "+ str(len(deformedVertices)))
        raise Exception("Error, mismatch between number of vertices in morph" )

    indices = []
    displacements = []
    for vertexIndex in range(len(originalVertices)):

        delta = deformedVertices[vertexIndex].co - originalVertices[vertexIndex].co

        # TODO: normals stored per face, need to calc per-vertex normals ourself (or learn the BMesh library, probably better)
        # deformedMesh.polygons[0].normal
        if delta.length > epsilon:
            # clamp near-zero values
            dx = delta.x if abs(delta.x) > epsilon else 0
            dy = delta.y if abs(delta.y) > epsilon else 0
            dz = delta.z if abs(delta.z) > epsilon else 0

            indices.append(str(vertexIndex))
            displacements.extend((str(dx), str(dy), str(dz)))

    meshID, channelID, meshLabel, channelLabel = unpackMeshName(object.name)
    operatorID, groupID, operatorLabel, groupLabel = unpackOperatorName(morphName, meshID)

    operatorID = operatorID + "_" + meshID
    morphTarget = TEMPLATE_OPERATOR % {
            "operatorID": addQuotes(operatorID),
            "operatorLabel": addQuotes(operatorLabel),
            "groupID": addQuotes(groupID),
            "groupLabel": addQuotes(groupLabel),
            "meshID": addQuotes(meshID),
            "type": addQuotes("morph"),
            "minWeight": minWeight,
            "maxWeight": maxWeight,
            "modifiedCount": len(indices),
            "indices": ",".join(indices),
            "displacements": ",".join(displacements)
            }

    # object.data.shape_keys.key_blocks[frameIndex].slider_min = minWeight
    # object.data.shape_keys.key_blocks[frameIndex].slider_max = maxWeight

    bpy.data.meshes.remove(deformedMesh)
    return morphTarget

# populate frames 1 - len()
# this function exists largely unmodified from original mixee hack
def addShapeKeyFrames(exportObj):
    if bool(exportObj.data.shape_keys):
        arrlength=len(exportObj.data.shape_keys.key_blocks)
        curitem=0

        # frames [2] through [arrlength] each have singular key_block at maximum value
        # replaces the basis morph vertices with the original mesh vertex array
        for i in range(1,arrlength):
            for j in range(1,arrlength):
                if j==i:
                    exportObj.data.shape_keys.key_blocks[j].value=1.0
                else:
                    exportObj.data.shape_keys.key_blocks[j].value=0.0
                exportObj.data.shape_keys.key_blocks[j].keyframe_insert("value",frame=i+1)

        # first frame has zero for all targets
        for shape in exportObj.data.shape_keys.key_blocks:
            shape.value=0.0
            exportObj.data.shape_keys.key_blocks[shape.name].keyframe_insert("value",frame=1)

        # create a frame for each shape key
        bpy.context.scene.frame_end = arrlength
        bpy.context.scene.frame_start = 1

def removeShapeKeyFrames(exportObj):
    exportObj.animation_data_clear()

    # if that doesn't work, experiment with this
    # for num in range(bpy.context.scene.frame_start, bpy.context.scene.frame_end):
        # bpy.context.active_object.keyframe_delete('value', frame=num)


def generate_file(metadataString, meshString, operatorString, controlString):
    return TEMPLATE_MODEL % {
            "metadata": metadataString,
            "meshes":  meshString,
            "controls": controlString,
            "operators": operatorString
            }


def unpackMeshName(rawName):
    pack = rawName.split(".")
    meshLabel = pack[0]
    if len(pack) == 1:
        channelLabel = "Primary"
    else:
        channelLabel = pack[1]

    channelID = canonicalizeID(channelLabel)
    meshID = channelID +"___"+canonicalizeID(meshLabel)
    return meshID, channelID, meshLabel, channelLabel

def unpackOperatorName(rawName, meshID):
    pack = rawName.split(".")
    operatorLabel = pack[0]
    if len(pack) == 1:
        groupLabel = "Other"
    else:
        groupLabel = pack[1]

    groupID = meshID + "___" + canonicalizeID(groupLabel)
    operatorID = groupID +"___"+ canonicalizeID(operatorLabel)
    return operatorID, groupID, operatorLabel, groupLabel

def canonicalizeID(idProposal):
    return idProposal.replace(" ", "_").lower()

def addQuotes(name):
    return '"'+name+'"'

def extractDiameter(objects):
    for ob in objects:
        diameter = calculateDiameter(ob)
        if diameter > 0: 
            return diameter
    return 0


# accepts a list of <mesh, object> tuples, each mesh should be a separate component
# return the text of the mesh components in the scene
def generate_meshes(objects, scene):
    meshList = extract_meshes(objects, scene)

    meshStrings = []
    for mesh in meshList:
        if mesh.name in nameExportBlacklist:
            continue
        meshStrings.append(generate_mesh(mesh))

    return ",\n".join(meshStrings)

def generate_mesh(mesh):
    vertices = mesh.vertices[:]
    triangle_string, nTris = generate_faces(mesh)
    meshID, channelID, meshLabel, channelLabel = unpackMeshName(mesh.name)

    return TEMPLATE_MESH % {
            "meshID"    : addQuotes(meshID),
            "channelID" : addQuotes(channelID),
            "meshLabel" : addQuotes(meshLabel),
            "channelLabel": addQuotes(channelLabel),
            "nvertex"   : len(vertices),
            "ntriangle" : nTris,
            "vertices"  : generate_vertices(vertices, False, True),
            "triangles" : triangle_string
            }

def generate_controls():
    if 'raw_controls' in bpy.data.texts:
        return bpy.data.texts['raw_controls'].as_string()
    else:
        return ""

TEMPLATE_MODEL = """\
{
    "metadata": {
%(metadata)s
    },
    "meshes": [
%(meshes)s
    ],
    "controls": [
%(controls)s
    ],
    "operators": [
%(operators)s
    ]
}
"""

# add this to TEMPLATE_MODEL when integrating groups
"""
    "groups": [
%(groups)s
    ],
"""


# indent to keep formatting pretty
TEMPLATE_METADATA = """\
        "diameter"      : %(modelDiameter)f,
        "category"      : %(modelCategory)s,
        "formatVersion" : 6,
        "sourceFile"    : %(sourceFilename)s,
        "dateGenerated" : %(timestamp)s """

TEMPLATE_MESH = """\
        {
            "id"            : %(meshID)s,
            "label"         : %(meshLabel)s,
            "channelID"     : %(channelID)s,
            "channelLabel"  : %(channelLabel)s,
            "numvertices"   : %(nvertex)d,
            "numtriangles"  : %(ntriangle)d,
            "vertices"      : [%(vertices)s],
            "triangles"     : [%(triangles)s]
        }"""

TEMPLATE_CONTROL = """\
        {
            "id": %(operatorID)s,
            "group": %(groupID)s,
            "label": "Blah blah",
            "maskedControls": [ %(meshIDs)s ]
        }"""

TEMPLATE_GROUP = """\
        {
            "id": %(groupID)s,
            "mesh": %(meshID)s,
            "indices": [ %(indexData)s ]
        }"""

TEMPLATE_OPERATOR = """\
        {
            "id": %(operatorID)s,
            "label": %(operatorLabel)s,
            "groupID": %(groupID)s,
            "groupLabel": %(groupLabel)s,
            "type": %(type)s,
            "mesh": %(meshID)s,
            "minWeight": %(minWeight)f,
            "maxWeight": %(maxWeight)f,
            "parameters": {
                "modifiedCount": %(modifiedCount)d,
                "indices": [%(indices)s],
                "displacements": [%(displacements)s]
            }
        }"""


def bbox(vertices):
    """Compute bounding box of vertex array."""

    if len(vertices)>0:
        minx = maxx = vertices[0].co.x
        miny = maxy = vertices[0].co.y
        minz = maxz = vertices[0].co.z

        for v in vertices[1:]:
            if v.co.x < minx:
                minx = v.co.x
            elif v.co.x > maxx:
                maxx = v.co.x

            if v.co.y < miny:
                miny = v.co.y
            elif v.co.y > maxy:
                maxy = v.co.y

            if v.co.z < minz:
                minz = v.co.z
            elif v.co.z > maxz:
                maxz = v.co.z

        return { 'x':[minx,maxx], 'y':[miny,maxy], 'z':[minz,maxz] }

    else:
        return { 'x':[0,0], 'y':[0,0], 'z':[0,0] }

def setBit(value, position, on):
    if on:
        mask = 1 << position
        return (value | mask)
    else:
        mask = ~(1 << position)
        return (value & mask)

def generate_faces(mesh):
    vertex_offset = 0
    chunks = []
    for i, f in enumerate(get_faces(mesh)):
        face = generate_face(f, vertex_offset)
        chunks.append(face)

    return ",".join(chunks), len(chunks)

def generate_face(f, vertex_offset):
    isTriangle = ( len(f.vertices) == 3 )

    if isTriangle:
        nVertices = 3
    else:
        raise Exception("Error, mesh must be triangulated or its object must have a triangulation modifier at time of export.")

    faceData = []
    for i in range(nVertices):
        index = f.vertices[i] + vertex_offset
        faceData.append(index)

    return ",".join( map(str, faceData) )

# #####################################################
# Utils
# #####################################################

def veckey3(x,y,z):
    return round(x, 6), round(y, 6), round(z, 6)

def veckey3d(v):
    return veckey3(v.x, v.y, v.z)

def veckey2d(v):
    return round(v[0], 6), round(v[1], 6)

def get_faces(obj):
    if hasattr(obj, "tessfaces"):
        return obj.tessfaces
    else:
        return obj.faces

def ensure_extension(filepath, extension):
    if not filepath.lower().endswith(extension):
        filepath += extension
    return filepath

if __name__ == "__main__":
    register()

