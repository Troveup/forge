
adv:
	java -jar ~/local/closure-compiler/compiler.jar \
		--js public/js/FORGE.js \
		--js public/js/FORGE.Camera.js \
		--js public/js/FORGE.Control.js \
		--js public/js/FORGE.Log.js \
		--js public/js/FORGE.Material.js \
		--js public/js/FORGE.Page.js \
		--js public/js/FORGE.Util.js \
		-O advanced --js_output_file FORGE.min.js

simple:
	java -jar ~/local/closure-compiler/compiler.jar \
		--js public/js/FORGE.js \
		--js public/js/FORGE.Camera.js \
		--js public/js/FORGE.Control.js \
		--js public/js/FORGE.Log.js \
		--js public/js/FORGE.Material.js \
		--js public/js/FORGE.Page.js \
		--js public/js/FORGE.Util.js \
		-O simple --js_output_file FORGE.min.js

nospace:
	java -jar ~/local/closure-compiler/compiler.jar \
		--js public/js/FORGE.js \
		--js public/js/FORGE.Camera.js \
		--js public/js/FORGE.Control.js \
		--js public/js/FORGE.Log.js \
		--js public/js/FORGE.Material.js \
		--js public/js/FORGE.Page.js \
		--js public/js/FORGE.Util.js \
		-O whitespace_only --js_output_file FORGE.min.js


