// api/paramsSerializer.ts
import type { ParamsSerializerOptions } from 'axios';

/**
 * Serializa params de query repetindo arrays SEM colchetes, no formato que o
 * FastAPI espera para query params do tipo `list`:
 *
 *   { payment_method: ['pix', 'credit_card'] }
 *     -> payment_method=pix&payment_method=credit_card
 *
 * O default do axios v1 seria `payment_method[]=pix&payment_method[]=credit_card`,
 * que o backend não reconhece. `indexes: null` produz a repetição simples.
 * Chaves com valor escalar seguem serializando normalmente.
 */
export const repeatArrayParams: ParamsSerializerOptions = { indexes: null };
