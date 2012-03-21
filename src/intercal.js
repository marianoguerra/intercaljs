(function ($) {

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

            if (key === "any"){
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

                    if (name === "any"){
                        throw new intercal.Error("using reserved name for callback: " + name);
                    } else if (name !== "") {
                        obj[key][name] = $.Callbacks();
                    }
                }
            }
        }

        return obj;
    }

    var intercal = function (data) {
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
            };

            buildDeferreds(onces, obj.once, true);
            buildCallbacks(events, obj.on);

            return obj;
    };

    intercal.barrier = function () {
        return {
        };
    };

    intercal.Error = function (message) {
        this.name = "intercal.Error";
        this.message = message;
    };

    $.intercal = intercal;
    return intercal;

}(jQuery));
