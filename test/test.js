/*global ok equal deepEqual fail test module start stop*/
(function () {
    "use strict";

    function looksLikeDeferred(thing) {
        return thing.pipe && thing.progress && thing.promise && thing.then;
    }

    function looksLikeCallback(thing) {
        return thing.lock && thing.locked && thing.fire && thing.fireWith;
    }

    function looksLikeBarrier(thing) {
        return thing.add && thing.lock && thing.locked && thing.status && thing.promise;
    }

    function looksLikePromise(thing) {
        return thing.then && thing.fail && thing.pipe && thing.progress &&
                thing.done;
    }

    function looksLikeBarrierPromise(thing) {
        return looksLikePromise(thing) && thing.timeout;
    }

    function shouldTrow(data, exceptionName) {
        try {
            $.intercal(data);
            fail("should raise exception: " + exceptionName);
        } catch (error) {
            equal(error.name, exceptionName);
        }
    }

    module("intercal");

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

    test("fail if toplevel deferred is a reserved word", function () {
        shouldTrow({"once": {"reset": ""}}, "intercal.Error");
        shouldTrow({"once": {"reset": "foo bar"}}, "intercal.Error");
        // this shouldnt throw
        var ic = $.intercal({"once": {"simple": "reset"}});
        ok(looksLikeDeferred(ic.once.simple.reset));

        ic = $.intercal({"once": {"nested": {"reset": ""}}});
        ok(looksLikeDeferred(ic.once.nested.reset));
        ic = $.intercal({"once": {"nested": {"reset": "foo"}}});
        ok(looksLikeDeferred(ic.once.nested.reset.foo));
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

    module("barrier");

    test("construct", function () {
        var barrier = $.intercal.barrier(3);
        ok(looksLikeBarrier(barrier));
    });

    test("construct promise", function () {
        var barrier = $.intercal.barrier(3);
        ok(looksLikeBarrierPromise(barrier.promise()));
    });

    test("locks automatically after itemCount additions", function () {
        var barrier = $.intercal.barrier(1);

        ok(!barrier.locked());
        barrier.add($.Callbacks());
        ok(barrier.locked());
    });

    test("locks automatically with items in construction", function () {
        var barrier = $.intercal.barrier([$.Callbacks()]);
        ok(barrier.locked());
    });

    test("locks manually", function () {
        var barrier = $.intercal.barrier();

        ok(!barrier.locked());
        barrier.add($.Callbacks());
        barrier.lock();
        ok(barrier.locked());
    });

    function testTimeout(barrier, connector) {
        var timedout = false, failCalled = false;

        connector.timeout(function () {
            timedout = true;
        });

        connector.fail(function (cause) {
            equal(cause, 'timeout');
            failCalled = true;
        });

        barrier.add($.Callbacks());

        setTimeout(function () {
            equal(timedout, true, "timedout should be updated by timeout callback");
            equal(failCalled, true, "fail should be called");
            start();
        }, 200);

        stop();
    }

    test("timeouts (with promise)", function () {
        var barrier = $.intercal.barrier(1, 1);
        testTimeout(barrier, barrier.promise());
    });

    test("timeouts", function () {
        var barrier = $.intercal.barrier(1, 1);
        testTimeout(barrier, barrier);
    });

    function testResolve(things) {
        var barrier = $.intercal.barrier(things),
            resolved = false, i;

        barrier.done(function () {
            resolved = true;
        });

        for (i = 0; i < things.length; i += 1) {
            ok(!resolved);
            if (things[i].fire) {
                things[i].fire();
            } else {
                things[i].resolve();
            }
        }

        ok(resolved);
    }

    test("resolves for single callback", function () {
        testResolve([$.Callbacks()]);
    });

    test("resolves for single deferred", function () {
        testResolve([$.Deferred()]);
    });

    test("resolves mixed", function () {
        testResolve([$.Deferred(), $.Callbacks()]);
    });

    test("firing the same callback twice doesn't resolve if another is waiting", function () {
        var cb1 = $.Callbacks(), cb2 = $.Callbacks(),
            barrier = $.intercal.barrier([cb1, cb2]),
            resolved = false;

        barrier.done(function () {
            resolved = true;
        });

        cb1.fire();
        cb1.fire();
        ok(!resolved);
        cb2.fire();
        ok(resolved);
    });

    test("returns status", function () {
        var cb1 = $.Callbacks(), cb2 = $.Callbacks(),
            barrier = $.intercal.barrier([cb1, cb2]),
            statsBefore, statsBetween, statsAfter;

        stop();

        setTimeout(function () {
            start();

            statsBefore = barrier.status();
            cb1.fire();
            statsBetween = barrier.status();
            cb2.fire();
            statsAfter = barrier.status();

            console.log(statsBefore, statsBetween, statsAfter);

            equal(statsBefore.total, 2);
            equal(statsBetween.total, 2);
            equal(statsAfter.total, 2);

            equal(statsBefore.remaining, 2);
            equal(statsBetween.remaining, 1);
            equal(statsAfter.remaining, 0);

            equal(statsBefore.completed, 0);
            equal(statsBetween.completed, 1);
            equal(statsAfter.completed, 2);

            equal(statsBefore.remainingTime, -1);
            equal(statsBetween.remainingTime, -1);
            equal(statsAfter.remainingTime, -1);

            equal(statsBefore.endTime, -1);
            equal(statsBetween.endTime, -1);
            ok(statsAfter.endTime > 0);

            equal(statsBefore.totalTime, -1);
            equal(statsBetween.totalTime, -1);
            ok(statsAfter.totalTime > 0);

            ok(statsBefore.ellapsedTime > 0);
            ok(statsBetween.ellapsedTime > 0);
            ok(statsAfter.ellapsedTime > 0);

            equal(statsBefore.timedOut, false);
            equal(statsBetween.timedOut, false);
            equal(statsAfter.timedOut, false);

            equal(statsBefore.finished, false);
            equal(statsBetween.finished, false);
            equal(statsAfter.finished, true);
        }, 100);
    });

    test("returns status for timedout barrier", function () {
        var cb1 = $.Callbacks(), cb2 = $.Callbacks(),
            barrier = $.intercal.barrier([cb1, cb2], 1),
            stats;

        stop();

        setTimeout(function () {
            start();
            stats = barrier.status();

            equal(stats.timedOut, true);
            equal(stats.finished, false);
        }, 100);
    });

}());
