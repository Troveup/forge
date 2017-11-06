describe("Page Module", function() {
    console.log("in page module test");

    it("should exist in FORGE lib", function() {
        expect(FORGE).toBeDefined();
        expect(FORGE.Mesh).toBeDefined();
        expect(FORGE.Control).toBeDefined();
        expect(FORGE.Scene).toBeDefined();
        expect(FORGE.Page).toBeDefined();
    });


    it("should be able to init page", function() {
        FORGE.Page.init({
            selectors: {
                materialSelect: "#webmenu",
                // modelParentID: "#modelParentID",
                // initialParamsBlock: "#initialParameters",
                canvas: "#canvas"
            },
            admin: true,
            storageRoot: "/models/",
            activeFilename: "tri-cube.json",
            debug: true
        });

        expect(true).toBeTruthy();

    });

    //it("initializes three js scene components", function() {
        //var formData = new FormData();
    //});

});
