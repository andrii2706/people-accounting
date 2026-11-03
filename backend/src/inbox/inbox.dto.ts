import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class MarkReadDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  keys: string[];
}
