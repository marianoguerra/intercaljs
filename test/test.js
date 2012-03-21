(function () {
    function looksLikeDeferred(thing) {
        return thing.pipe && thing.progress && thing.promise && thing.then;
    }

    function looksLikeCallback(thing) {
        return thing.lock && thing.locked && thing.fire && thing.fireWith;
    }

    test("empty constructor", function () {
        ok($.intercal());
        deepEqual($.intercal().once, {});
        deepEqual($.intercal().on, {});

        ok($.intercal({}));
        deepEqual($.intercal({}).once, {});
        deepEqual($.intercal({}).on, {});

        ok($.intercal.barrier());
    });

    test("create simple deferred", function () {
        var ic = $.intercal({"once": {"simple": ""}});

        ok(looksLikeDeferred(ic.once.simple));
    });

    test("create simple childs deferred", function () {
        var ic = $.intercal({"once": {"page": "ready close"}});

        ok(looksLikeDeferred(ic.once.page.ready));
        ok(looksLikeDeferred(ic.once.page.close));
    });

    test("create nested deferreds", function () {
        var ic = $.intercal({
            "once": {
                "page": {
                    "ready": {
                        "done": "",
                        "fail": "horribly withStyle"
                    }
                }
            }
        });

        ok(looksLikeDeferred(ic.once.page.ready.done));
        ok(looksLikeDeferred(ic.once.page.ready.fail.horribly));
        ok(looksLikeDeferred(ic.once.page.ready.fail.withStyle));
    });

    test("create simple callback", function () {
        var ic = $.intercal({"on": {"simple": ""}});
        ok(looksLikeCallback(ic.on.simple));
    });

    test("create simple child callbacks", function () {
        var ic = $.intercal({"on": {"page": "ready close"}});

        ok(looksLikeCallback(ic.on.page.ready));
        ok(looksLikeCallback(ic.on.page.close));
    });

    test("create nested callbacks", function () {
        var ic = $.intercal({
            "on": {
                "page": {
                    "ready": {
                        "done": "",
                        "fail": "horribly withStyle"
                    }
                }
            }
        });

        ok(looksLikeCallback(ic.on.page.ready.done));
        ok(looksLikeCallback(ic.on.page.ready.fail.horribly));
        ok(looksLikeCallback(ic.on.page.ready.fail.withStyle));
    });

    function shouldTrow(data, exceptionName) {
        try {
            $.intercal(data);
            fail("should raise exception: " + exceptionName);
        } catch (error) {
            equal(error.name, exceptionName);
        }
    }

    test("fail with reserved callback name in simple callback", function () {
        shouldTrow({"on": {"any": ""}}, "intercal.Error");
    });

    test("fail with reserved callback name in simple nested callback", function () {
        shouldTrow({"on": {"simple": "any"}}, "intercal.Error");
        shouldTrow({"on": {"simple": "foo any"}}, "intercal.Error");
    });

    test("fail with reserved callback name in nested callbacks", function () {
        shouldTrow({"on": {"nested": {"any": ""}}}, "intercal.Error");
        shouldTrow({"on": {"nested": {"foo": "any"}}}, "intercal.Error");
        shouldTrow({"on": {"nested": {"foo": "bar any"}}}, "intercal.Error");
    });
}());
