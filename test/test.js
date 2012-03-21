(function () {
    test("empty constructor", function () {
        ok($.intercal());
        deepEqual($.intercal().once, {});
        deepEqual($.intercal().on, {});

        ok($.intercal({}));
        deepEqual($.intercal({}).once, {});
        deepEqual($.intercal({}).on, {});

        ok($.intercal.barrier());
    });

}());
