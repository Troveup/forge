var THREE = require('three');

/**
 * @author mrdoob / http://mrdoob.com/
 */

var OBJExporter = function () {};

if ( typeof module === 'object' ) {
	module.exports = OBJExporter;
}


OBJExporter.prototype = {

	constructor: OBJExporter,

	parse: function ( object, includeNormals ) {
        includeNormals = includeNormals || false;

		var output = '';

		var indexVertex = 0;
		var indexVertexUvs = 0
		var indexNormals = 0;

		var parseObject = function ( child ) {
			var nbVertex = 0;
			var nbVertexUvs = 0;
			var nbNormals = 0;

			var geometry = child.geometry;

			if ( geometry instanceof THREE.Geometry ) {

				output += 'o ' + child.name + '\n';

				for ( var i = 0, l = geometry.vertices.length; i < l; i ++ ) {

					var vertex = geometry.vertices[ i ].clone();
					vertex.applyMatrix4( child.matrixWorld );

					output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n';

					nbVertex ++;

				}

				// uvs: don't need this for now
				//for ( var i = 0, l = geometry.faceVertexUvs[ 0 ].length; i < l; i ++ ) {
					//var vertexUvs = geometry.faceVertexUvs[ 0 ][ i ];
					//for ( var j = 0; j < vertexUvs.length; j ++ ) {
						//var uv = vertexUvs[ j ];
						//vertex.applyMatrix4( child.matrixWorld );
						//output += 'vt ' + uv.x + ' ' + uv.y + '\n';
						//nbVertexUvs ++;
					//}
				//}

				// normals
                if (includeNormals) {
                    for ( var i = 0, l = geometry.faces.length; i < l; i ++ ) {

                        var normals = geometry.faces[ i ].vertexNormals;

                        for ( var j = 0; j < normals.length; j ++ ) {

                            var normal = normals[ j ];
                            output += 'vn ' + normal.x + ' ' + normal.y + ' ' + normal.z + '\n';

                            nbNormals ++;

                        }

                    }
                }

				// faces
				for ( var i = 0, j = 1, l = geometry.faces.length; i < l; i ++, j += 3 ) {

					var face = geometry.faces[ i ];
					output += 'f ';

                    if (includeNormals) {
                        output += ( indexVertex + face.a + 1 ) + '//' + ( indexNormals + j ) + ' ';
                        output += ( indexVertex + face.b + 1 ) + '//' + ( indexNormals + j + 1 ) + ' ';
                        output += ( indexVertex + face.c + 1 ) + '//' + ( indexNormals + j + 2 ) + '\n';
                    } else {
                        output += ( indexVertex + face.a + 1 ) + ' ';
                        output += ( indexVertex + face.b + 1 ) + ' ';
                        output += ( indexVertex + face.c + 1 ) + '\n';
                    }


				}

			}

			// update index
			indexVertex += nbVertex;
			indexVertexUvs += nbVertexUvs;
			indexNormals += nbNormals;

		};

		object.traverse( parseObject );

		return output;

	}

};

if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = OBJExporter;
  }
  exports.OBJExporter = OBJExporter;
} else {
  this['OBJExporter'] = OBJExporter;
}
