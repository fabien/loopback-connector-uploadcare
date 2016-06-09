var should = require('should');
var registry = require('./init');
var fs = require('fs');
var path = require('path');

describe('Connector', function() {
    
    var File;
    var ids = {};
    
    before(function(next) {
        registry.connect(function(err, models) {
            File = models.File;
            next();
        });
    });
    
    after(function(next) {
        registry.disconnect(next);
    });
    
    it('should create a new upload from a readstream', function(next) {
        var source = fs.createReadStream(path.join(__dirname, 'fixtures', 'icon.png'));
        File.create({ file: source }, function(err, file) {
            should.not.exist(err);
            file.id.should.be.a.string;
            ids.file = file.id;
            next();
        });
    });
    
    it('should create a new upload from an url', function(next) {
        var source = 'http://atelierfabien.com/images/process.jpg';
        File.create({ url: source }, { store: true }, function(err, file) {
            should.not.exist(err);
            file.id.should.be.a.string;
            ids.url = file.id;
            next();
        });
    });
    
    it('should fetch an upload', function(next) {
        File.findById(ids.file, function(err, file) {
            should.not.exist(err);
            file.id.should.equal(ids.file);
            file.originalFilename.should.equal('icon.png');
            file.mimeType.should.equal('image/png');
            file.size.should.equal(28228);
            file.isImage.should.be.true;
            file.imageInfo.width.should.equal(256);
            file.imageInfo.height.should.equal(256);
            next();
        });
    });
    
    it('should check if an upload exists', function(next) {
        File.exists(ids.file, function(err, exists) {
            should.not.exist(err);
            exists.should.be.true;
            next();
        });
    });
    
    it('should count all uploads', function(next) {
        File.count(function(err, count) {
            should.not.exist(err);
            count.should.be.a.number;
            next();
        });
    });
    
    it('should find all uploads', function(next) {
        File.find({ limit: 5 }, function(err, files) {
            should.not.exist(err);
            files.should.have.length(5);
            next();
        });
    });
    
    it ('should delete an upload', function(next) {
        File.removeById(ids.file, function(err, result) {
            should.not.exist(err);
            result.should.eql({ count: 1 });
            next();
        });
    });
    
});