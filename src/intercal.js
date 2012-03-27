(function ($) {
    "use strict";
    var intercal;

    function buildDeferreds(onces, obj, external, isTopLevel) {
        var key, value, names, i, name;

        for (key in onces) {
            value = onces[key];

            if (isTopLevel && key === "reset") {
                throw new intercal.Error("using reserved name for toplevel deferred: " + key);
            }

            if ($.isPlainObject(value)) {
                // if the value is an object create the nested deferreds
                external[key] = {};
                obj[key] = buildDeferreds(value, {}, external[key]);

            } else if (value === "") {
                // if the value is an empty string construct the deferred here
                obj[key] = $.Deferred();
                external[key] = obj[key].promise();
            } else {
                // if the value is a space separated string construct
                // the child deferreds
                names = onces[key].split(/\s+/);
                obj[key] = {};
                external[key] = {};

                for (i = 0; i < names.length; i += 1) {
                    name = names[i];

                    if (name !== "") {
                        obj[key][name] = $.Deferred();
                        external[key][name] = obj[key][name].promise();
                    }
                }
            }
        }

        return obj;
    }

    function makePublicCallbackAPI(callback) {
        return {
            // NOTE: you can reach the original callback with the this parameter
            // on your callback, not sure if it's worth preventing
            "add": callback.add,
            "has": callback.has,
            "remove": callback.remove,
            "locked": callback.locked
        };
    }

    function buildCallbacks(events, obj, external) {
        var key, value, names, i, name, callback, listener,
            globalListener = $.Callbacks();

        function listenCallback(callback, listener) {
            listener = listener || $.Callbacks();

            callback.add(listener.fire);

            return listener;
        }

        for (key in events) {
            value = events[key];
            listener = $.Callbacks();

            if (key === "then") {
                throw new intercal.Error("using reserved name for callback: " + key);
            }

            if ($.isPlainObject(value)) {
                // if the value is an object create the nested callbacks
                external[key] = {};
                obj[key] = buildCallbacks(value, {}, external[key]);
                obj[key].then(listener.fire);

            } else if (value === "") {
                // if the value is an empty string construct the callback here
                obj[key] = $.Callbacks();
                external[key] = makePublicCallbackAPI(obj[key]);
                listenCallback(obj[key], listener);
            } else {
                // if the value is a space separated string construct
                // the child callbacks
                names = events[key].split(/\s+/);
                obj[key] = {"then": listener.add};
                external[key] = {"then": listener.add};

                for (i = 0; i < names.length; i += 1) {
                    name = names[i];

                    if (name === "then") {
                        throw new intercal.Error("using reserved name for callback: " + name);
                    } else if (name !== "") {
                        obj[key][name] = $.Callbacks();
                        external[key][name] = makePublicCallbackAPI(obj[key][name]);
                        listenCallback(obj[key][name], listener);
                    }
                }
            }

            obj[key].then = listener.add;
            external[key].then = listener.add;
            listener.add(globalListener.fire);
        }

        obj.then = globalListener.add;
        external.then = globalListener.add;

        return obj;
    }


    function buildRequester(intercalInstance, path, method, options, noBodyMethod) {
        if (noBodyMethod) {
            return function (params, callOptions) {
                var
                    interpolatedPath = intercal.template(path, params),
                    mergedOptions = $.extend(true, {}, options || {}, callOptions || {});

                return intercalInstance.request(interpolatedPath, null, method, mergedOptions);
            };
        } else {
            return function (body, params, callOptions) {
                var
                    interpolatedPath = intercal.template(path, params),
                    mergedOptions = $.extend(true, {}, options || {}, callOptions || {});

                return intercalInstance.request(interpolatedPath, body, method, mergedOptions);
            };
        }
    }

    function buildRequesters(methods, options, intercalInstance) {
        var key, method, path, name, obj = {}, isNoBodyMethod;

        for (key in methods) {
            path = methods[key];
            method = key.toUpperCase();
            isNoBodyMethod = $.inArray(method, intercal._.noBodyMethods) !== -1;

            // if method has no map in httpMethodMap use the original key
            // to preserve case
            name = intercal._.httpMethodMap[method] || key;
            obj[name] = buildRequester(intercalInstance, path, method, options, isNoBodyMethod);
        }

        return obj;
    }

    function buildResourceHandlers(resources, obj, globalConfig, intercalInstance) {
        var key, config, resource, method, methods = {}, parts, i;

        for (key in resources) {
            resource = resources[key];
            // merge global config with resource-specific config
            config = $.extend(true, {}, globalConfig, resource.config || {});

            if (typeof resource.path === "string") {
                methods = {
                    "get": resource.path,
                    "post": resource.path,
                    "put": resource.path,
                    "delete": resource.path
                };
            } else if ($.isPlainObject(resource.path)) {
                for (method in resource.path) {
                    parts = method.split(/\s+/);

                    for (i = 0; i < parts.length; i += 1) {
                        if (parts[i] === "") {
                            continue;
                        }

                        methods[parts[i]] = resource.path[method];
                    }
                }
            } else {
                throw new intercal.Error("resource path missing");
            }

            obj[key] = buildRequesters(methods, config, intercalInstance);
        }
    }

    function now() {
        return (new Date()).getTime();
    }

    function formatParams(options) {
        var str = "", first = true, option, key;

        for (key in options) {
            if (first) {
                str += "?";
            }

            option = options[key];

            if (option !== undefined && option !== null) {
                if (!first) {
                    str += "&";
                }

                str += key + "=" + option;
            }

            first = false;
        }

        return str;
    }

    // join a list of path parts with slashes
    // the last parameter can be an object with the params to
    // be appended
    function joinPath() {
        var i, current, accum = [];

        for (i = 0; i < arguments.length; i += 1) {
            current = arguments[i];

            if (typeof current === "string") {
                if (i !== 0 && current.charAt(0) === "/") {
                    current = current.slice(1);
                }

                if (current.charAt(current.length - 1) === "/") {
                    current = current.slice(0, current.length - 1);
                }

                accum.push(current);
            } else {
                // if it's not a string it should be a plain object
                // with the params
                // return here with the path since it should be the
                // last argument
                return accum.join("/") + formatParams(current);
            }

        }

        return accum.join("/");
    }

    function joinPathList(paths, params) {
        return joinPath.apply(null, paths.concat([params || {}]));
    }

    // parse path given as param, if undefined parse the current path
    // in the location variable
    function parsePath(path) {
        var i, parts, valparts, result = {}, key, value, pathname, query;

        if (path === undefined) {
            pathname = location.pathname;
            query = location.search.slice(1);
        } else {
            parts = path.split("?");
            pathname = parts[0];
            query = parts[1] || "";
        }

        parts = query.split("&");

        for (i = 0; i < parts.length; i += 1) {
            valparts = parts[i].split("=");

            if (valparts.length !== 2) {
                continue;
            }

            key = $.trim(valparts[0]);
            value = $.trim(valparts[1]);
            result[key] = value;
        }

        return {
            "path": pathname,
            "params": result
        };
    }

    function addParam(path, name, value) {
        var sep;
        if (path.indexOf("?") !== -1) {
            sep = "&";
        } else {
            sep = "?";
        }

        return path + sep + name + "=" + value;
    }

    function request(path, body, method, options) {
        var opts = {}, tvar;

        if (options.basePath) {
            path = intercal.path.join(options.basePath, path);
        }

        if (options.addTimestampParam) {
            path = addParam(path, options.timestampParamName || "t", intercal.now());
        }

        if (body) {
            if (options.contentType === "application/json") {
                opts.data = JSON.stringify(body);
            } else {
                opts.data = body;
            }
        }

        if (options.contentType) {
            opts.contentType = options.contentType;
        }

        opts.type = method || "GET";

        if (options.timeout) {
            opts.timeout = options.timeout;
        }

        return $.ajax(path, opts);
    }

    intercal = function (data) {
        data = data || {};

        var
            // once definitions
            onces = data.once || {},
            // event definitions
            events = data.on || {},
            // resource definitions
            resources = data.resource || {},
            // the object to be returned
            obj = {
                "once": {},
                "on": {},
                "resource": {}
            },
            resetCallback,
            // external deferred API
            onceAPI = {},
            // external callback API
            eventAPI = {},
            // flag that should update onceAPI
            shouldUpdateOnceAPI = false;

        buildCallbacks(events, obj.on, eventAPI);
        buildResourceHandlers(resources, obj.resource, data.resourceConfig || {}, obj);

        resetCallback = $.Callbacks();

        function reset() {
            onceAPI = {};
            obj.once = buildDeferreds(onces, {"reset": obj.once.reset || reset}, onceAPI, true);
            shouldUpdateOnceAPI = true;
            resetCallback.fire();
        }

        function buildOnceAPI() {
            return onceAPI;
        }

        function buildOnAPI(events) {
            return eventAPI;
        }

        reset.done = resetCallback.add;

        // build deferreds for the first time
        reset();

        obj.api = {
            once: buildOnceAPI,
            on: buildOnAPI
        };

        obj.request = request;

        return obj;
    };

    intercal.barrier = function (itemCount, timeout, waitCompletedCount) {
        var
            // if it doesn't accept more additions
            locked = false,
            // items to wait for
            items = [],
            // total number of items after it's locked
            total = 0,
            // number of completed items
            completed = 0,
            // time it was locked
            startTime = 0,
            // time all items were completed
            endTime = -1,
            // the deferred to use
            barrier = $.Deferred(),
            // callback list for timeout
            timeoutList = $.Callbacks("once memory"),
            // the id from the timeout to cancel it later
            timeoutId = null,
            // flag to know if it already timed out
            timedOut = false,
            // list of list of arguments from failed deferreds
            failedArgs = [],
            // the promise for the barrier
            promise,
            // object to return from this function
            obj,
            tmpItems;

        itemCount = itemCount || 0;
        timeout = timeout || 0;

        function fireTimeout() {
            timedOut = true;
            timeoutList.fire();
            barrier.reject('timeout');
        }

        function lock() {

            if (items.length === 0) {
                throw new intercal.Error("trying to lock a barrier with no actions");
            } else if (itemCount > 0 && items.length !== itemCount) {
                throw new intercal.Error("trying to lock a barrier before reaching itemCount");
            }

            locked = true;
            total = items.length;
            startTime = intercal.now();

            if (timeout > 0) {
                timeoutId = setTimeout(fireTimeout, timeout);
            }
        }

        function arrayRemove(arr, element) {
            var i;

            for (i = 0; i < arr.length; i += 1) {
                if (element === arr[i]) {
                    arr.splice(i, 1);
                }
            }

            return arr;
        }

        function checkCompletion() {
            if (timedOut) {
                return;
            }

            // if all completed
            if (waitCompletedCount === (total - items.length)) {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }

                endTime = intercal.now();

                if (failedArgs.length === 0) {
                    barrier.resolve();
                } else {
                    barrier.reject(failedArgs);
                }
            }
        }

        function listenForCompletion(action) {

            function actionFired() {
                arrayRemove(items, action);
                // unsubscribe if it's a callback
                if (action.add && action.has) {
                    action.remove(actionFired);
                }

                checkCompletion();
            }

            if (action.add && action.has) {
                // if is a callbacks object

                action.add(actionFired);
            } else {
                // it must be a deferred/promise
                action.done(actionFired);
                action.fail(function () {
                    failedArgs.push($.makeArray(arguments));
                    actionFired();
                });
            }
        }

        function add(item) {
            var i, action;

            if (!$.isArray(item)) {
                item = [item];
            }

            if (!locked) {
                for (i = 0; i < item.length; i += 1) {
                    action = item[i];
                    items.push(action);

                    listenForCompletion(action);

                    if (items.length === itemCount) {
                        lock();
                        break;
                    }
                }

            }
        }

        // if the first parameter is an array, add the items and lock
        // set the length of the array to itemCount
        if ($.isArray(itemCount)) {
            tmpItems = itemCount;
            itemCount = tmpItems.length;
            add(tmpItems);
        }

        // number of items to wait for completion, by default wait until all
        // are completed
        waitCompletedCount = waitCompletedCount || itemCount;

        if (waitCompletedCount > itemCount) {
            throw new intercal.Error("waitCompletedCount can't be bigger than itemCount, will wait forever: " + waitCompletedCount + " > " + itemCount);
        }

        promise = barrier.promise({timeout: timeoutList.add});


        obj = barrier.promise({
            lock: lock,

            locked: function () {
                return locked;
            },

            add: add,

            timeout: timeoutList.add,

            status: function () {
                var completed = total - items.length,
                    totalTime = -1,
                    remainingTime = -1;

                if (endTime > 0) {
                    totalTime = endTime - startTime;
                }

                return {
                    // total number of items waiting for
                    total: total,
                    // number of items that already completed
                    completed: completed,
                    // number of items still waiting for
                    remaining: total - completed,
                    // time the barrier was locked
                    startTime: startTime,
                    // time running since the barrier was locked
                    ellapsedTime: (endTime > 0) ? totalTime : intercal.now() - startTime,
                    // time when the barrier finished
                    endTime: endTime,
                    // total time between start and end
                    totalTime: totalTime,
                    // time remaining before timeout or -1 if already finished or timed out
                    remainingTime: (endTime < 1 && timeout > 0) ? intercal.now() - (startTime + timeout) : -1,
                    // true if the barrier finished in some way
                    finished: locked && itemCount > 0 && items.length === 0,
                    // true if the barrier timedOut
                    timedOut: timedOut
                };
            }
        });

        // override the promise function from obj (added by barrier.promise)
        // since we want the timeout function in the promise too
        obj.promise =  function () {
            return promise;
        };

        return obj;
    };

    // the global default request function
    // you can override it in your instance and then get back the original
    // here
    intercal.request = request;
    intercal.all = intercal.barrier;
    intercal.any = function (items, count, timeout) {
        return intercal.barrier(items, timeout || 0, count || 1);
    };

    // internal data exposed for testing and possible customization
    // may change in the future
    intercal._ = {
        "httpMethodMap": {
            "POST": "create",
            "PUT": "update",
            "DELETE": "remove",
            "GET": "get"
        },
        "noBodyMethods": ["GET", "DELETE", "HEAD"]
    };

    intercal.path = {
        join: joinPath,
        joinList: joinPathList,
        parse: parsePath
    };

    intercal.template = function interpolate(str, vars) {
        if (!vars) {
            return str;
        }

        return str.replace(/\{\w*?\}/g, function (match, v, t) {
            var varname = match.slice(1, match.length - 1);
            return vars[varname] || match;
        });
    };

    intercal.now = now;

    intercal.Error = function (message) {
        this.name = "intercal.Error";
        this.message = message;
    };

    $.intercal = intercal;
    return intercal;

}(jQuery));
