import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source.options';
import { DATA_SOURCE } from './tokens';

@Global()
@Module({
  providers: [
    {
      provide: DATA_SOURCE,
      useFactory: async () => {
        const dataSource = new DataSource(buildDataSourceOptions());

        return dataSource.initialize();
      },
    },
  ],
  exports: [DATA_SOURCE],
})
export class DatabaseModule {}
