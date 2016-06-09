var juggler = require('loopback-datasource-juggler');
var Registry = require('independent-juggler');
var registry = new Registry(juggler, { dir: __dirname });

var Connector = require('../..');

registry.setupDataSource('uploadcare', {
    connector: Connector,
    publicKey: 'demopublickey',
    privateKey: 'demoprivatekey'
});

module.exports = registry;