
var webpack = require('webpack');
var path = require('path');

module.exports = {
    karma: {
        module: {
            loaders: []
        },
        target: 'web',
        resolve: {
            root: [
                path.join(__dirname, '..', '/lib'),
                path.join(__dirname, '..', '/node_modules')
            ],
            alias: {}
        },
        plugins: [
            new webpack.NormalModuleReplacementPlugin(/\.(css|less|png|jpg)$/, 'node-noop'),
            new webpack.ProvidePlugin({
                $: "jquery",
                jQuery: "jquery",
                "window.jQuery": "jquery"
            })
        ]
    },
    frontend: {
        entry: {
            app: ['./lib/forge']
            // vendors: [ 'custom-three' ]
        },
        target: 'web',
        resolve: {
            root: [
                path.join(__dirname, '..', '/lib'),
                path.join(__dirname, '..', '/node_modules')
            ],
            alias: {}
        },
        output: {
            library: 'FORGE',
            path: './public/js',
            filename: 'FORGE.js'
        },
        module: {
            noParse: [],
            loaders: [
                // { test: /\.handlebars$/, loader: "handlebars-loader" },
                { test: /\.(png|jpg)$/, loader: 'url-loader?limit=100000' }, // inline base64 URLs for <=8k images, direct URLs for the rest
                { test: /\.scss$/, loaders: ["style", "css", "sass"] }
            ]
        },
        devtool: 'inline-source-map',
        //devtool: 'hidden-source-map',
        plugins: [
            // for server side config
            new webpack.optimize.UglifyJsPlugin({
                sourceMap: false,
                mangle: {
                    except: ['FORGE']
                },
                compress: {
                    warnings: true
                }
            }),
            // new webpack.optimize.CommonsChunkPlugin('vendors', 'vendors.js')
        ]
    },
    backend: {
        entry: {
            app: ['./server/server.js']
        },
        target: 'node',
        resolve: {
            root: [
                path.join(__dirname, '..', '/lib'),
                path.join(__dirname, '..', '/node_modules')
            ],
            alias: {}
        },
        output: {
            path: path.join(__dirname, '..', 'build'),
            filename: 'FORGE-server.js'
        },
        node: {
            __dirname: true,
            __filename: true
        },
        module: {
            noParse: [],
            loaders: [
                // { test: /\.handlebars$/, loader: "handlebars-loader" },
                { test: /\.scss$/, loaders: ["style", "css", "sass"] }
            ]
        },
        devtool: 'sourcemap',
        plugins: [
            new webpack.NormalModuleReplacementPlugin(/forge\/Page$/, 'node-noop'),
            new webpack.NormalModuleReplacementPlugin(/\.(css|less|png|jpg)$/, 'node-noop'),
            new webpack.BannerPlugin('require("source-map-support").install();',
                                     { raw: true, entryOnly: false })
        ]
    }
};
