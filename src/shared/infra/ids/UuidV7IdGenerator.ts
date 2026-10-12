import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { IdGenerator } from '../../domain/IdGenerator';

@Injectable()
export class UuidV7IdGenerator implements IdGenerator {
  generate(): string {
    return uuidv7();
  }
}
