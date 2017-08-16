'use strict';

const only = require('../src/lib/only');

const testObj = {
  field1: 'blbllb',
  field2: 'bdddddd',
  field3: 'dddddd',
  field4: 'eeeee',
};

describe('only', () => {
  test('parameters as string', () => {
    const res = only(testObj, 'field1 field3');
    expect(res).toHaveProperty('field1', testObj.field1);
    expect(res).toHaveProperty('field3', testObj.field3);
    expect(res).not.toHaveProperty('field2');
    expect(res).not.toHaveProperty('field4');
  });

  test('parameters as tokens', () => {
    const res = only(testObj, 'field1', 'field3');
    expect(res).toHaveProperty('field1', testObj.field1);
    expect(res).toHaveProperty('field3', testObj.field3);
    expect(res).not.toHaveProperty('field2');
    expect(res).not.toHaveProperty('field4');
  });

  test('parameters as array', () => {
    const res = only(testObj, ['field1', 'field3']);
    expect(res).toHaveProperty('field1', testObj.field1);
    expect(res).toHaveProperty('field3', testObj.field3);
    expect(res).not.toHaveProperty('field2');
    expect(res).not.toHaveProperty('field4');
  });

  test('same object if no params', () => {
    const res = only(testObj);
    expect(res).toMatchObject(testObj);
  });

  test('empty object for bad object', () => {
    const res = only('byaka buka', 'byaka byka');
    expect(Object.keys(res).length).toBe(0);
  });
});
