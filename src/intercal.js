(function ($) {

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

            return obj;
    };

    intercal.barrier = function () {
        return {
        };
    };

    $.intercal = intercal;
    return intercal;

}(jQuery));
