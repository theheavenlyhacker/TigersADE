import { ParseUUIDPipe } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { INT8_MAX } from './int8';
import { IsISO8601, Matches, ValidateBy, ValidationOptions, buildMessage } from 'class-validator';


/** Path params: 422 (not Nest's default 400) for a malformed id. */
export const uuidPipe = new ParseUUIDPipe({ errorHttpStatusCode: 422 });

const numberToString = Transform(({ value }) => (typeof value === 'number' ? String(value) : value));

/** Integer centavos as a numeric string (numbers are accepted and converted). Fits Postgres bigint. */
export function IsCentavos(options: { positive?: boolean } & ValidationOptions = {}): PropertyDecorator {
  const { positive, ...validation } = options;
  const check = ValidateBy({
    name: 'isCentavos',
    validator: {
      validate: v => typeof v === 'string' && (positive ? /^[1-9]\d{0,18}$/ : /^\d{1,19}$/).test(v) && BigInt(v) <= INT8_MAX,
      defaultMessage: buildMessage(eachPrefix => `${eachPrefix}$property must be ${positive ? 'positive' : 'non-negative'} integer centavos`, validation),
    },
  }, validation);
  return (target, key) => { numberToString(target, key); check(target, key); };
}

/** Stock quantity with up to three decimals, as a string (numbers are accepted and converted). */
export function IsQuantity(options: { nonNegative?: boolean } & ValidationOptions = {}): PropertyDecorator {
  const { nonNegative, ...validation } = options;
  const check = ValidateBy({
    name: 'isQuantity',
    validator: {
      validate: v => typeof v === 'string' && (nonNegative ? /^\d{1,9}(\.\d{1,3})?$/ : /^-?\d{1,9}(\.\d{1,3})?$/).test(v),
      defaultMessage: buildMessage(eachPrefix => `${eachPrefix}$property must be a quantity with up to three decimals`, validation),
    },
  }, validation);
  return (target, key) => { numberToString(target, key); check(target, key); };
}

/** A calendar date, YYYY-MM-DD. */
export const IsBusinessDate = (options?: ValidationOptions): PropertyDecorator => (target, key) => {
  IsISO8601({ strict: true }, options)(target, key);
  Matches(/^\d{4}-\d{2}-\d{2}$/, options)(target, key);
};

/** A time of day, HH:MM. */
export const IsClockTime = (options?: ValidationOptions) => Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: '$property must be HH:MM', ...options });

export const trim = Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** True when a PATCH body set none of its fields. */
export const isEmptyPatch = (dto: object) => Object.values(dto).every(v => v === undefined);
