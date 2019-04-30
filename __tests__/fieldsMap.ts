'use strict';

import { FieldsMap } from '../src/lib/fieldsMap';
import { getW3CDateString } from '../src/lib/w3cdate';

test('FieldsMap Class', () => {
  const fields = new FieldsMap();
  // should not add empty arrays if not needed
  expect(JSON.stringify({ a: 1, fields })).toBe('{"a":1}');
  // add
  fields.add({key: 'testKey', label: 'testLabel', value: 'testValue'});
  expect(fields.get('testKey')).toMatchObject({
    label: 'testLabel',
    value: 'testValue',
  });
  // setValue
  fields.setValue('testKey', 'newValue');
  expect(fields.get('testKey')).toMatchObject({
    label: 'testLabel',
    value: 'newValue',
  });
  // Add should replace the same key
  fields.add({ key: 'testKey', label: 'testLabel2', value: 'testValue2'});
  expect(fields.get('testKey')).toMatchObject({
    label: 'testLabel2',
    value: 'testValue2',
  });
  // remove should remove the entry and whole key if it last one
  fields.delete('testKey');
  expect(JSON.stringify({ b: 2, fields })).toBe('{"b":2}');

  // setDateTime
  const date = new Date();
  fields.setDateTime('testDate', 'labelDate', date);
  expect(JSON.stringify(fields)).toBe(`[{\"key\":\"testDate\",\"label\":\"labelDate\",\"value\":\"${getW3CDateString(date)}\"}]`)
});
