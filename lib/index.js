'use strict';

const squeeze = require('good-squeeze').Squeeze;
const hoek = require('hoek');
const bugsnag = require('bugsnag');

const internals = {
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

internals.onData = (data) => {
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

internals.handleError = (data) => {

    data || (data = {});

    delete data.error;
    delete data.toJSON;

    bugsnag.notify(data.error, data);
};

internals.handleRequestError = (data) => {

    const err = internals.getErrorFromData(data);

    if (!err) {
        return;
    }

    const errorName = err.toString().replace('Error: ', '');
    const options = Object.assign({}, data, {
        errorName: errorName,
        context: data.path,
        groupingHash: data.event,
        severity: 'error'
    });

    bugsnag.notify(err, options);
};

internals.handleLogError = (data) => {

    const err = internals.getErrorFromData(data);

    if (!err) {
        return;
    }

    const errorName = err.toString().replace('Error: ', '');

    bugsnag.notify(err, Object.assign({}, data, {
        errorName: errorName,
        groupingHash: data.event,
        severity: 'error'
    }));
};

internals.getErrorFromData = (data) => {

    if (data instanceof Error) {
        return data;
    }

    if (data.error) {
        return data.error;
    }

    if (data.err) {
        return data.err;
    }

    const jsonString = JSON.stringify(data);
    const message = `error log message found without an error. Add "{error: new Error()}" to the log data: ${jsonString}`;
    const err = new Error(message);

    bugsnag.notify(err, data);
};

module.exports = internals.GoodBugsnag = (events, config) => {

    if (!(this instanceof internals.GoodBugsnag)) {
        return new internals.GoodBugsnag(events, config);
    }

    config = config || {};
    hoek.assert(config.apiKey, 'config.apiKey must be a string.');

    bugsnag.register(config.apiKey, hoek.applyToDefaults(internals.defaults.config, config));

    this.squeeze = squeeze(hoek.applyToDefaults(internals.defaults.events, events));
};


internals.GoodBugsnag.prototype.init = (stream, emitter, done) => {

    this.squeeze.on('data', internals.onData.bind(internals));

    stream.pipe(this.squeeze);
    done();
};
