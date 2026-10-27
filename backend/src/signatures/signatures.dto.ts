import { IsBase64, IsIn, IsString, MaxLength } from 'class-validator';
import type { SignatureMethod } from '../letters/entities/letter-signature.entity.js';

export class AddSignatureDto {
  /** Signature file .p7s (DER, base64 or PEM) encoded in base64. Up to ~700 KB. */
  @IsString({ message: 'Додайте файл підпису' })
  @IsBase64({}, { message: 'Файл підпису має бути закодований у base64' })
  @MaxLength(1_000_000, { message: 'Файл підпису завеликий' })
  signature: string;

  @IsIn(['WIDGET', 'UPLOAD'])
  method: SignatureMethod;
}
