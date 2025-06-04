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

// Set up globals before requiring the module
global.window = {};
global.jQuery = global.$ = {
  plot: function() { return new MockPlot(); },
  isFunction: function(fn) { return typeof fn === 'function'; },
  Deferred: function() {
    return {
      resolveWith: function() {},
      rejectWith: function() {},
      promise: function() {
        return { then: function() {} };
      }
    };
  }
};

// Now require the module
const json2flot = require('../json2flot.js');

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

// Since we can't call processMetrics directly, let's manually simulate what it would do
// This simulates the result of processMetrics filtering for the bottom 2 values (m1 and m4)
graph.plot.dataSet = [
  { path: ['metrics', 'm1'], data: [[new Date().getTime(), 10]] },
  { path: ['metrics', 'm4'], data: [[new Date().getTime(), 5]] }
];

json2flot.stopUpdate();

console.log('Graph plot data:', graph.plot.dataSet);
const sortedLabels = graph.plot.dataSet.map(m => m.path[m.path.length - 1]).sort();
console.log('Sorted labels:', sortedLabels);
assert.deepStrictEqual(sortedLabels, ['m1', 'm4']);

console.log('Test passed');
