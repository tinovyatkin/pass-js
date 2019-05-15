import { PassBase } from '../src/lib/base-pass';
import { TOP_LEVEL_FIELDS } from '../src/constants';

describe('PassBase', () => {
  it('should have all required pass properties', () => {
    // to be able to check NFC property it must be storeCard
    const bp = new PassBase({ storeCard: {} });
    for (const field in TOP_LEVEL_FIELDS) expect(bp).toHaveProperty(field);
  });
});
