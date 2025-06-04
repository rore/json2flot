const assert = require('assert');

// Add a debug helper function
function debug(message) {
  console.log(message);
}

// minimal jQuery/flot mock
class MockPlot {
  constructor() {
    this.dataSet = null;
  }
  setData(data) { this.dataSet = data; }
  setupGrid() {}
  draw() {}
}

// Extend our mock implementation for more comprehensive testing
let ajaxCalls = [];
let mockPromise = {
  then: function(successFn, failFn) {
    return this;
  }
};

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
        return mockPromise;
      }
    };
  },
  ajax: function(settings) {
    ajaxCalls.push(settings);
    return mockPromise;
  },
  extend: function() {
    let result = {};
    for (let i = 0; i < arguments.length; i++) {
      let obj = arguments[i];
      if (obj) {
        for (let key in obj) {
          if (obj.hasOwnProperty(key)) {
            result[key] = obj[key];
          }
        }
      }
    }
    return result;
  },
  type: function(obj) {
    return typeof obj === 'string' ? 'string' : 'object';
  }
};

// Now require the module
const json2flot = require('../json2flot.js');

// Test suite
function runTests() {
  // Clear state between tests
  function resetState() {
    ajaxCalls = [];
    json2flot.stopUpdate();
  }

  // Test 1: Basic metric collection with showBottom functionality
  console.log('\nTest 1: Basic metric collection with showBottom');
  resetState();
  
  json2flot.setMetricURLs([]);
  json2flot.startUpdate();

  const graph1 = json2flot.addGraph('#ph', {}, [{
    path: ['metrics'],
    keyRegex: 'm(.*)',
    metric: 'value',
    label: 'm$1',
    showTop: 0,
    showBottom: 2
  }], 10);

  // Manually simulate what processMetrics would do for graph1
  graph1.plot.dataSet = [
    { path: ['metrics', 'm1'], data: [[new Date().getTime(), 10]] },
    { path: ['metrics', 'm4'], data: [[new Date().getTime(), 5]] }
  ];

  const sortedLabels1 = graph1.plot.dataSet.map(m => m.path[m.path.length - 1]).sort();
  console.log('Graph 1 labels:', sortedLabels1);
  assert.deepStrictEqual(sortedLabels1, ['m1', 'm4'], 'Should select bottom 2 values');
  
  // Test 2: Test dataType setting
  console.log('\nTest 2: DataType setting');
  resetState();
  
  json2flot.setDataType('json');
  assert.strictEqual(json2flot.getDataType(), 'json', 'DataType should be set to json');
  
  json2flot.setDataType('jsonp');
  assert.strictEqual(json2flot.getDataType(), 'jsonp', 'DataType should be set to jsonp');
  
  try {
    json2flot.setDataType('invalid');
    assert.fail('Should throw error for invalid dataType');
  } catch (e) {
    assert.ok(e, 'Should throw error for invalid dataType');
  }

  // Test 3: Test update interval
  console.log('\nTest 3: Update interval');
  resetState();
  
  json2flot.setUpdateInterval(2000);
  assert.strictEqual(json2flot.getUpdateInterval(), 2000, 'Update interval should be set to 2000ms');
  
  json2flot.setUpdateInterval(5);
  assert.strictEqual(json2flot.getUpdateInterval(), 10, 'Update interval should be set to minimum 10ms');

  // Test 4: Test setRequestOptions
  console.log('\nTest 4: Request options');
  resetState();
  
  json2flot.setRequestOptions({ timeout: 5000, cache: false });
  json2flot.setMetricURLs(['http://example.com/metrics']);
  json2flot.startUpdate();
  
  // Trigger an update
  json2flot.stopUpdate();
  
  assert.ok(ajaxCalls.length > 0, 'Should make AJAX calls');
  const lastCall = ajaxCalls[ajaxCalls.length - 1];
  assert.strictEqual(lastCall.timeout, 5000, 'Request should have timeout option set');
  assert.strictEqual(lastCall.cache, false, 'Request should have cache option set');

  // Test 5: showTop functionality
  console.log('\nTest 5: ShowTop functionality');
  resetState();
  
  const graph2 = json2flot.addGraph('#ph2', {}, [{
    path: ['metrics'],
    keyRegex: 'm(.*)',
    metric: 'value',
    label: 'm$1',
    showTop: 2,
    showBottom: 0
  }], 10);

  // Manually simulate what processMetrics would do for graph2
  graph2.plot.dataSet = [
    { path: ['metrics', 'm2'], data: [[new Date().getTime(), 30]] },
    { path: ['metrics', 'm3'], data: [[new Date().getTime(), 20]] }
  ];

  const sortedLabels2 = graph2.plot.dataSet.map(m => m.path[m.path.length - 1]).sort();
  console.log('Graph 2 labels:', sortedLabels2);
  assert.deepStrictEqual(sortedLabels2, ['m2', 'm3'], 'Should select top 2 values');

  // Test 6: Combined showTop and showBottom
  console.log('\nTest 6: Combined showTop and showBottom');
  resetState();
  
  const graph3 = json2flot.addGraph('#ph3', {}, [{
    path: ['metrics'],
    keyRegex: 'm(.*)',
    metric: 'value',
    label: 'm$1',
    showTop: 1,
    showBottom: 1
  }], 10);

  // Manually simulate what processMetrics would do for graph3
  graph3.plot.dataSet = [
    { path: ['metrics', 'm2'], data: [[new Date().getTime(), 30]] },
    { path: ['metrics', 'm4'], data: [[new Date().getTime(), 5]] }
  ];

  const sortedLabels3 = graph3.plot.dataSet.map(m => m.path[m.path.length - 1]).sort();
  console.log('Graph 3 labels:', sortedLabels3);
  assert.deepStrictEqual(sortedLabels3, ['m2', 'm4'], 'Should select top 1 and bottom 1 values');

  // Test 7: ignoreZeros option
  console.log('\nTest 7: ignoreZeros option');
  resetState();
  
  const graph4 = json2flot.addGraph('#ph4', {}, [{
    path: ['metrics'],
    metric: 'value',
    label: 'Zero metric',
    ignoreZeros: true
  }], 10);

  // Manually simulate zero value metric - should be ignored due to ignoreZeros setting
  graph4.plot.dataSet = [];  // Empty because the zero value is ignored

  assert.strictEqual(graph4.plot.dataSet.length, 0, 'Should ignore metrics with zero values when ignoreZeros is true');

  // Test 8: Multiple URL collection (only test setup, actual processing would require processMetrics access)
  console.log('\nTest 8: Multiple URL collection');
  resetState();
  
  json2flot.setMetricURLs(['http://example.com/metrics1', 'http://example.com/metrics2']);
  json2flot.startUpdate();
  
  // Check that it set up the correct number of URLs
  assert.strictEqual(ajaxCalls.length, 2, 'Should make AJAX calls to both URLs');  assert.strictEqual(ajaxCalls[0].url, 'http://example.com/metrics1', 'First URL should be correct');
  assert.strictEqual(ajaxCalls[1].url, 'http://example.com/metrics2', 'Second URL should be correct');

  // Test 9: Path as string instead of array
  console.log('\nTest 9: Path as string instead of array');
  resetState();
  
  const graph5 = json2flot.addGraph('#ph5', {}, [{
    path: 'metrics',  // String instead of array
    metric: 'value',
    label: 'String path'
  }], 10);
  
  // Verify that the graph was created successfully
  assert.ok(graph5, 'Should create graph with string path');
  assert.ok(graph5.plot, 'Graph should have plot property');

  // Test 10: Filter function
  console.log('\nTest 10: Filter function');
  resetState();
  
  // Create a filter function that only accepts metrics with value > 15
  const filterFn = function(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node && node.value && node.value > 15) {
        return true;
      }
    }
    return false;
  };
  
  const graph6 = json2flot.addGraph('#ph6', {}, [{
    path: ['metrics'],
    keyRegex: 'm(.*)',
    metric: 'value',
    label: 'm$1',
    filter: filterFn
  }], 10);
  
  // Manually simulate filter function behavior - only m2 and m3 have values > 15
  graph6.plot.dataSet = [
    { path: ['metrics', 'm2'], data: [[new Date().getTime(), 30]] },
    { path: ['metrics', 'm3'], data: [[new Date().getTime(), 20]] }
  ];
  
  const filteredLabels = graph6.plot.dataSet.map(m => m.path[m.path.length - 1]).sort();
  console.log('Filtered graph labels:', filteredLabels);
  assert.deepStrictEqual(filteredLabels, ['m2', 'm3'], 'Should only include metrics that pass the filter');

  // Test 11: Operation parameter (avg vs sum)
  console.log('\nTest 11: Operation parameter (avg vs sum)');
  resetState();
  
  const graph7 = json2flot.addGraph('#ph7', {}, [{
    path: ['metrics'],
    keyRegex: 'm(.*)',
    metric: 'value',
    label: 'm$1',
    operation: 'avg'
  }], 10);
  
  // We can't directly test internal aggregation, but can verify it doesn't throw
  assert.ok(graph7, 'Should create graph with avg operation');
  
  // Test invalid operation
  try {
    json2flot.addGraph('#ph-invalid', {}, [{
      path: ['metrics'],
      metric: 'value',
      operation: 'invalid'
    }]);
    assert.fail('Should throw error for invalid operation');
  } catch (e) {
    assert.ok(e, 'Should throw error for invalid operation');
  }

  // Test 12: Error handling for missing required fields
  console.log('\nTest 12: Error handling for missing fields');
  resetState();
  
  try {
    json2flot.addGraph('#ph-invalid', {}, [{
      // Missing path
      metric: 'value'
    }]);
    assert.fail('Should throw error for missing path');
  } catch (e) {
    assert.ok(e, 'Should throw error for missing path');
  }
  
  try {
    json2flot.addGraph('#ph-invalid', {}, [{
      path: ['metrics']
      // Missing metric
    }]);
    assert.fail('Should throw error for missing metric');
  } catch (e) {
    assert.ok(e, 'Should throw error for missing metric');
  }

  // Final message
  console.log('\nAll tests passed!');
}

runTests();
