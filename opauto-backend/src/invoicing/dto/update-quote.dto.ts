import { PartialType } from '@nestjs/swagger';
import { CreateQuoteDto } from './create-quote.dto';

/**
 * UpdateQuoteDto — body for `PUT /quotes/:id`. Only DRAFT quotes are
 * editable; the service rejects updates against any non-DRAFT state.
 */
export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}
