/*
	Copyright 2015, Google, Inc. 
 Licensed under the Apache License, Version 2.0 (the "License"); 
 you may not use this file except in compliance with the License. 
 You may obtain a copy of the License at 
  
    http://www.apache.org/licenses/LICENSE-2.0 
  
 Unless required by applicable law or agreed to in writing, software 
 distributed under the License is distributed on an "AS IS" BASIS, 
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
 See the License for the specific language governing permissions and 
 limitations under the License.
*/
"use strict";

var path = require('path');

var prodKeyFilePath = '/usr/local/workspace/FORGE/forge/config';

var baseConfig = {
  port: 80,
  debugRoutes: false,
  lanIP: '127.0.0.1',

  //Environment for the compute engine, used primarily to decide which path to use for finding the Cloud Storage
  //key file, as it struggles to use "./".
  environment: 'compute',

  exportPath: "./build/",
  /*
    dataBackend can be 'datastore', 'cloudsql', or 'mongodb'. Be sure to
    configure the appropriate settings for each storage engine below.
    Note that datastore requires no additional configuration.
  */
  dataBackend: 'datastore',

  /*
    This can also be your project id as each project has a default
    bucket with the same name as the project id.
  */

  storageConstants: {
  },

  bucketToProject: {
  },

  /*
    This is the id of your project in the Google Developers Console.
  */
  gcloud: {
  }
};

// FIXME: should conditionally run this code if the devconfig.js file exists,
// but for now we'll just check in an empty devconfig.js module and add to gitignore
var DeepMerge = require('deep-merge');
var devconfig = require('./devconfig');

var deepmerge = DeepMerge(function(target, source, key) {
    if(target instanceof Array) {
        return [].concat(target, source);
    }
    return source;
});
module.exports = deepmerge(baseConfig, devconfig);
 

