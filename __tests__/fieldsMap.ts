import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FieldsMap } from '../dist/lib/fieldsMap.js';
import { getW3CDateString } from '../dist/lib/w3cdate.js';

test('FieldsMap Class', () => {
  const fields = new FieldsMap();
  // should not add empty arrays if not needed
  assert.equal(JSON.stringify({ a: 1, fields }), '{"a":1}');

  fields.add({ key: 'testKey', label: 'testLabel', value: 'testValue' });
  assert.partialDeepStrictEqual(fields.get('testKey'), {
    label: 'testLabel',
    value: 'testValue',
  });
  assert.equal(
    JSON.stringify({ zz: 'zz', theField: fields }),
    `{"zz":"zz","theField":[{"key":"testKey","label":"testLabel","value":"testValue"}]}`,
  );

  fields.setValue('testKey', 'newValue');
  assert.partialDeepStrictEqual(fields.get('testKey'), {
    label: 'testLabel',
    value: 'newValue',
  });

  // Add should replace the same key
  fields.add({ key: 'testKey', label: 'testLabel2', value: 'testValue2' });
  assert.partialDeepStrictEqual(fields.get('testKey'), {
    label: 'testLabel2',
    value: 'testValue2',
  });

  // delete should remove the entry
  fields.delete('testKey');
  assert.equal(JSON.stringify({ b: 2, fields }), '{"b":2}');

  // setDateTime
  const date = new Date();
  fields.setDateTime('testDate', 'labelDate', date);
  assert.equal(
    JSON.stringify(fields),
    `[{"key":"testDate","label":"labelDate","value":"${getW3CDateString(date)}"}]`,
  );
});
