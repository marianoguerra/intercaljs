(function ($) {
    "use strict";
    var intercal;

    function buildDeferreds(onces, obj, isTopLevel) {
        var key, value, names, i, name;

        for (key in onces) {
            value = onces[key];

            if (isTopLevel && key === "reset") {
                throw new intercal.Error("using reserved name for toplevel deferred: " + key);
            }

            if ($.isPlainObject(value)) {
                // if the value is an object create the nested deferreds
                obj[key] = buildDeferreds(value, {});

            } else if (value === "") {
                // if the value is an empty string construct the deferred here
                obj[key] = $.Deferred();
            } else {
                // if the value is a space separated string construct
                // the child deferreds
                names = onces[key].split(/\s+/);
                obj[key] = {};

                for (i = 0; i < names.length; i += 1) {
                    name = names[i];

                    if (name !== "") {
                        obj[key][name] = $.Deferred();
                    }
                }
            }
        }

        return obj;
    }

    function buildCallbacks(events, obj) {
        var key, value, names, i, name, callback;

        for (key in events) {
            value = events[key];

            if (key === "any") {
                throw new intercal.Error("using reserved name for callback: " + key);
            }

            if ($.isPlainObject(value)) {
                // if the value is an object create the nested callbacks
                obj[key] = buildCallbacks(value, {});

            } else if (value === "") {
                // if the value is an empty string construct the callback here
                obj[key] = $.Callbacks();
            } else {
                // if the value is a space separated string construct
                // the child callbacks
                names = events[key].split(/\s+/);
                obj[key] = {};

                for (i = 0; i < names.length; i += 1) {
                    name = names[i];

                    if (name === "any") {
                        throw new intercal.Error("using reserved name for callback: " + name);
                    } else if (name !== "") {
                        obj[key][name] = $.Callbacks();
                    }
                }
            }
        }

        return obj;
    }

    function now() {
        return (new Date()).getTime();
    }

    intercal = function (data) {
        data = data || {};

        var
            // once definitions
            onces = data.once || {},
            // event definitions
            events = data.on || {},
            // the object to be returned
            obj = {
                "once": {},
                "on": {}
            },
            resetCallback;

        buildCallbacks(events, obj.on);

        resetCallback = $.Callbacks();

        function reset() {
            obj.once = buildDeferreds(onces, {"reset": obj.once.reset || reset}, true);
            resetCallback.fire();
        }

        reset.done = resetCallback.add;

        // build deferreds for the first time
        reset();

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
            startTime = now();

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

                endTime = now();

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
                    ellapsedTime: (endTime > 0) ? totalTime : now() - startTime,
                    // time when the barrier finished
                    endTime: endTime,
                    // total time between start and end
                    totalTime: totalTime,
                    // time remaining before timeout or -1 if already finished or timed out
                    remainingTime: (endTime < 1 && timeout > 0) ? now() - (startTime + timeout) : -1,
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

    intercal.all = intercal.barrier;
    intercal.any = function (items, count, timeout) {
        return intercal.barrier(items, timeout || 0, count || 1);
    };

    intercal.Error = function (message) {
        this.name = "intercal.Error";
        this.message = message;
    };

    $.intercal = intercal;
    return intercal;

}(jQuery));
