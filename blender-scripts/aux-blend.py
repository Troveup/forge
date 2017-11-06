

def applyOperatorWeights(obj, weights):
    # attempt to apply all operator weights to each mesh to simplify logic
    for operatorID, operatorValue in weights.items():
        if operatorID in obj.data.shape_keys.key_blocks:
            obj.data.shape_keys.key_blocks[operatorID].value = operatorValue
            obj.data.shape_keys.key_blocks[operatorID].keyframe_insert("value",frame=exportFrame)


def parseOperators(operatorDefs, objectMeshes):
    """ create shape keys on the meshes corresponding to the json defs """
    for op in operatorDefs:
        if "morph" == op["type"]:
            meshID = op["mesh"]
            if meshID == "Cube":
                meshID = "Cube.001"

            obj = objectMeshes[meshID]
            sk = obj.shape_key_add(name=op["id"], from_mix=False)
            newKeyIndex = len(obj.data.shape_keys.key_blocks)-1

            params = op["parameters"]
            disps = params["displacements"]
            for i in range(params["modifiedCount"]):
                j = i*3
                index = params["indices"][i]
                orig = obj.data.vertices[index].co
                # obj.data.shape_keys.key_blocks[xshape_idx].data[vert.index].co.y

                obj.data.shape_keys.key_blocks[newKeyIndex].data[index].co.x =  orig.x + disps[j]
                obj.data.shape_keys.key_blocks[newKeyIndex].data[index].co.y =  orig.y + disps[j+1]
                obj.data.shape_keys.key_blocks[newKeyIndex].data[index].co.z =  orig.z + disps[j+2]

                # sk.data[index].co.x =  orig.x + disps[j]
                # sk.data[index].co.y =  orig.y + disps[j+1]
                # sk.data[index].co.z =  orig.z + disps[j+2]
        else:
            print("UNIMPLEMENTED EXPORT FOR OPERATOR TYPE: ", op["type"])


def clearShapeKeyWeights(obj):
    for shape in obj.data.shape_keys.key_blocks:
        shape.value = 0


def whateverShapekeys():
    context = bpy.context
    obj = context.object
    shape_name = obj.active_shape_key.name
    skey_value = obj.active_shape_key.value
    obj.active_shape_key.value = obj.active_shape_key.slider_max
    obj.shape_key_add(name=str(shape_name) + "_X", from_mix=True)
    xshape_idx = len(obj.data.shape_keys.key_blocks)-1
    obj.active_shape_key.value = skey_value

    for vert in obj.data.vertices: #Isolate the translation on the X axis
        obj.data.shape_keys.key_blocks[xshape_idx].data[vert.index].co.y = obj.data.shape_keys.key_blocks['Basis'].data[vert.index].co.y
        obj.data.shape_keys.key_blocks[xshape_idx].data[vert.index].co.z = obj.data.shape_keys.key_blocks['Basis'].data[vert.index].co.z


def deleteAllBut(survivor):
    for ob in bpy.data.objects:
        if not survivor or ob.name != survivor.name:
            ob.select = True
        else:
            ob.select = False
    bpy.ops.object.delete()


def exportObjectLocally(obj, exportPath="localoutput.obj"):
    deleteAllBut(obj)  # FIXME: remove when I figure out the object context override
    # override = {'selected_objects': [obj]}
    # bpy.context.scene.frame_current = exportFrame
    # bpy.context.scene.frame_set(exportFrame, 0.0)
    # bpy.context.scene.frame_end = exportFrame
    # bpy.context.scene.frame_start = exportFrame
    bpy.ops.export_scene.obj(use_normals=False,
                             use_mesh_modifiers=True,
                             # use_animation=True,
                             use_materials=False,
                             filepath=exportPath)
    return exportPath

    # bpy.ops.object.mode_set(mode='OBJECT')
    # bpy.ops.transform.resize({}, value=(scaleFactor, scaleFactor, scaleFactor), constraint_axis=(False, False, False), constraint_orientation='GLOBAL', mirror=False, proportional='DISABLED', proportional_edit_falloff='SMOOTH', proportional_size=1)
    # bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

def extractVertexGroups(obj, extractList):
    print(extractList)
    indexToName = {}
    data = {}
    print("Iterating through groups searching for elements in:",extractList)
    for g in obj.vertex_groups:
        print("Group {0} with name {1}".format(g.index, g.name))
        if g.name in extractList:
            indexToName[g.index] = g.name
            data[g.name] = []
        else:
            print("Group {0} is not in the extract list".format(g.name))

    print("indexToName, data:")
    print(indexToName)
    print(data)

    # print("==============")
    for v in obj.data.vertices:
        for g in v.groups:
            # print("Group ID:", g.group)
            if g.group in indexToName:
                # print("v.index")
                data[indexToName[g.group]].append(v.index)
                # jkljksdkl FIXME
            else:
                print("was not in a group")
    return data

def orderPathGroup(obj, indexCollection):
    if not indexCollection:
        raise Exception("Empty index collection, probably failed parsing vertex groups")

    bm = bmesh.new()
    bm.from_mesh(obj.data)

    bm.verts.index_update()
    first = bm.verts[indexCollection[0]]
    outgoing = []
    for e in first.link_edges:
        v_other = e.other_vert(v)
        if v_other.index in indexCollection:
            outgoing.append(v_other)
    if len(outgoing) == 0:
        raise Exception("Error: only one vertex in the group")
    elif len(outgoing) > 2:
        raise Exception("Error: not a linear collection of verts, invalid for ordering")

    # handle first branch regardless
    prevVert = first
    currVert = outgoing[0]
    sortedIndices = [ prevVert.index, currVert.index ]

    nextVert = findNextVert(prevVert, currVert, indexCollection)
    while nextVert:
        if nextVert == first: # short circuit if the loop completes itself
            bm.free()
            return sortedIndices

        sortedIndices.append(nextVert.index)
        prevVert = currVert
        currVert = nextVert
        nextVert = findNextVert(prevVert, currVert, indexCollection)

    if len(outgoing) == 1:
        bm.free()
        return sortedIndices

    prevVert = first
    currVert = outgoing[1]
    reverseIndexFrag = [ currVert.index ]  # first index already in other array

    nextVert = findNextVert(prevVert, currVert, indexCollection)
    while nextVert:
        reverseIndexFrag.append(nextVert.index)
        prevVert = currVert
        currVert = nextVert
        nextVert = findNextVert(prevVert, currVert, indexCollection)

    # important to make sure lists are middle-in (lol)
    finalList = list(reversed(reverseIndexFrag))  + sortedIndices
    if len(finalList) != len(indexCollection):
        raise Exception("Group ordering failed, math doesn't check out: {0} != {2}".format(len(finalList), len(indexCollection)))

    # how to overwrite original mesh data (if desired)
    # bm.to_mesh(obj.data)
    # bm.free()

    bm.free()
    return finalList

# invariant - currVertex and prevVertex are already in list
def findNextVert(prevVertex, currVertex, allIndices):
    for e in currVertex.link_edges:
        v_other = e.other_vert(v)
        idx = v_other.index
        if idx in allIndices and idx != prevVertex.index:
            return v_other
    return None

