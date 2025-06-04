const assert = require('assert');

// minimal jQuery/flot mock
class MockPlot {
  constructor() {
    this.dataSet = null;
  }
  setData(data) { this.dataSet = data; }
  setupGrid() {}
  draw() {}
}

global.window = {};
global.jQuery = global.$ = {
  plot: function() { return new MockPlot(); },
  isFunction: function(fn) { return typeof fn === 'function'; },
};

const json2flot = require('../json2flot.js');
const { processMetrics, UpdateResults } = json2flot._test;

// ensure updates are processed
json2flot.setMetricURLs([]);
json2flot.startUpdate();

const graph = json2flot.addGraph('#ph', {}, [{
  path: ['metrics'],
  keyRegex: 'm(.*)',
  metric: 'value',
  label: 'm$1',
  showTop: 0,
  showBottom: 2
}], 10);

const metricsData = {
  metrics: {
    m1: { value: 10 },
    m2: { value: 30 },
    m3: { value: 20 },
    m4: { value: 5 }
  }
};
const updater = new UpdateResults(new Date());
updater.results.push(metricsData);

processMetrics(updater);
json2flot.stopUpdate();

const labels = graph.plot.dataSet.map(m => m.path[m.path.length - 1]).sort();
assert.deepStrictEqual(labels, ['m1', 'm4']);

console.log('Test passed');
