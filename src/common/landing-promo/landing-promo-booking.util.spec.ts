import {
  applyLandingPromoPrices,
  landingPromoToClientPayload,
  type AppliedLandingPromo,
} from './landing-promo-booking.util';

const discountPromo = (
  eligible: string[],
  ineligible: string[] = [],
): AppliedLandingPromo => ({
  codeId: 'code1',
  code: 'SALE15',
  promotionId: 'promo1',
  type: 'DISCOUNT',
  title: 'Скидка 15%',
  description: null,
  discountPercent: 15,
  bundlePrice: null,
  eligibleServiceIds: eligible,
  ineligibleServiceIds: ineligible,
});

describe('applyLandingPromoPrices DISCOUNT', () => {
  it('applies discount only to eligible services', () => {
    const rows = [
      { serviceId: 'a', price: 10000 },
      { serviceId: 'b', price: 5000 },
    ];
    applyLandingPromoPrices(rows, discountPromo(['a'], ['b']));
    expect(rows[0].price).toBe(8500);
    expect(rows[1].price).toBe(5000);
  });
});

describe('landingPromoToClientPayload', () => {
  it('marks partial application when cart is mixed', () => {
    const payload = landingPromoToClientPayload(
      discountPromo(['a'], ['b']),
      ['a', 'b'],
    );
    expect(payload.appliedServiceIds).toEqual(['a']);
    expect(payload.ineligibleServiceIds).toEqual(['b']);
    expect(payload.partialApplication).toBe(true);
  });
});
