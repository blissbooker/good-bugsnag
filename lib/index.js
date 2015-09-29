'use strict';

var squeeze = require('good-squeeze').Squeeze;
var hoek = require('hoek');
var bugsnag = require('bugsnag');
var _ = require('lodash');

var internals = {
    defaults: {
        events: {
            log: 'error',
            error: '*',
            request: 'error'
        },
        config: {
            autoNotify: false
        }
    }
};

internals.onData = function (data) {
    switch (data.event) {
    case 'error':
        internals.handleError(data);
        break;
    case 'request':
        internals.handleRequestError(data);
        break;
    default:
        internals.handleLogError(data);
    }
};

internals.handleError = function (data) {
    bugsnag.notify(data.error, _.omit(data, ['error', 'toJSON']));
};

internals.handleRequestError = function (data) {
    var err = internals.getErrorFromData(data);

    if (!err) {
        return;
    }

    var errorName = err.toString().replace('Error: ', '');
    var options = _.extend({}, data, {
        errorName: errorName,
        context: data.path,
        groupingHash: data.event,
        severity: 'error'
    });

    bugsnag.notify(err, options);
};

internals.handleLogError = function (data) {
    var err = internals.getErrorFromData(data);
    if (!err) {
        return;
    }

    var errorName = err.toString().replace('Error: ', '');
    bugsnag.notify(err, _.extend({}, data, {
        errorName: errorName,
        groupingHash: data.event,
        severity: 'error'
    }));
};

internals.getErrorFromData = function (data) {

    if (data instanceof Error) {
        return data;
    }

    if (data.error) {
        return data.error;
    }

    if (data.err) {
        return data.err;
    }

    var jsonString = JSON.stringify(data);
    var message = 'error log message found without an error. Add "{error: new Error()}" to the log data: ' + jsonString;
    var err = new Error(message);
    bugsnag.notify(err, data);
};

module.exports = internals.GoodBugsnag = function (events, config) {

    if (!(this instanceof internals.GoodBugsnag)) {
        return new internals.GoodBugsnag(events, config);
    }

    config = config || {};
    hoek.assert(config.apiKey, 'config.apiKey must be a string.');

    bugsnag.register(config.apiKey, hoek.applyToDefaults(internals.defaults.config, config));

    this.squeeze = squeeze(hoek.applyToDefaults(internals.defaults.events, events));
};


internals.GoodBugsnag.prototype.init = function (stream, emitter, done) {
    this.squeeze.on('data', internals.onData.bind(internals));

    stream.pipe(this.squeeze);
    done();
};
