require('./analyst');
var Bookshelf = require('../../app').get('bookshelf');

var Message = Bookshelf.Model.extend({
  tableName: 'message',
  initialize: function () {

  },
  analyst: function () {
    return this.belongsTo('Analyst');
  }
});

module.exports = Bookshelf.model('Message', Message);