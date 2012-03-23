/*global ok equal deepEqual fail test module start stop*/
(function () {
    "use strict";

    function looksLikeDeferred(thing) {
        return thing.pipe && thing.progress && thing.promise && thing.then;
    }

    function looksLikeCallback(thing) {
        return thing.lock && thing.locked && thing.fire && thing.fireWith;
    }

    function looksLikePublicCallback(thing) {
        return thing.has && thing.add && thing.remove && thing.locked;
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
            if ($.isFunction(data)) {
                data();
            } else {
                $.intercal(data);
            }

            fail("should raise exception: " + exceptionName);
        } catch (error) {
            equal(error.name, exceptionName, "error name should be " + exceptionName);
        }
    }

    function cbs() {
        return $.Callbacks();
    }

    function dfd() {
        return $.Deferred();
    }

    module("intercal");

    test("empty constructor", function () {
        var ic1 = $.intercal(),
            ic2 = $.intercal({});

        ok(ic1);
        deepEqual(ic1.once, {"reset": ic1.once.reset});
        deepEqual(ic1.on, {"then": ic1.on.then});
        ok($.isFunction(ic1.once.reset.done));

        ok(ic2);
        deepEqual(ic2.once, {"reset": ic2.once.reset});
        deepEqual(ic2.on, {"then": ic2.on.then});
        ok($.isFunction(ic2.once.reset.done));

        ok($.intercal.barrier());
    });

    test("create simple deferred", function () {
        var ic = $.intercal({"once": {"simple": ""}});

        ok(looksLikeDeferred(ic.once.simple));
        ok(looksLikePromise(ic.api.once().simple));
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

    test("reset works", function () {
        var ic1 = $.intercal(),
            ic2 = $.intercal({"once": {"simple": ""}});

        deepEqual(ic1.once, {"reset": ic1.once.reset});
        ic1.once.reset();
        deepEqual(ic1.once, {"reset": ic1.once.reset});
        ok($.isFunction(ic1.once.reset.done));

        ok(looksLikePromise(ic2.api.once().simple));
        ic2.once.reset();
        ok(looksLikePromise(ic2.api.once().simple));
        ok(looksLikeDeferred(ic2.once.simple));
        ok($.isFunction(ic2.once.reset.done));
    });

    test("reset subscriptions work after reset", function () {
        var ic = $.intercal(), count = 0;

        ic.once.reset.done(function () {
            count += 1;
        });

        ic.once.reset();
        ic.once.reset();
        ic.once.reset();

        equal(count, 3);
    });

    test("callback set to deferred before reset shouldn't be called after reset", function () {
        var ic = $.intercal({"once": {"stuff": ""}}), count = 0;

        ic.once.stuff.done(function () {
            count += 1;
        });

        ic.once.reset();
        ic.once.stuff.resolve();

        equal(count, 0);
    });

    test("public callback set to deferred before reset shouldn't be called after reset", function () {
        var ic = $.intercal({"once": {"stuff": ""}}), count = 0;

        ic.api.once().stuff.done(function () {
            count += 1;
        });

        ic.once.reset();
        ic.once.stuff.resolve();

        equal(count, 0);
    });

    test("create simple callback", function () {
        var ic = $.intercal({"on": {"simple": ""}});
        ok(looksLikeCallback(ic.on.simple));
        ok(looksLikePublicCallback(ic.api.on().simple));
    });

    test("create simple child callbacks", function () {
        var ic = $.intercal({"on": {"page": "ready close"}});

        ok(looksLikeCallback(ic.on.page.ready));
        ok(looksLikeCallback(ic.on.page.close));

        ok(looksLikePublicCallback(ic.api.on().page.ready));
        ok(looksLikePublicCallback(ic.api.on().page.close));
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

        ok(looksLikePublicCallback(ic.api.on().page.ready.done));
        ok(looksLikePublicCallback(ic.api.on().page.ready.fail.horribly));
        ok(looksLikePublicCallback(ic.api.on().page.ready.fail.withStyle));
    });

    test("then is fired for simple callback", function () {
        var ic = $.intercal({"on": {"simple": ""}}), value = 0, pvalue;

        ic.on.simple.then(function (param) {
            value = param;
        });

        ic.api.on().simple.then(function (param) {
            pvalue = param;
        });

        ic.on.simple.fire(42);

        equal(value, 42);
        equal(pvalue, 42);
    });

    test("then is fired for callback list", function () {
        var ic = $.intercal({"on": {"simple": "first second"}}),
            value = 0, pvalue = 0;

        ic.on.simple.then(function (param) {
            value = param;
        });

        ic.api.on().simple.then(function (param) {
            pvalue = param;
        });

        ic.on.simple.first.fire(42);
        equal(value, 42);
        equal(pvalue, 42);

        ic.on.simple.second.fire(99);
        equal(value, 99);
        equal(pvalue, 99);
    });

    test("then is fired for callback object", function () {
        var
            ic = $.intercal({
                "on": {
                    "simple": {
                        "first": "done",
                        "second": "done"
                    }
                }
            }),
            value = 0, value1 = 0, value2 = 0,
            pvalue = 0, pvalue1 = 0, pvalue2 = 0;

        ic.on.simple.then(function (param) {
            value = param;
        });

        ic.on.simple.first.then(function (param) {
            equal(ic.on.simple.first.done, this);
            value1 = param;
        });

        ic.on.then(function (param) {
            value2 = param;
        });

        ic.api.on().simple.then(function (param) {
            pvalue = param;
        });

        ic.api.on().simple.first.then(function (param) {
            equal(ic.on.simple.first.done, this);
            pvalue1 = param;
        });

        ic.api.on().then(function (param) {
            pvalue2 = param;
        });

        ic.on.simple.first.done.fire(42);
        equal(value, 42);
        equal(value1, 42);
        equal(value2, 42);
        equal(pvalue, 42);
        equal(pvalue1, 42);
        equal(pvalue2, 42);

        ic.on.simple.second.done.fire(99);
        equal(value, 99);
        equal(value1, 42);
        equal(value2, 99);
        equal(pvalue, 99);
        equal(pvalue1, 42);
        equal(pvalue2, 99);
    });

    test("fail with reserved callback name in simple callback", function () {
        shouldTrow({"on": {"then": ""}}, "intercal.Error");
    });

    test("fail with reserved callback name in simple nested callback", function () {
        shouldTrow({"on": {"simple": "then"}}, "intercal.Error");
        shouldTrow({"on": {"simple": "foo then"}}, "intercal.Error");
    });

    test("fail with reserved callback name in nested callbacks", function () {
        shouldTrow({"on": {"nested": {"then": ""}}}, "intercal.Error");
        shouldTrow({"on": {"nested": {"foo": "then"}}}, "intercal.Error");
        shouldTrow({"on": {"nested": {"foo": "bar then"}}}, "intercal.Error");
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
        barrier.add(cbs());
        ok(barrier.locked());
    });

    test("locks automatically with items in construction", function () {
        var barrier = $.intercal.barrier([cbs()]);
        ok(barrier.locked());
    });

    test("locks manually", function () {
        var barrier = $.intercal.barrier();

        ok(!barrier.locked());
        barrier.add(cbs());
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

        barrier.add(cbs());

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

    function testAny(things, count) {
        count = count || 1;
        var barrier = $.intercal.any(things, count),
            resolved = false, i;

        barrier.done(function () {
            resolved = true;
        });

        for (i = 0; i < things.length; i += 1) {

            if (i >= count) {
                equal(resolved, true, "resolved should be true, count " + count + " i " + i);
            } else {
                equal(resolved, false, "resolved shouldn't be true, count " + count + " i " + i);
            }

            if (things[i].fire) {
                things[i].fire();
            } else {
                things[i].resolve();
            }
        }

        equal(resolved, true, "should be resolved at the end");
    }

    test("resolves for single callback", function () {
        testResolve([cbs()]);
    });

    test("resolves for single deferred", function () {
        testResolve([dfd()]);
    });

    test("resolves mixed", function () {
        testResolve([dfd(), cbs()]);
    });

    test("firing the same callback twice doesn't resolve if another is waiting", function () {
        var cb1 = cbs(), cb2 = cbs(),
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
        var cb1 = cbs(), cb2 = cbs(),
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
        var cb1 = cbs(), cb2 = cbs(),
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

    test("any", function () {
        testAny([cbs()]);
        testAny([cbs(), cbs(), cbs()]);
        testAny([cbs(), cbs(), cbs()], 2);
        testAny([cbs(), cbs(), cbs()], 3);
    });

    test("waiting for more than itemCount should raise an exception", function () {
        function createBarrier(items, count) {
            return function () {
                $.intercal.barrier(items, 0, count);
            };
        }

        shouldTrow(createBarrier(1, 2), "intercal.Error");
        shouldTrow(createBarrier([cbs()], 2), "intercal.Error");
    });

    test("locking before reaching itemCount should fail", function () {
        shouldTrow(function () {
            $.intercal.barrier(2).lock();
        }, "intercal.Error");
    });

}());
