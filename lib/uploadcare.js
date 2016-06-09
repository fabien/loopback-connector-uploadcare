var assert = require('assert');
var stream = require('stream');
var util = require('util');
var _ = require('lodash');
var traverse = require('traverse');

var Connector = require('loopback-connector').Connector;

module.exports = Uploadcare;

function Uploadcare(settings) {
    Connector.call(this, 'uploadcare', settings);
    
    assert(typeof settings === 'object', 'cannot initialize Uploadcare connector without a settings object');
    assert(typeof settings.publicKey === 'string', 'cannot initialize Uploadcare connector without a publicKey');
    assert(typeof settings.privateKey === 'string', 'cannot initialize Uploadcare connector without a privateKey');
    this.config = settings;
    this.uploadcare = require('uploadcare')(settings.publicKey, settings.privateKey);
};

util.inherits(Uploadcare, Connector);

Uploadcare.initialize = function(dataSource, callback) {
    var connector = new Uploadcare(dataSource.settings);
    dataSource.connector = connector; // Attach connector to dataSource
    connector.dataSource = dataSource; // Hold a reference to dataSource
    process.nextTick(callback);
};

Uploadcare.prototype.define = function(modelDefinition) {
    modelDefinition.properties = modelDefinition.properties || {};
    modelDefinition.properties['id'] = { type: String, id: true };
    modelDefinition.properties['storedAt'] = { type: Date };
    modelDefinition.properties['removedAt'] = { type: Date };
    modelDefinition.properties['uploadedAt'] = { type: Date };
    Connector.prototype.define.call(this, modelDefinition);
};

Uploadcare.prototype.create = function (model, data, options, callback) {
    if (_.isFunction(options)) callback = options, options = {};
    options = _.extend({}, options);
    var store = this.config.store || options.store;
    
    var created = function(err, id) {
        if (err) return callback(err);
        if (store) {
            this.uploadcare.files.store(id, function(err, res) {
                callback(err, id);
            });
        } else {
            callback(null, id);
        }
    }.bind(this);
    
    if (data.file instanceof stream.Readable && _.isString(data.file.path)) {
        this.uploadcare.file.upload(data.file, function(err, res) {
            if (!err && res && res.file) {
                created(err, res.file);
            } else {
                callback(err || new Error('Invalid upload'));
            }
        });
    } else if (_.isString(data.url)) {
        this.uploadcare.file.fromUrl(data.url, function(err, res) {
            if (!err && res && res.uuid) {
                created(err, res.uuid);
            } else {
                callback(err || new Error('Invalid upload'));
            }
        });
    } else {
        callback(new Error('Invalid upload'));
    }
};

Uploadcare.prototype.find = function find(model, id, callback) {
    this.uploadcare.files.info(id, function(err, res) {
        if (err) return callback(err);
        callback(null, res && parseUploadcareInfo(res));
    });
};

Uploadcare.prototype.all = function all(model, filter, callback) {
    filter = filter || {};
    var idName = this.idName(model);
    if (filter.where && _.isString(filter.where[idName])) {
        this.find(model, filter.where[idName], function(err, item) {
            callback(err, (err || !item) ? [] : [item]);
        });
    } else {
        this.uploadcare.files.list(buildQuery(filter), function(err, res) {
            if (err) return callback(err);
            callback(null, _.map(res.results, parseUploadcareInfo));
        });
    }
};

Uploadcare.prototype.exists = function (model, id, callback) {
    this.find(model, id, function(err, data) {
        callback(err, err ? false : _.isObject(data) && !_.isDate(data.removedAt));
    });
};

Uploadcare.prototype.count = function count(model, callback, where) {
    var idName = this.idName(model);
    if (_.isObject(where) && _.isString(where[idName])) {
        this.exists(model, where[idName], function(err, exists) {
            callback(err, exists ? 1 : 0);
        });
    } else {
        this.uploadcare.files.list(buildQuery({ where: where }), function(err, res) {
            callback(err, _.isObject(res) && res.total ? res.total : 0);
        });
    }
};

Uploadcare.prototype.destroy = function destroy(model, id, callback) {
    this.uploadcare.files.remove(id, function(err, res) {
        var count = _.isObject(res) && _.isString(res.datetime_removed) ? 1 : 0;
        callback(err, { count: count });
    });
};

Uploadcare.prototype.destroyAll = function destroyAll(model, where, callback) {
    var idName = this.idName(model);
    if (_.isObject(where) && _.isString(where[idName])) {
        this.destroy(model, where[idName], callback);
    } else {
        callback(new Error('Not Implemented'));
    }
};

Uploadcare.prototype.parseUploadcareInfo = parseUploadcareInfo;

function buildQuery(filter) {
    var query = {};
    var where = _.extend({}, filter.where);
    if (_.isBoolean(where.stored)) query.stored = where.stored;
    if (_.isBoolean(where.removed)) query.removed = where.removed;
    
    var sort = _.isString(filter.order) && filter.order.toLowerCase();
    if (sort === 'uploadedat') query.sort = 'uploaded-time';
    if (sort === 'uploadedat desc') query.sort = '-uploaded-time';
    if (sort === 'size') query.sort = 'size';
    if (sort === 'size desc') query.sort = '-size';
    
    if (_.isNumber(filter.limit)) query.limit = filter.limit;
    
    if (_.isString(filter.from) || _.isDate(filter.from)) {
        query.from = String(filter.from);
    }
    
    if (!query.from && (_.isString(filter.to) || _.isDate(filter.to))) {
        query.to = String(filter.to);
    }
    
    return query;
};

function formatData(obj, callback) {
    var cloned = _.cloneDeep(obj);
    traverse(cloned).forEach(function(val) {
        if (this.key && _.isString(this.key)) {
            this.delete();
            callback(this, val);
        }
    });
    return cloned;
};

function parseUploadcareInfo(info) {
    return formatData(info, function(node, val) {
        if (node.key.indexOf('datetime_') === 0) {
            node.key = _.camelCase(node.key.slice(9) + '_at');
            if (_.isString(val)) val = new Date(val);
        } else if (node.key === 'uuid') {
            node.key = 'id';
        } else {
            node.key = _.camelCase(node.key);
        }
        if (!_.isNull(val)) node.update(val);
    });
};
