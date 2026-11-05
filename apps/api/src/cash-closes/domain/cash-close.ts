import { UnprocessableEntityException } from '@nestjs/common';
import { INT8_MAX } from '../../shared/sql';

/** Expected cash = opening float + the day's cash sales; variance = counted − expected. All centavos. */
export function reconcile(openingFloat: bigint, cashSales: bigint, countedCash: bigint) {
  const expectedCash = openingFloat + cashSales;
  if (expectedCash > INT8_MAX) throw new UnprocessableEntityException('Expected cash is too large');
  return { expectedCash, variance: countedCash - expectedCash };
}

export function assertDayHasStarted(requested: string, today: string) {
  if (requested > today) throw new UnprocessableEntityException('Cannot close a business day that has not started');
}
