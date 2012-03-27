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

    function testResolveBeforeLock(things) {
        var barrier = $.intercal.barrier(),
            resolved = false, i;

        barrier.done(function () {
            resolved = true;
        });

        for (i = 0; i < things.length; i += 1) {
            ok(!resolved);
            barrier.add(things[i]);

            if (things[i].fire) {
                things[i].fire();
            } else {
                things[i].resolve();
            }
        }

        barrier.lock();

        ok(resolved);
    }

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

    test("resolves before lock works", function () {
        testResolveBeforeLock([]);
        testResolveBeforeLock([dfd()]);
        testResolveBeforeLock([cbs()]);
        testResolveBeforeLock([dfd(), cbs()]);
        testResolveBeforeLock([cbs(), cbs()]);
        testResolveBeforeLock([dfd(), dfd()]);
        testResolveBeforeLock([dfd(), dfd(), cbs(), dfd(), dfd(), cbs()]);
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

    module("resources");

    test("path.join", function () {
        function check(parts, params, expected) {
            var result = $.intercal.path.join.apply(null, parts.concat([params || {}]));
            equal($.intercal.path.joinList(parts, params), result);

            equal(result, expected);
        }

        check(["a"], {}, "a");
        check(["a"], null, "a");
        check(["a"], undefined, "a");
        check(["a", "b"], {}, "a/b");
        check(["/a", "b"], {}, "/a/b");
        check(["/a/", "/b"], {}, "/a/b");
        check(["/a/", "/b/"], {}, "/a/b");
        check(["/a/", "/b/", "c", "/d"], {}, "/a/b/c/d");

        check(["a"], {"p": "hi"}, "a?p=hi");
        check(["a", "b"], {"p": "hi"}, "a/b?p=hi");
        check(["/a", "b"], {"p": "hi"}, "/a/b?p=hi");
        check(["/a/", "/b"], {"p": "hi"}, "/a/b?p=hi");
        check(["/a/", "/b/"], {"p": "hi"}, "/a/b?p=hi");
        check(["/a/", "/b/", "c", "/d"], {"p": "hi"}, "/a/b/c/d?p=hi");

        check(["a"], {"p": "hi", "foo": 5, "bar": false}, "a?p=hi&foo=5&bar=false");
        check(["a", "b"], {"p": "hi", "foo": 5, "bar": false}, "a/b?p=hi&foo=5&bar=false");
        check(["/a", "b"], {"p": "hi", "foo": 5, "bar": false}, "/a/b?p=hi&foo=5&bar=false");
        check(["/a/", "/b"], {"p": "hi", "foo": 5, "bar": false}, "/a/b?p=hi&foo=5&bar=false");
        check(["/a/", "/b/"], {"p": "hi", "foo": 5, "bar": false}, "/a/b?p=hi&foo=5&bar=false");
        check(["/a/", "/b/", "c", "/d"], {"p": "hi", "foo": 5, "bar": false}, "/a/b/c/d?p=hi&foo=5&bar=false");
    });

    test("path.parse", function () {
        function check(path, expectedPath, expectedParams) {
            var result = $.intercal.path.parse(path);

            equal(result.path, expectedPath);
            deepEqual(result.params, expectedParams);
        }

        check("/a", "/a", {});
        check("/a/b", "/a/b", {});
        check("/a/b/c", "/a/b/c", {});
        check("/a/b/c?", "/a/b/c", {});
        check("/a/b/c?a=1", "/a/b/c", {"a": "1"});
        check("/a/b/c/?a=1", "/a/b/c/", {"a": "1"});
        check("/a/b/c/?a=1&b=asd", "/a/b/c/", {"a": "1", "b": "asd"});
        check("/a/b/c/?a=1&b=asd&c=false", "/a/b/c/", {"a": "1", "b": "asd", "c": "false"});
        check("/a/b/c/?a=1&b=asd&c=", "/a/b/c/", {"a": "1", "b": "asd", "c": ""});
    });

    function checkRequest(ic, req, path, body, method, options, params, noBody) {
        var original = ic.request;

        ic.request = function (p, b, m, o) {
            ic.request = original;
            equal(p, path);
            equal(m, method);

            if (noBody) {
                equal(b, undefined);
            } else {
                deepEqual(b, body);
            }

            deepEqual(o, options);
        };

        if (noBody) {
            req(params, options);
        } else {
            req(body, params, options);
        }
    }

    function checkAjaxRequest(ic, req, path, body, method, options, expectedOptions, params, noBody) {
        var original = $.ajax;

        $.ajax = function (p, opts) {
            equal(p, path);
            deepEqual(opts, expectedOptions);
        };

        if (noBody) {
            req(params, options);
        } else {
            req(body, params, options);
        }

        $.ajax = original;
    }


    test("builds resources with one path", function () {
        var ic = $.intercal({
            "resource": {
                "user": {
                    "path": "/api/user"
                }
            }
        });

        ok($.isFunction(ic.resource.user.create));
        ok($.isFunction(ic.resource.user.update));
        ok($.isFunction(ic.resource.user.remove));
        ok($.isFunction(ic.resource.user.get));

        checkRequest(ic, ic.resource.user.create, "/api/user", {"name": "pedro"}, "POST", {});
        checkRequest(ic, ic.resource.user.update, "/api/user", {"name": "pedro"}, "PUT", {});
        checkRequest(ic, ic.resource.user.get, "/api/user", {}, "GET", {}, undefined, true);
        checkRequest(ic, ic.resource.user.remove, "/api/user", {}, "DELETE", {}, undefined, true);
    });

    test("builds only specified requesters with path object", function () {
        var request, ic = $.intercal({
            "resource": {
                "user": {
                    "path": {
                        "get": "/api/user/{id}",
                        "post": "/api/user"
                    }
                }
            }
        });

        checkRequest(ic, ic.resource.user.create, "/api/user", {"name": "pedro"}, "POST", {});
        checkRequest(ic, ic.resource.user.get, "/api/user/{id}", {}, "GET", {}, undefined, true);

        ok($.isFunction(ic.resource.user.create));
        ok($.isFunction(ic.resource.user.get));
        equal(ic.resource.user.update, undefined);
        equal(ic.resource.user.remove, undefined);
    });

    test("builds only specified requesters with path object and space delimited methods", function () {
        var request, ic = $.intercal({
            "resourceConfig": {
                "contentType": "application/json"
            },
            "resource": {
                "user": {
                    "path": {
                        "get delete": "/api/user/{id}",
                        "post put": "/api/user"
                    }
                }
            }
        });

        checkRequest(ic, ic.resource.user.create, "/api/user", {"name": "pedro"}, "POST", {"contentType": "application/json"});
        checkRequest(ic, ic.resource.user.get, "/api/user/{id}", {}, "GET", {"contentType": "application/json"}, undefined, true);
        checkRequest(ic, ic.resource.user.update, "/api/user", {"name": "pedro"}, "PUT", {"contentType": "application/json"});
        checkRequest(ic, ic.resource.user.remove, "/api/user/{id}", {}, "DELETE", {"contentType": "application/json"}, undefined, true);

        ok($.isFunction(ic.resource.user.create));
        ok($.isFunction(ic.resource.user.get));
        ok($.isFunction(ic.resource.user.remove));
        ok($.isFunction(ic.resource.user.update));
    });

    test("requester overrides config", function () {
        var request, data = {"name": "pedro"},
            dataStr = JSON.stringify(data),
            ic = $.intercal({
                "resourceConfig": {
                    "contentType": "application/json"
                },
                "resource": {
                    "user": {
                        "path": {
                            "get delete": "/api/user/{id}",
                            "post put": "/api/user"
                        }
                    },
                    "session": {
                        "path": "/api/session",
                        "config": {
                            "contentType": "application/xml"
                        }
                    }

                }
            });

        checkAjaxRequest(ic, ic.resource.user.create, "/api/user", data,
                "POST", {},
                {"contentType": "application/json", "data": dataStr, "type": "POST"});
        checkAjaxRequest(ic, ic.resource.user.create, "/api/user", "asd",
                "POST", {"contentType": "application/xml"},
                {"contentType": "application/xml", "data": "asd", "type": "POST"});
        checkAjaxRequest(ic, ic.resource.session.update, "/api/session", "asd",
                "POST", {},
                {"contentType": "application/xml", "data": "asd", "type": "PUT"});
        checkAjaxRequest(ic, ic.resource.user.create,
                "/api/user", "asd", "POST", {"contentType": "text/plain"},
                {"contentType": "text/plain", "data": "asd", "type": "POST"});
    });

    test("requester adds timeout and basePath if defined in config", function () {
        var request, data = {"name": "pedro"},
            dataStr = JSON.stringify(data),
            ic = $.intercal({
                "resourceConfig": {
                    "contentType": "application/json",
                    "timeout": 1000,
                    "basePath": "/base/"
                },
                "resource": {
                    "user": {
                        "path": {
                            "get delete": "/api/user/{id}",
                            "post put": "/api/user"
                        }
                    },
                    "session": {
                        "path": "/api/session",
                        "config": {
                            "contentType": "application/xml"
                        }
                    }

                }
            });

        checkAjaxRequest(ic, ic.resource.user.create, "/base/api/user", data,
            "POST", {}, {
                "contentType": "application/json",
                "data": dataStr,
                "type": "POST",
                "timeout": 1000
            });
        checkAjaxRequest(ic, ic.resource.user.create, "/base/api/user", "asd",
            "POST", {"contentType": "application/xml"}, {
                "contentType": "application/xml",
                "data": "asd",
                "type": "POST",
                "timeout": 1000
            });
        checkAjaxRequest(ic, ic.resource.session.update, "/base/api/session",
            "asd", "POST", {"timeout": 2000}, {
                "contentType": "application/xml",
                "data": "asd",
                "type": "PUT",
                "timeout": 2000
            });
    });

    test("requester adds timestamp if defined in config", function () {
        var request, data = {"name": "pedro"},
            originalNow = $.intercal.now,
            dataStr = JSON.stringify(data),
            ic = $.intercal({
                "resourceConfig": {
                    "addTimestampParam": true
                },
                "resource": {
                    "user": {
                        "path": {
                            "get delete": "/api/user?id={id}",
                            "post put": "/api/user"
                        }
                    },
                    "session": {
                        "path": "/api/session",
                        "config": {
                            "timestampParamName": "tmstp"
                        }
                    }

                }
            });

        $.intercal.now = function () {
            return 5;
        };

        checkAjaxRequest(ic, ic.resource.user.create, "/api/user?t=5", data,
            "POST", {}, {
                "data": data,
                "type": "POST"
            });
        checkAjaxRequest(ic, ic.resource.user.get, "/api/user?id=42&t=5", null,
            "GET", {}, {
                "type": "GET"
            }, {"id": 42}, true);
        checkAjaxRequest(ic, ic.resource.session.update, "/api/session?tmstp=5",
            "asd", "POST", {}, {
                "data": "asd",
                "type": "PUT"
            });

        $.intercal.now = originalNow;
    });

    test("requester interpolates path", function () {
        var request, data = {"name": "pedro"},
            dataStr = JSON.stringify(data),
            ic = $.intercal({
                "resource": {
                    "user": {
                        "path": {
                            "get": "/api/user/{id}",
                            "delete": "/api/user/{id}/{rev}",
                            "post put": "/api/user"
                        }
                    }
                }
            });

        checkAjaxRequest(ic, ic.resource.user.get, "/api/user/2", null,
                "GET", {}, {"type": "GET"}, {"id": 2}, true);
        checkAjaxRequest(ic, ic.resource.user.remove, "/api/user/2/asd", null,
                "DELETE", {}, {"type": "DELETE"}, {"id": 2, "rev": "asd"}, true);
    });

    test("resource creation fails if no path defined", function () {
        shouldTrow({"resource": {"user": {}}}, "intercal.Error");
    });

    module("template");

    test("template replaces placeholders", function () {
        function check(str, vars, expected) {
            equal($.intercal.template(str, vars), expected, "'" + str + "' => '" + expected + "'?");
        }

        check("", {"a": "r"}, "");
        check("a", {"a": "r"}, "a");
        check("{a}", {"a": "r"}, "r");
        check(" {a} ", {"a": "r"}, " r ");
        check("{a} {a}", {"a": "r"}, "r r");
        check("{a} y {a}", {"a": "r"}, "r y r");
        check("{a} y {b} y {a}", {"a": "r", "b": "r1"}, "r y r1 y r");

        check("", {"A": "r"}, "");
        check("a", {"A": "r"}, "a");
        check("{A}", {"A": "r"}, "r");
        check(" {A} ", {"A": "r"}, " r ");
        check("{A} {A}", {"A": "r"}, "r r");
        check("{A} y {A}", {"A": "r"}, "r y r");
        check("{A} y {b} y {A}", {"A": "r", "b": "r1"}, "r y r1 y r");

        check("", {"varname": "r"}, "");
        check("a", {"varname": "r"}, "a");
        check("{varname}", {"varname": "r"}, "r");
        check(" {varname} ", {"varname": "r"}, " r ");
        check("{varname} {varname}", {"varname": "r"}, "r r");
        check("{varname} y {varname}", {"varname": "r"}, "r y r");
        check("{varname} y {b} y {varname}", {"varname": "r", "b": "r1"}, "r y r1 y r");

        check("", {"VARNAME1": "r"}, "");
        check("a", {"VARNAME1": "r"}, "a");
        check("{VARNAME1}", {"VARNAME1": "r"}, "r");
        check(" {VARNAME1} ", {"VARNAME1": "r"}, " r ");
        check("{VARNAME1} {VARNAME1}", {"VARNAME1": "r"}, "r r");
        check("{VARNAME1} y {VARNAME1}", {"VARNAME1": "r"}, "r y r");
        check("{VARNAME1} y {b} y {VARNAME1}", {"VARNAME1": "r", "b": "r1"}, "r y r1 y r");

        check("", {"varName1": "r"}, "");
        check("a", {"varName1": "r"}, "a");
        check("{varName1}", {"varName1": "r"}, "r");
        check(" {varName1} ", {"varName1": "r"}, " r ");
        check("{varName1} {varName1}", {"varName1": "r"}, "r r");
        check("{varName1} y {varName1}", {"varName1": "r"}, "r y r");
        check("{varName1} y {b} y {varName1}", {"varName1": "r", "b": "r1"}, "r y r1 y r");
    });

    test("template leaves unknown vars untouched", function () {
        function check(str, vars, expected) {
            equal($.intercal.template(str, vars), expected, "'" + str + "' => '" + expected + "'?");
        }

        check("{b}", {"a": "r"}, "{b}");
        check("a {b}", {"a": "r"}, "a {b}");
        check("{b} {a}", {"a": "r"}, "{b} r");
        check(" {a} ", {"a": "r"}, " r ");
        check("{a} {a}", {"a": "r"}, "r r");
        check("{a} y {a}", {"a": "r"}, "r y r");
        check("{a} y {b} y {a}", {"a": "r", "b": "r1"}, "r y r1 y r");
    });

}());
