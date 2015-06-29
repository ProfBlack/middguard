var middguard = middguard || {};

(function () {
  'use strict';

  var LocationHeatmap = middguard.View.extend({
    id: 'heatmap',
    
    template: _.template('<svg id="heatmap-svg" width="1000" height="1000"><image xlink:href="/modules/movement-trace-view/images/movement-trace-map.jpg" id="movement-trace-map" style="width:1000px; height:1000px;" x="0" y="0"/></svg><div><select id="heatmap-choice"><option value="all">All Locations</option><option value="checkins">Check-In Locations</option></select><p id="atf">Attraction Type Filter: </><div id="filter1"><input type="checkbox" class="filter" id="NoFilter">No Filter</input><input type="checkbox" class="filter" id="ThrillRides">Thrill Rides</input><input type="checkbox" class="filter" id="KiddieRides">Kiddie Rides</input><input type="checkbox" class="filter" id="RidesforEveryone">Rides for Everyone</input></div><div id="filter2"><input type="checkbox" class="filter" id="Shows&Entertainment">Shows & Entertainment</input><input type="checkbox" class="filter" id="Information&Assistance">Information & Assistance</input><input type="checkbox" class="filter" id="Entrance">Entrance</input><input type="checkbox" class="filter" id="Unknown">Unknown</input></div></div>'),
    
    events:{
      "change #heatmap-choice":"userChange",
      "change .filter": "userChange"
      
    },
    
    initialize: function () {
      
      //this.choice will switch between "all" and "checkins"
      middguard.state.heatmapChoice = 'all';
      
      this.$el.html(this.template);
      this.yinc = 6; //margin at top--not a generalized value
      this.svg = d3.select(this.el).select('#heatmap-svg');
      this.colorScale = d3.scale.linear();
      this.colorScale.domain([0, 200]); //domain is a deliberate, specific choice
      this.colorScale.range(['#fee8c8', '#e34a33']);
      this.areaScale = d3.scale.linear().range([0, Math.PI*9]); //9 is a specific, deliberate choice
      
      _.extend(this, Backbone.Events);
      _.bindAll(this, 'render', 'processDataCheckin', 'processDataAll', 'getData', 'userChange');
      
      this.listenTo(middguard.state.timeRange, 'all', this.getData); //this.getData
      this.listenTo(middguard.entities.Locationcounts, 'sync', function(col, resp, opt){
        this.render(col, resp, opt);
      });
      this.listenTo(middguard.entities['Check-ins'], 'sync', function(col, resp, opt){
        this.render(col, resp, opt);
      });
      //this.listenTo(middguard.entities['Locationcounts'], 'reset', this.render);
      this.$('#heatmap-choice')[0].onchange=this.selectChange;
      this.distinctCheckins = new Set([
        '42$37', '34$68', '67$37', '73$79', '81$77', '92$81', '73$84', '85$86', '87$63', '28$66',
        '38$90', '87$48', '79$89', '16$49', '23$54', '99$77', '86$44', '63$99', '83$88', '78$48', '27$15', '50$57',
        '87$81', '79$87', '78$37', '76$22', '43$56', '69$44', '26$59', '6$43', '82$80', '76$88', '47$11', '16$66', '17$43',
        '43$78', '45$24', '32$33', '60$37', '0$67', '17$67', '48$87'
      ]);
      this.attractionTypes = {};
      this.dataStore = {};
      this.dataStoreList = [];
      this.getData();
			
    },
    
    userChange: function(){
      middguard.state.heatmapChoice = document.getElementById('heatmap-choice').value;
      var attractionTypes = {};
      var filterSet = new Set();
      var x, y, type, elmnts, numElmnts;
      elmnts = document.getElementsByClassName('filter');
      numElmnts = elmnts.length;
      for (var i = 0; i < numElmnts; i++){
        if (elmnts[i].checked){
          filterSet.add(elmnts[i].id);
        }
      }
      if (filterSet.size > 0 && ! document.getElementById('NoFilter').checked){
        middguard.entities['Pois'].forEach(function(model){
          //Add all types of attractions to a data structure for filtering later.
          //Break up data structure (a dictionary) into different sets whose keys
          //are based on the name of the attraction type in case we need to 
          //easily find out which attraction types have been selected
        
          x = model.get('x');
          y = model.get('y');
          type = model.get('type').replace(/\s+/g, '');
          if (x && y && filterSet.has(type)){
            if (! attractionTypes[type]){
              attractionTypes[type] = new Set();
            }
            attractionTypes[type].add(x + ',' + y);
          }
        });
        this.attractionTypes = attractionTypes;
      } else {
        document.getElementById('NoFilter').checked = true;
        this.attractionTypes = {};
      }
      
      this.getData();
    },
    
    getData: function(){
      //This function gets the data at a certain timestamp. Its execution will trigger the rendering.
      try {
        if (middguard.state.timeRange.current == Number.NEGATIVE_INFINITY){
          //this.stopListening(middguard.state.timeRange, "change", this.selectChange);
          middguard.state.timeRange.current = new Date("2014-06-06 08:02:00");
          //this.listenTo(middguard.state.timeRange, "change", this.selectChange);
        }
      } catch(err) {
        console.log(Error(err));
      }
      //start and end are specific, non-extensible dates
      var start = new Date("2014-06-06 08:02:00");
      var end = new Date("2014-06-08 23:20:16");
      if (middguard.state.timeRange.current < start){
        this.stopListening(middguard.state.timeRange, "change", this.selectChange);
        middguard.state.timeRange.current = start;
        this.listenTo(middguard.state.timeRange, "change", this.selectChange);
      }
      if (middguard.state.timeRange.current > end){
        this.stopListening(middguard.state.timeRange, "change", this.selectChange);
        middguard.state.timeRange.current = end;
        this.listenTo(middguard.state.timeRange, "change", this.selectChange);
      }
      var dateString = this.outputDate(middguard.state.timeRange.current);
      if (middguard.state.heatmapChoice == 'all'){
        //if data is being pulled for all locations
        
        //use data from minute floor as base to get data for a specific time
        var minuteFloor = dateString.slice(0, 17) + '00';
        middguard.entities['Locationcounts'].fetch({source: 'heatmap', reset: true, data: {where: ['timestamp', '<=', dateString],
            andWhere: ['timestamp', '>=', minuteFloor]}});  
      } else {
        //if data is being pulled for checkins
          var minuteFloor = dateString.slice(0, 17) + '00';
          middguard.entities['Check-ins'].fetch({source: 'heatmap', reset: true, data: {where: ['timestamp', '<=', dateString],
              andWhere: ['timestamp', '>=', minuteFloor]}});
      }
      
    },
    
    render: function (col, resp, opt) {
      //render the heatmap
      
      //make sure the function call is coming from the right place
      if (!opt || opt.source !== 'heatmap'){
        return this;
      }
      
      var svg = this.svg;
      
      if (middguard.state.heatmapChoice == 'all'){
        //if location heatmap
        
        var colorScale = this.colorScale;
        
        svg.selectAll('.heatCircle')
        .attr('r', 0);
        
        var rects = this.svg.selectAll('rect')
          .data(resp)
        
        rects
          .attr('x', function(d){return d.x*10;})
          .attr('y', function(d){return 1000-(d.y*10)-6}) //-6 is a specific choice given the image we're working with
          .attr('width', function(d){
            if (d.count > 0){
              return 10;
            } else {
              return 0;
            }
          })
          .attr('height', function(d){
            if (d.count > 0){
              return 10;
            } else {
              return 0;
            }
          })
          .attr('fill', function(d){return colorScale(d.count)})
          .attr('stroke', function(d){return colorScale(d.count)})
          .attr('class', 'heatRect');
        
        rects
          .enter()
          .append('rect')
          .attr('x', function(d){return d.x*10;})
          .attr('y', function(d){return 1000-(d.y*10)-6}) //-6 is a specific choice given the image we're working with
          .attr('width', function(d){
            if (d.count > 0){
              return 10;
            } else {
              return 0;
            }
          })
          .attr('height', function(d){
            if (d.count > 0){
              return 10;
            } else {
              return 0;
            }
          })
          .attr('fill', function(d){return colorScale(d.count)})
          .attr('stroke', function(d){return colorScale(d.count)})
          .attr('class', 'heatRect');
          
        rects
          .exit()
          .attr('width', 0)
          .attr('height', 0);
          
        rects
          .on('mouseover', function(d){
            svg.append('text')
              .attr('x', 750) //750 and 950 are specific, deliberate choices
              .attr('y', 970)
              .attr('fill', '#CC0000')
              .attr('class', 'tooltip')
            .text('x: ' + d.x + ', y: ' + d.y + ', count: ' + d.count);
          }).on('mouseout', function(d){
            svg.selectAll('.tooltip').remove();
          }).on('click', function(d){
            middguard.state.Pois.selections.add({x: d.x, y: d.y});
          });
          
      } else {
        //if checkin heatmap
        
        var areaScale = this.areaScale;
        var colorScale = d3.scale.linear().domain([0, 200]).range(['#fee8c8', '#e34a33']); //domain is a specific choice
        
        svg.selectAll('.heatRect')
        .attr('height', 0)
        .attr('width', 0);
        
        
        var circles = this.svg.selectAll('circle')
          .data(resp)
        
        circles
          .attr('cx', function(d){return d.x*10;})
          .attr('cy', function(d){return 1000-(d.y*10)-6}) //-6 is a specific choice given the image we're working with
          .attr('r', function(d){
            if (d.count > 0){
              return Math.pow(areaScale(d.count)/Math.PI, 0.5);
            } else {
              return 0;
            }
          })
          .attr('fill', function(d){return colorScale(d.count)})
          .attr('stroke', 'black')
          .attr('class', 'heatCircle');
      
        circles
          .enter()
          .append('circle')
          .attr('cx', function(d){return d.x*10;})
          .attr('cy', function(d){return 1000-(d.y*10)-6}) //-6 is a specific choice given the image we're working with
          .attr('r', function(d){
            if (d.count > 0){
              return Math.pow(areaScale(d.count)/Math.PI, 0.5);
            } else {
              return 0;
            }
          })
          .attr('fill', function(d){return colorScale(d.count)})
          .attr('stroke', 'black')
          .attr('class', 'heatCircle');
          
        circles
          .exit()
          .attr('r', 0);
            
        circles
          .on('mouseover', function(d){
            svg.append('text')
              .attr('x', 750) //750 and 950 are specific, deliberate choices
              .attr('y', 970)
              .attr('fill', '#CC0000')
              .attr('class', 'tooltip')
            .text('x: ' + d.x + ', y: ' + d.y + ', count: ' + d.count);
          }).on('mouseout', function(d){
            svg.selectAll('.tooltip').remove();
          }).on('click', function(d){
            middguard.state.Pois.selections.add({x: d.x, y: d.y});
          });
      }
      return this;
    },
    
    outputDate: function(date){
      //output the date in a certain string format
      
      var year = String(date.getFullYear());
      
      var month = String(date.getMonth() + 1);
      if (month.length == 1){
        month = '0' + month;
      }
      var day = String(date.getDate());
      if (day.length == 1){
        day = '0' + day;
      }
      var hours = String(date.getHours());
      if (hours.length == 1){
        hours = '0' + hours;
      }
      var minutes = String(date.getMinutes());
      if (minutes.length == 1){
        minutes = '0' + minutes;
      }
      var seconds = String(date.getSeconds());
      if (seconds.length == 1){
        seconds = '0' + seconds;
      }
      return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
    },
    
    processDataCheckin: function(dataArray, timestamp, start, end){
      //process data for checkin heatmap
      
      var tsDate = new Date(timestamp);
      if (tsDate > end || tsDate < start){
        console.log("Error: Timestamp out of range");
        return null;
      }
      
      var heatmapData = [];
      for (var i = 0; i < 100; i++){
        heatmapData[i] = [];
        for (var j = 0; j < 100; j++){
          heatmapData[i][j] = 0;
        }
      }
      
      if (Object.keys(this.attractionTypes).length){
        //if filters have been applied
        
        var desiredSet = new Set();
        for (prop in this.attractionTypes) {
          this.attractionTypes[prop].forEach(function(item){
            desiredSet.add(item);
          })
        }

        var daLength = dataArray.length-1;
        var x;
        var y;
        for (var i = 0; i < daLength; i++){
          x = dataArray[i].attributes.x;
          y = dataArray[i].attributes.y;
          if (this.distinctCheckins.has(x + '$' + y) && desiredSet.has(x + ',' + y)){
            heatmapData[y][x] = dataArray[i]; //[x, y, dataArray[i].attributes.count];
          }
          i++;
        }
      } else {
        var daLength = dataArray.length-1;
        var x;
        var y;
        for (var i = 0; i < daLength; i++){
          x = dataArray[i].attributes.x;
          y = dataArray[i].attributes.y;
          if (this.distinctCheckins.has(x + '$' + y)){
            heatmapData[y][x] = dataArray[i];//[x, y, dataArray[i].attributes.count];
          }
          i++;
        }
      }
      
      return heatmapData;
      
      
    },
    
    processDataAll: function(dataArray, timestamp, start, end, distincts){
      //process data for location heatmap
      //distincts represents the number of distinct x,y pairs we need before we can exit
      
      var heatmapData = [];
      for (var i = 0; i < 100; i++){
        heatmapData[i] = [];
        for (var j = 0; j < 100; j++){
          heatmapData[i][j] = 0;
        }
      }
      
      var used = new Object();
      used.items = 0;
      var curIndex = dataArray.length-1;
      var x, y;
      
      
      while (curIndex >= 0 && used.items < distincts){
        //while not every x,y pair has had a value found for it and the array has not been fully traversed
        x = dataArray[curIndex].attributes.x;
        y = dataArray[curIndex].attributes.y;
        if (! used[x + ',' + y]){
          //if x,y pair is unencountered
          used[x + ',' + y] = true;
          heatmapData[y][x] = dataArray[curIndex]; //[x, y, dataArray[curIndex].attributes.count];
          /*if (dataArray[curIndex].attributes.count > countMax){
            countMax = dataArray[curIndex].attributes.count;
          }*/
          used.items++;
        }
        curIndex--;
      }
      
      //this.colorScale.domain([0, countMax]);
      return heatmapData;
    },
    
    binarySearch: function(array, first, last, val){
      var mdpt;
      if (last <= first){
        return first;
      }
      while (first < last){
        if (last == first+1){
          //if val appears between 2 indices in list or is beyond one end of the list
          firstDiff = Math.abs(val-array[first]);
          lastDiff = Math.abs(val-array[last]);
          if (lastDiff < firstDiff){
            return last;
          } else {
            //if val is closer to the 'first' index or value is equidistant from 'first' and 'last'
            return first;
          }
        }
        mdpt = first+((last-first)/2)
        if (array[mdpt] == val){
          return mdpt;
        } else if (array[mdpt] > val){
          last = mdpt;
        } else {
          //if array[mdpt] < val
          first = mdpt;
        }
      }
    },
    
  });

  middguard.addModule('LocationHeatmap', LocationHeatmap);
})();