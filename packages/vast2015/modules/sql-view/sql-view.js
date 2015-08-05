var middguard = middguard || {};

(function () {
  'use strict';
  
  var SQLView = middguard.View.extend({
    template: '<h3 style="margin:5px">"%modelName%" DB Table</h3><div class="table-view-wrapper">',
    
    className: 'SQLInteractDiv middguard-module',
    
    initialize: function(opts){
      this.model = opts.model
      this.$el.html(this.template.replace('%modelName%', this.model.get('name')));
      this.$el.attr('id', 'sql-model-view-' + this.model.get('name'));
      var globalThis = this;
      
      //create infinite scroll capability
      this.$el.scroll(function(){
        var scrollBottom = globalThis.$el.scrollTop() + globalThis.$el.height();
        if (globalThis.el.scrollHeight - scrollBottom <= 5 ) globalThis.table.addResults();
        
      })
    },
    
    render: function(){
      this.table = new TableView({model: this.model});
      this.query = new QueryView({tableView: this.table, model: this.model});
      this.$el.append(this.query.render().el);
      this.$el.append(this.table.render().el);
      return this;
    }
  });
  
  
  var QueryView = middguard.View.extend({
    className: 'query-view',
    
    template: '<h5>Query Entry</h5><div class="submission-div"><p class="query-beginning">SELECT * FROM %modelName% table WHERE:</p><div class="query-entry-div"><input type="text" id="query-text-%modelName%"class="query-text"/><input type="submit" id="query-submit-%modelName%" class="query-submit" value="Enter Query"><input type="submit" id="table-restore-%modelName%" class="table-restore" value="Restore Initial Table"></div></div>',
    
    events: {
      'click .query-submit': 'queryTrigger',
      'click .table-restore': 'restoreTable'
    },
    
    initialize: function(opts){
      this.model = opts.model;
      this.template = this.template.replace(/%modelName%/g, this.model.get('name'));
      this.$el.html(this.template);
      this.tableView = opts.tableView;
    },
    
    restoreTable: function(){
      this.tableView.numRows = 0;
      this.tableView.curOffset = 0;
      this.tableView.queryDB({}, false);
    },
    
    queryTrigger: function(){
      var qText = document.getElementById('query-text-' + this.model.get('name'));
      this.tableView.curQuery = {whereRaw: qText.value};
      this.tableView.curOffset = 0;
      this.tableView.numRows = 0;
      this.tableView.queryDB(this.tableView.curQuery, false);
    },
    
    render: function(){
      return this;
    }
    
  });

  var TableView = middguard.View.extend({
    template: '<h5>Current SQL Table/Results</h5><div class="upload"><h6 class="upload-header">Upload CSV Data:</h6><input class="csv-file" type="file" accept=".csv"><input class="file-upload" type="submit" value="Upload"><div class="dialog-box" id="dialog-box-%modelName%" title="Warning!" display="none"><p class="dialog-text" id="dialog-text-%modelName%" style="display:none">The data will only be uploaded correctly if each header column in the CSV file has the EXACT same name as a column in the database! (CSV file required to have a header)</p></div></div><div class="submit-restore-div"><input type="submit" class="enter-changes" class="submit-restore-%modelName%" id="enter-changes-%modelName%" value="Submit Changes" /><input type="submit" class="restore-edits" class="submit-restore-%modelName%" id="restore-%modelName%" value="Restore Edits" /></div><div class="table-changes" id="table-changes-%modelName%"><p class="model-name-text" id="%modelName%-model-name-text"></p></div><table id="%modelName%-table" class="SQL-table"></table>',
    
    className: 'table-view',
    
    events: {
      "click .file-upload": "uploadHandle"
    },
    
    initialize: function (opts) {
      var globalThis = this;
      this.model = opts.model;
      this.template = this.template.replace(/%modelName%/g, this.model.get('name'));
      this.$el.html(this.template);
      middguard.state.changedModels = {};
      this.curOffset = 0;
      this.curMax = 100;
      this.numRows = 0;
      this.full = false;
      this.curQuery = {};
      
      var modName = this.model.get('name');
      this.collection = new Backbone.Collection([], {model: middguard.entities[this.capitalize(pluralize(modName))].model});
      this.collection.url = pluralize(modName);
      this.queryDB(this.curQuery, false);
      this.subtracted = false;
      _.extend(this, Backbone.Events);
      this.listenTo(middguard.entities[this.capitalize(pluralize(modName))], 'remove', function(item){
        globalThis.collection.remove(item.get('id'));
        if (item.get('id') <= this.curMax) {
          globalThis.numRows = 0;
          globalThis.render(globalThis.collection, globalThis.opt, 'collect');
        }
      });
      this.listenTo(middguard.entities[this.capitalize(pluralize(modName))], 'add', function(item){
        globalThis.collection.add(item);
        if (item.get('id') <= globalThis.curMax) {
          globalThis.numRows = 0;
          globalThis.render(globalThis.collection, globalThis.opt, 'collect');
        }
      });
      middguard.entities[this.capitalize(pluralize(modName))].ioBind('update', this.serverCreate, this);
    },
    
    serverCreate: function(data){
      console.log(data);
      var modelCopy = new Backbone.Model(JSON.parse(data));
      this.collection.add(modelCopy);
      middguard.entities[this.capitalize(pluralize(modName))].add(modelCopy);
    },
    
    uploadHandle: function(){
      //function sends file uploads to the server
      var globalThis = this;
      var file = $('.csv-file')[0].files[0];
      $('#dialog-text-' + this.model.get('name')).css('display', 'inline');
      $('#dialog-box-' + this.model.get('name')).dialog({
        modal: true,
        buttons: {
          'Upload' : function(){
            $( this ).dialog( "close" );
            middguard.socket.emit('filetransfer', {file: file, filename: file.name, modelname: globalThis.model.get('name')});
          },
          Cancel: function(){
            $( this ).dialog( "close" );
          }
        }
      });
    },
    
    addResults: function(){
      if (!this.full){
        this.curOffset += 100;
        this.curMax += 100;
      }
      this.queryDB(this.curQuery, true);
    },
    
    queryDB: function(query, extend){
      var globalThis = this;
      query.limit = '100';
      query.offset = this.curOffset;
      var lastRow = (extend) ? this.numRows: 0;
      this.collection.fetch({
        data: query, source: 'tableView',
        remove: !extend,
        success: function(col, resp, opt){
          globalThis.render(resp, opt, 'nocollect');
          //we need to bind the listener for these buttons after the buttons have been added into the DOM
          $('#enter-changes-' +globalThis.model.get('name')).click(globalThis.enterChanges);
          $('#restore-' +globalThis.model.get('name')).click(function(){
            globalThis.restore(globalThis);
          });
        },
        error: function(){
          console.log('failure');
        }
      });
    },
    
    capitalize: function (string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    },
    
    enterChanges: function(){
      var globalThis = this;
      //save all changed models to DB
      for (var item in middguard.state.changedModels){
        var current = middguard.state.changedModels[item];
        var model = current.collection.findWhere({id: current.id});
        var htmlString = $('#' + item).html().trim();
        if (current.attrName === 'id'){
          htmlString = parseInt(htmlString);
          if (isNaN(htmlString)){
            console.log(Error('id value must be a unique integer'));
          }
        }
        model.set(current.attrName, $('#' + item).html().trim());
        model.save();
        $('#' + item).css('color', 'black');
      }
      middguard.state.changedModels = {};
    },
    
    restore: function(globalThis){
      //restore all changes to models that haven't been saved
      for (var item in middguard.state.changedModels){
        var selection = $('#' + item);
        selection.html(middguard.state.changedModels[item].restore);
        selection.css('color', 'black');
      }
      middguard.state.changedModels = {};
    },

    render: function(baseData, opt, mode){
      var globalThis = this;
      this.opt = opt;
      if (opt && opt.source === 'tableView'){
        //make sure call is coming from the intended place

        var tableName = this.model.get('name');
        var $table = $('#' + this.model.get('name') + '-table');
        var table = document.getElementById(this.model.get('name') + '-table');
        
        var data = (mode === 'collect') ? baseData.models: baseData;
        if (opt.remove){
          //if the table is being replaced, not extended
          $('#' + this.model.get('name') + '-table tbody').remove();
          //don't show anything if there are no results
          if (data.length === 0) return $table.css('visibility', 'hidden');
      
          if ($table.css('visibility') === 'hidden'){
            $table.css('visibility', 'visible');
          }
          
          var modNameText = document.getElementById(tableName + '-model-name-text');
          modNameText.innerHTML = 'Model: ' + tableName;
          modNameText.style['background-color'] = '#848484';
          modNameText.style['border-color'] = '#848484';
          modNameText.style.color = 'white';
          var row = table.insertRow(0);
          row.className = 'SQLRowHeader';
          var j = 0;
          var header = (mode === 'collect') ? data[0].attributes: data[0];
          for (var attr in header){
            //list attribute names
            var cell = row.insertCell(j);
            cell.innerHTML = attr;
            cell.className = 'header-cell';
            cell.contentEditable = true;
            j++;
          }
        }
        
        data.forEach(function(model, i){

          var row = table.insertRow(globalThis.numRows + 1);
          if (mode === 'collect') model = model.attributes;
          var rowView = new RowView({model: model});
          //rowView.setElement(row);
          row.className = 'SQLRow';
          var j = 0;
          for (var attr in model){
            var cell = row.insertCell(j);
            var cellView = new CellView(globalThis.collection, globalThis.model, model, attr);
            cell.innerHTML = model[attr];
            cell.contentEditable = true;
            cell.className = 'table-cell';
            cellView.setElement(cell);
            cellView.$el.attr('id', globalThis.collection.url + '-' + model.id + '-' + String(attr).replace(/ /g, '-'));
            j++;
          }
          globalThis.numRows++;
        });
        
      }
      return this;
    }
  });
  
  var RowView = middguard.View.extend({
    template: _.template('<tr class="table-row"></tr>'),
    
    className: '', //overriding 'middguard-module' default
    
    initialize: function (modelObj){
      this.$el.html(this.template);
      this.model = modelObj.model;
    },
    
    render: function(){
      return this;
    }
  });
  
  var CellView = middguard.View.extend({
    template: _.template('<td class="table-cell"></td>'),
    events: {
      'input ' : 'trackChanges',
    },
    className: '', //overriding 'middguard-module' default
    
    initialize: function(collection, modeltemp, model, attr){
      var globalThis = this;
      this.collection = collection;
      this.model = model;
      this.attr = attr;
      this.originalId = this.model.id;
      this.realModel =  middguard.entities[this.capitalize(pluralize(modeltemp.get('name')))].get(this.originalId);
      this.listenTo(this.realModel, 'change:' + this.attr, function(item){
        globalThis.$el.html(item.get(globalThis.attr));
      });
    },
    
    capitalize: function (string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    },
    
    trackChanges: function(){
      //apply the changed attribute to its model, store the model for future saving to DB
      this.$el.css('color', 'red');
      middguard.state.changedModels[this.collection.url + '-' + this.originalId + '-' + String(this.attr).replace(/ /g, '-')] = {
        collection: this.collection,
        restore: this.model[this.attr], 
        id: this.model.id, 
        attrName: this.attr
      };
    },
    
    render: function(){
      return this;
    }
    
  });

  middguard.SQLView =  {ctor: SQLView};
})();