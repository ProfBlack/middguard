var path = require('path'),
    settings = require('./settings')
		app = require('../../app').get;
		
var dbType = 'pg'; //USE 'pg' FOR POSTGRES DB OR 'sqlite' FOR SQLITE DB
if (dbType == 'sqlite'){
	// Add `debug: true` to the config to log SQL statements
	var development = {
	  client: 'sqlite3',
	  connection: {
	    filename: path.join(settings.root, settings.db)
	  }
	};
} else {
	var development = {
	  client: 'pg',
	  connection: {
			host     : '127.0.0.1',
	    user     : 'jabillings',
	    password : '',
	    database: 'middguard2.db'
	  }
	};
}

module.exports = {
  development: development,

  // For now, use the same setting for all envs
  staging: development,
  production: development
};