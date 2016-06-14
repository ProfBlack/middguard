const path = require('path');

exports.inputs = [];

exports.outputs = [];

exports.displayName = '<%- displayName %>';

exports.visualization = true;

exports.static = path.join(__dirname, 'static');

exports.js = [
  '<%- moduleName %>.js'
];

exports.css = [
  '<%- moduleName %>.css'
];

exports.mainView = '<%- mainView %>';